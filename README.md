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

### Gameplay

- **Zone** Residential / Commercial / Industrial land by dragging, and draw roads.
- **Power** flows from turbines, solar farms and gas plants through roads and
  buildings. Brownouts happen when demand exceeds supply.
- **Water towers** (which need power) let lots grow past low density.
- **Land value** rises with waterfront, parks, trees and services, and falls with
  pollution and crime. It decides whether a lot becomes a house, an apartment
  block or a tower.
- **RCI demand**, monthly budget, tax sliders, happiness, crime, pollution,
  and advisors that explain what the city needs.
- **Milestones** (Hamlet → Megalopolis) unlock the gas plant, school, solar,
  hospital and stadium.
- 36 procedurally modelled zone buildings (3 zones × 3 densities × 4 variants)
  plus 10 service buildings. Animated traffic, spinning turbines, smoke and
  steam, construction pop-in, and a day/night cycle with lit windows, street
  lights, neon and bloom.
- Autosaves locally.

### Built for the fold

Layout comes from the screen's shape and the reported hinge, not a model list
(`src/posture.js`):

| Posture | Detection | Layout |
|---|---|---|
| **Folded** (cover screen) | narrow phone aspect | compact HUD; bottom tool dock in portrait, left rail in landscape; the dashboard opens as a bottom sheet |
| **Unfolded** (inner screen) | near-square, ≥560 px short side | grouped two-column tool rail; the **Mayor's Desk** (stats, budget, minimap, advisors) docks beside the city (landscape) or below it (portrait) |
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
  src/sim.js                     power/water networks, land value, growth, budget, advisors
  src/input.js                   camera rig, touch gestures (pan/pinch/twist), mouse, keys
  src/ui.js                      HUD, tools, Mayor's Desk, inspect card, menus
  src/posture.js                 foldable posture detection
  src/audio.js                   synthesized SFX + ambience (no audio files)
  src/render/renderer.js         sky, day/night lighting, bloom, tilt-shift grade, adaptive res
  src/render/cityview.js         terrain, ocean, instanced roads/buildings/trees/cars, particles
  src/render/models.js           procedural building / prop library
  src/render/geo.js, textures.js mesh kit + canvas-painted textures
  vendor/three/                  Three.js r170 (MIT)
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
