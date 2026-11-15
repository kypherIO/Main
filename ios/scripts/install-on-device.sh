#!/usr/bin/env bash
# Build Skyfold and install + launch it on a connected iPhone (USB or same Wi-Fi).
#
#   ./ios/scripts/install-on-device.sh                # build, install, launch once
#   ./ios/scripts/install-on-device.sh --stress       # launch straight into the stress test with the perf overlay
#   ./ios/scripts/install-on-device.sh --watch        # keep running: reinstall whenever the branch gets new commits
#
# Requirements: Xcode 26+, `brew install xcodegen`, the phone paired with this Mac
# (Developer Mode on), and your Apple ID added in Xcode → Settings → Accounts.
# Set TEAM_ID (your 10-character Apple Developer Team ID) the first time:
#   export TEAM_ID=ABCDE12345
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS="$ROOT/ios"
BUNDLE_ID="com.kypher.skyfold"
DERIVED="$IOS/build/DerivedData"
ARGS=()
WATCH=0
for a in "$@"; do
  case "$a" in
    --stress) ARGS=(-stress -perf) ;;
    --perf) ARGS=(-perf) ;;
    --watch) WATCH=1 ;;
  esac
done

: "${TEAM_ID:?Set TEAM_ID to your Apple Developer Team ID (Xcode → Settings → Accounts)}"

device_id() {
  # First connected/available iPhone; override with DEVICE_ID=...
  if [ -n "${DEVICE_ID:-}" ]; then echo "$DEVICE_ID"; return; fi
  xcrun devicectl list devices --json-output /tmp/skyfold-devices.json >/dev/null 2>&1 || true
  /usr/bin/python3 - <<'PY'
import json, sys
try:
    d = json.load(open("/tmp/skyfold-devices.json"))
except Exception:
    sys.exit(0)
for dev in d.get("result", {}).get("devices", []):
    hw = dev.get("hardwareProperties", {})
    conn = dev.get("connectionProperties", {})
    if hw.get("platform") == "iOS" and conn.get("pairingState") == "paired":
        print(dev.get("identifier", "")); break
PY
}

build_install_launch() {
  local dev
  dev="$(device_id)"
  if [ -z "$dev" ]; then echo "No paired iPhone found. Connect the phone (or enable Wi-Fi debugging) and trust this Mac."; return 1; fi
  echo "▸ Generating project"
  (cd "$IOS" && xcodegen >/dev/null)
  echo "▸ Building for device $dev"
  xcodebuild -project "$IOS/Skyfold.xcodeproj" -scheme Skyfold -configuration Release \
    -destination "id=$dev" -derivedDataPath "$DERIVED" \
    DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates \
    build | grep -E "error:|warning: .*signing|BUILD (SUCCEEDED|FAILED)" || true
  local app="$DERIVED/Build/Products/Release-iphoneos/Skyfold.app"
  [ -d "$app" ] || { echo "Build failed — see output above."; return 1; }
  echo "▸ Installing"
  xcrun devicectl device install app --device "$dev" "$app"
  echo "▸ Launching ${ARGS[*]:-}"
  xcrun devicectl device process launch --device "$dev" --terminate-existing "$BUNDLE_ID" "${ARGS[@]}"
  echo "✓ Skyfold is running on your iPhone"
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
