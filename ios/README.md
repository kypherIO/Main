# Skyfold for iOS

A native shell around the web game with three additions: 120 Hz rendering,
native haptics, and Apple's on-device Foundation Models for generated text.

## Build

```bash
brew install xcodegen
cd ios
xcodegen            # creates Skyfold.xcodeproj
open Skyfold.xcodeproj
```

Select your team under Signing & Capabilities, then run on a device. The
`../game` folder is copied into the app bundle and served through a custom
`skyfold://` URL scheme, so ES modules and localStorage work offline.

## Requirements

- Xcode 26 or later, which provides the iOS 26 SDK and the FoundationModels framework.
- The app itself deploys to iOS 17. On-device generation turns on only when
  `SystemLanguageModel.default.availability == .available`: iOS 26 or later,
  Apple Intelligence-capable hardware, with Apple Intelligence enabled.
  Otherwise the game falls back to its procedural writer.

## How the AI bridge works

| JS request (`src/ai.js`) | Swift `@Generable` type | Used for |
|---|---|---|
| `headline` | `Headline { title, body }` | Monthly city newspaper |
| `chirp` | `Chirp { handle, text }` | Resident posts and inspect-card quotes |
| `petition` | `Petition { text }` | Rewriting citizen petitions |
| `brief` | `Briefing { summary, priorities[] }` | "Ask advisor" on the Feed tab |

The simulation decides every number and fact, and the model only writes the
wording. Prompts pass the facts as JSON, and the system instructions tell the
model not to invent numbers. A failed or refused generation returns `null`, and
the JS side keeps its fallback text.

Note: this shell was written without access to Xcode, so it hasn't been
compiled here. Expect minor API adjustments against the shipping SDK.
