# Main

Main channel.

## Skyfold — a city builder for foldable iPhones

`game/` is **Skyfold**, an original 3D city-building game built for foldable phones.
It runs in Mobile Safari as an installable, offline-capable web app (PWA). The
3D runs on WebGL 2 through Three.js, which is vendored in the repo, so there's
no build step.

### Play it

```bash
cd game
python3 -m http.server 8080
# open http://localhost:8080 — or http://<your-mac-ip>:8080 on the phone
```

On iPhone: open the page in Safari → Share → **Add to Home Screen**. That gives
full-screen, safe-area-aware play, and offline caching once it's served over HTTPS.
The included GitHub Pages workflow (`.github/workflows/pages.yml`) deploys `game/`
once Pages is turned on (Settings → Pages → Source: GitHub Actions).

Useful URL flags: `?play=1` (skip title), `?posture=folded|unfolded|book|tabletop`,
`?q=battery|balanced|ultra`, `?tod=0.8` (lock the time of day), `?speed=1..3`.

### Gameplay — layered systems

Every system feeds the others, so one decision ripples through the city:

| Layer | What it simulates | What you do about it |
|---|---|---|
| **Zoning & growth** | R/C/I lots grow through three densities. The cap depends on water, land value, education and city size. | Zone, then read the inspect card, which says exactly what a lot needs to grow |
| **Power grid** | Plants feed connected components through roads and buildings. A short component has rolling brownouts. | Turbines, solar farms, gas plants, rooftop solar policy |
| **Traffic & commutes** | Every household routes over the road graph to its nearest job. Load becomes congestion, commute minutes, slower cars and road pollution. | Streets vs **Avenues** (2.7× capacity, upgrade by dragging), **Bus Stops**, **Metro**, Free Transit policy |
| **Workforce & education** | Workers split into low-skill and skilled by school and university coverage. Jobs have skill needs, which drive unemployment, vacancies and demand. | Schools, University, mixed zoning |
| **Land value** | Waterfront, parks, trees and services add value. Pollution, crime, traffic, garbage, industry and abandonment subtract it. | Place parks and services, keep industry away from homes |
| **Health, crime, garbage** | Coverage fields from clinics, hospitals and police. Garbage piles up when landfill capacity runs short. | Clinics, Hospital, Police, Landfill, Recycling Center |
| **Fire** | Buildings can ignite (industry and abandoned buildings more often), fire spreads, stations put it out, and lost buildings leave rubble. | Fire stations, Smoke Detector Mandate, a Disasters toggle |
| **Decline** | Distressed buildings (no power, unhappy, no route to work, garbage) get abandoned and recover once fixed. | Fix the root cause the advisors point to |
| **Economy** | Wealth-scaled residential tax, C/I tax, transit fares and tourism, against road and service upkeep, policy costs and loan payments. | Tax sliders, department funding (50–150%), 9 ordinances, loans |
| **Citizens & politics** | Per-household happiness with a factor breakdown, and a mayor approval rating with decaying modifiers. | Petitions (11 quest types with deadlines and rewards), 14 achievements |
| **City feed** | Monthly headlines, resident posts, and an on-demand advisor briefing. | All generated text, see below |

The Mayor's Desk has tabs for **Overview** (KPIs, demand, workforce, happiness
factors, charts), **Budget** (taxes, department funding, ledger, loans),
**Policy**, **Goals** (petitions and achievements), **Feed** (advisor briefing,
advisors, news, resident posts) and **Map** (minimap, 10 data layers, camera and
time of day).

### Generative AI with Apple's Foundation Models

`ios/` holds a native SwiftUI app that hosts the game in a WKWebView and adds a
bridge to Apple's on-device **Foundation Models** framework (iOS 26+). It uses
`@Generable` structs for headlines, resident posts, petition text and the advisor
briefing (`ios/Skyfold/FoundationModelsBridge.swift`). Every request carries
procedural fallback text. In a browser, on unsupported devices, or if the model
declines a request, `src/ai.js` writes the text with a built-in grammar, so
gameplay never depends on the model. The shell also enables 120 Hz
(`CADisableMinimumFrameDurationOnPhone`) and native haptics. See `ios/README.md`.

### Built for the fold

Layout comes from the screen's shape and the reported hinge, not a model list
(`src/posture.js`):

| Posture | Detection | Layout |
|---|---|---|
| **Folded** (cover screen) | narrow phone aspect | compact HUD; bottom tool dock in portrait, left rail in landscape; the dashboard opens as a bottom sheet |
| **Unfolded** (inner screen, 1878×2670 px @ 430 ppi = 626×890 pt) | near-square, ≥560 pt short side | grouped two-column tool rail; the **Mayor's Desk** (stats, budget, minimap, advisors) docks beside the city (landscape) or below it (portrait) |
| **Book** | Viewport Segments API reports side-by-side segments | city on one panel, desk on the other, nothing drawn across the hinge |
| **Tabletop** | stacked segments (half-folded) | city on the top half, controls on the bottom half |

Folding or unfolding mid-game moves the same desk DOM between the sheet and the
dock. The canvas re-sizes without losing state.

Rendering is tuned for ProMotion displays. It uses dynamic resolution scaling
against the frame-rate target (30 / 60 / ProMotion), three quality tiers
(Battery / Balanced / Ultra), instanced geometry (~130 draw calls for a full
city), and texel-snapped shadows that follow the camera.

### Code map

```
game/
  index.html, styles.css         UI shell + glass design system
  manifest.webmanifest, sw.js    PWA + offline cache
  src/config.js                  tuning tables (zones, services, costs, milestones)
  src/world.js                   tile grids, island generator, save/load
  src/sim.js                     networks, traffic routing, workforce, fields, fire, decline, economy
  src/events.js                  petitions, achievements, approval, city feed
  src/ai.js                      generative text: Foundation Models bridge + procedural writer
  src/input.js                   camera rig, touch gestures (pan/pinch/twist), mouse, keys
  src/ui.js                      HUD, tools, Mayor's Desk, inspect card, menus
  src/posture.js                 foldable posture detection
  src/audio.js                   synthesized SFX + ambience (no audio files)
  src/render/renderer.js         sky, day/night lighting, bloom, tilt-shift grade, adaptive res
  src/render/cityview.js         terrain, ocean, instanced roads/buildings/trees/cars, particles
  src/render/models.js           procedural building / prop library
  src/render/geo.js, textures.js mesh kit + canvas-painted textures
  vendor/three/                  Three.js r170 (MIT)
ios/
  project.yml                    XcodeGen spec (bundles ../game as app resources)
  Skyfold/GameView.swift         WKWebView host, skyfold:// scheme, haptics
  Skyfold/FoundationModelsBridge.swift  on-device LLM bridge (@Generable)
```

### Notes

- Every asset is generated in code at startup: meshes, façade textures, road
  textures, water normals and sprites. The repo holds no binary art beyond the
  app icons.
- iOS Safari caps web pages at 60 fps unless the user turns off
  "Prefer Page Rendering Updates near 60fps" (Settings → Apps → Safari →
  Advanced → Feature Flags). Wrapping the game in a WKWebView shell, for example
  with Capacitor and `CADisableMinimumFrameDurationOnPhone`, unlocks 120 Hz for
  App Store distribution.
- Device breakpoints are in `DEVICE` in `src/posture.js`. Adjust them to the exact
  cover and inner display sizes of the target hardware.
