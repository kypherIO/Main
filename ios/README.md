# Skyfold for iOS (native)

A native rewrite of Skyfold in Swift, Metal and SwiftUI, built with Xcode 26
for iOS 26. It targets the foldable iPhone's inner display: 1878 × 2670 px at
430 ppi, which is 626 × 890 pt at 3×.

## Build in Xcode

```bash
brew install xcodegen
cd ios
xcodegen                 # generates Skyfold.xcodeproj from project.yml
open Skyfold.xcodeproj
```

Then select your team (Signing & Capabilities) and run on a device. The
simulator works too, without AR or the haptics hardware.

CI (`.github/workflows/ios.yml`) builds the app with `xcodebuild` for the iOS
Simulator and for a generic device on every push, and runs the simulation
unit tests (`swift test`) on Linux.

## Architecture

```
Packages/SkyfoldCore/         Pure-Swift simulation (Linux-testable)
  Config / World / Sim / Events / Writer / RNG
Skyfold/
  App/        SkyfoldApp (fold-aware layout), GameModel (state hub), Persistence, DemoCity
  Render/     Metal: ShaderTypes.h (shared C structs), Shaders.metal, Renderer,
              CityScene (instancing, vehicles, particles), Models + MeshBuilder
              (procedural assets), Camera, DayNight
  Input/      GameControllerSupport
  UI/         HUD (Liquid Glass), DeskView (Swift Charts), Screens, MetalCityView
              (gestures), ARCityView
  Services/   GameCenter, Haptics, Audio, Intelligence, Emblem, Intents
```

## Apple frameworks used

| Framework | What it does in Skyfold |
|---|---|
| **Metal** | Uber-shader with procedural windows, roads and terrain; shadow mapping; 4× MSAA HDR; instanced draws (one call per model type) |
| **MetalFX** | Spatial upscaling from 50–67% render resolution to the native panel, so it can run at 120 Hz |
| **MetalPerformanceShaders** | Gaussian blur for bloom |
| **MetalKit** | `MTKView` render loop at up to 120 fps (`CADisableMinimumFrameDurationOnPhone`) |
| **GameKit** | Game Center sign-in, Access Point, 3 leaderboards, 14 achievements, `GKSavedGame` cloud saves |
| **GameController** | Gamepad play (sticks move and orbit, A builds, shoulder buttons cycle tools) and Game Mode (`GCSupportsGameMode`) |
| **Core Haptics** | Custom patterns for building, demolition, fires and milestones |
| **AVFAudio** | Synthesized effects through `AVAudioEnvironmentNode`, giving HRTF spatial audio for construction and fires |
| **FoundationModels** | On-device Apple Intelligence: `@Generable` headlines, posts and petitions; an advisor that calls a `cityStats` **Tool**; **streamed** briefings |
| **ImagePlayground** | `ImageCreator` generates a city flag; `imagePlaygroundSheet` lets the player design their own |
| **App Intents** | Siri / Shortcuts: "How is my city in Skyfold", "Open my city" |
| **ARKit + RealityKit** | Places a live diorama of your city on a real table |
| **Swift Charts** | Population and treasury graphs on the Mayor's Desk |
| **SwiftUI (iOS 26)** | Liquid Glass (`glassEffect`, `.glass` button styles), sheets and detents |

## App Store Connect setup

- **Game Center:** enable the capability. Create the leaderboards
  `skyfold.leaderboard.population`, `skyfold.leaderboard.approval` and
  `skyfold.leaderboard.treasury`, and the achievements
  `skyfold.achievement.<id>` for each ID listed in `GameCenterService.swift`.
- **Saved games:** add the iCloud capability (iCloud Documents) for `GKSavedGame`.
- **Apple Intelligence:** works on supported devices with Apple Intelligence
  turned on. Elsewhere the procedural writer takes over automatically.

## Status

This code was written without local access to Xcode. CI is the compile check;
see the PR checks for the latest result. Performance on hardware hasn't been
profiled yet. To profile, open Instruments' Metal System Trace or set
`MTL_HUD_ENABLED=1` in the scheme.
