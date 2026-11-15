#!/usr/bin/env bash
# Build Skyfold and install + launch it on a connected iPhone (USB or same Wi-Fi).
#
#   ./ios/scripts/install-on-device.sh                # build, install, launch once
#   ./ios/scripts/install-on-device.sh --stress       # launch into the stress test with the perf overlay
#   ./ios/scripts/install-on-device.sh --watch        # keep running: reinstall whenever the branch gets new commits
#
# Requirements: Xcode 26+, `brew install xcodegen`, the phone paired with this Mac
# (Developer Mode on), and your Apple ID added in Xcode → Settings → Accounts.
# TEAM_ID is detected from your signing certificate; set it to override.
# Full build logs: ios/build/install.log
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS="$ROOT/ios"
DERIVED="$IOS/build/DerivedData"
LOG="$IOS/build/install.log"
mkdir -p "$IOS/build"
ARGS=()
WATCH=0
NO_GC=0
for a in "$@"; do
  case "$a" in
    --stress) ARGS=(-stress -perf) ;;
    --perf) ARGS=(-perf) ;;
    --watch) WATCH=1 ;;
    --no-gamecenter) NO_GC=1 ;;
  esac
done

die() { echo "✗ $*" >&2; exit 1; }

# ---- preflight -------------------------------------------------------------
command -v xcodebuild >/dev/null || die "Xcode command line tools not found. Install Xcode 26 and run: sudo xcode-select -s /Applications/Xcode.app"
XC_MAJOR="$(xcodebuild -version 2>/dev/null | awk '/^Xcode/{split($2,v,"."); print v[1]}')"
[ "${XC_MAJOR:-0}" -ge 26 ] || die "Xcode 26 or newer is required (found: $(xcodebuild -version | head -1)). Skyfold uses the iOS 26 SDK (Liquid Glass, Foundation Models)."
command -v xcodegen >/dev/null || die "xcodegen not found. Run: brew install xcodegen"

if [ -z "${TEAM_ID:-}" ]; then
  TEAM_ID="$(security find-certificate -a -c "Apple Development" -p 2>/dev/null \
    | openssl x509 -noout -subject 2>/dev/null | sed -n 's/.*OU *= *\([A-Z0-9]\{10\}\).*/\1/p' | head -1)"
  [ -n "$TEAM_ID" ] || die "Couldn't detect your team. Open Xcode → Settings → Accounts, add your Apple ID, then: export TEAM_ID=XXXXXXXXXX"
  echo "▸ Using team $TEAM_ID (from your Apple Development certificate)"
fi
# Bundle IDs are global across Apple; make ours unique to your team unless overridden.
BUNDLE_ID="${BUNDLE_ID:-com.skyfold.app.$(echo "$TEAM_ID" | tr '[:upper:]' '[:lower:]')}"

# ---- device discovery -------------------------------------------------------
# devicectl uses CoreDevice identifiers; xcodebuild needs the hardware UDID.
find_device() {
  xcrun devicectl list devices --json-output /tmp/skyfold-devices.json >/dev/null 2>&1 || true
  /usr/bin/python3 - "$@" <<'PY'
import json, sys
try:
    devs = json.load(open("/tmp/skyfold-devices.json")).get("result", {}).get("devices", [])
except Exception:
    devs = []
for d in devs:
    hw, conn = d.get("hardwareProperties", {}), d.get("connectionProperties", {})
    if hw.get("platform") == "iOS" and conn.get("pairingState") == "paired":
        print(d.get("identifier", ""), hw.get("udid", ""), d.get("deviceProperties", {}).get("name", "iPhone").replace(" ", "_"))
        break
PY
}

build() {
  local udid="$1"; shift
  xcodebuild -project "$IOS/Skyfold.xcodeproj" -scheme Skyfold -configuration Release \
    -destination "platform=iOS,id=$udid" -derivedDataPath "$DERIVED" \
    DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" \
    -allowProvisioningUpdates -allowProvisioningDeviceRegistration "$@" build >"$LOG" 2>&1
}

build_install_launch() {
  read -r CD_ID UDID NAME < <(find_device) || true
  if [ -z "${CD_ID:-}" ] || [ -z "${UDID:-}" ]; then
    echo "✗ No paired iPhone found."
    echo "  • Connect the phone with a cable, unlock it and tap 'Trust This Computer'"
    echo "  • Turn on Settings → Privacy & Security → Developer Mode on the phone"
    echo "  • Check it appears in: xcrun devicectl list devices"
    return 1
  fi
  echo "▸ Device: ${NAME//_/ } ($UDID)"
  echo "▸ Generating Xcode project"
  (cd "$IOS" && xcodegen >/dev/null) || { echo "✗ xcodegen failed"; return 1; }

  local extra=()
  [ "$NO_GC" = 1 ] && extra=(CODE_SIGN_ENTITLEMENTS=)
  echo "▸ Building (this takes a few minutes the first time) — log: $LOG"
  if ! build "$UDID" "${extra[@]+"${extra[@]}"}"; then
    if [ "$NO_GC" = 0 ] && grep -qiE "game center|GameKit|capabilit|entitlement|Personal development team" "$LOG"; then
      echo "▸ Signing rejected the Game Center capability (common with free Apple IDs). Retrying without it…"
      NO_GC=1
      build "$UDID" CODE_SIGN_ENTITLEMENTS= || true
    fi
  fi
  local app="$DERIVED/Build/Products/Release-iphoneos/Skyfold.app"
  if ! grep -q "BUILD SUCCEEDED" "$LOG" || [ ! -d "$app" ]; then
    echo "✗ Build failed. Errors:"
    grep -E "error:|Signing|provisioning|No profiles|requires a development team|Unable to find a destination" "$LOG" | sed 's/^/   /' | sort -u | head -25
    echo "   (full log: $LOG)"
    return 1
  fi
  echo "▸ Installing"
  xcrun devicectl device install app --device "$CD_ID" "$app" || { echo "✗ Install failed — unlock the phone and trust the developer: Settings → General → VPN & Device Management"; return 1; }
  echo "▸ Launching ${ARGS[*]:-}"
  xcrun devicectl device process launch --device "$CD_ID" --terminate-existing "$BUNDLE_ID" "${ARGS[@]+"${ARGS[@]}"}" \
    || echo "  (If launch was blocked, open Settings → General → VPN & Device Management and trust your developer profile, then tap Skyfold.)"
  [ "$NO_GC" = 1 ] && echo "  Note: built without Game Center (needs a paid Apple Developer Program team)."
  echo "✓ Skyfold is on your iPhone"
}

if [ "$WATCH" = 1 ]; then
  BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  echo "Watching origin/$BRANCH — the app reinstalls on every new commit (Ctrl-C to stop)"
  last=""
  while true; do
    git -C "$ROOT" fetch -q origin "$BRANCH" || true
    head="$(git -C "$ROOT" rev-parse "origin/$BRANCH")"
    if [ "$head" != "$last" ]; then
      git -C "$ROOT" merge -q --ff-only "origin/$BRANCH" || true
      build_install_launch || true
      last="$head"
    fi
    sleep 60
  done
else
  build_install_launch
fi
