# Calorie Counter for iPhone

Native SwiftUI project targeting iOS 17+, alongside the existing website. Open `CalorieCounter.xcodeproj` in Xcode.

## Implemented source

- Home: cream/blue theme, stationary textured calorie circle, gently moving dots with Reduce Motion support, textured profile button, General Sans font, illustrated dock.
- Local food-name picker over all 1,014 imported INDB records.
- Reference meal review: explicit serving or gram measurement, positive fractional quantities, deterministic calories, source food code, date/time, edit and save.
- Logs: grouped by local day, edit and delete with confirmation.
- Settings: editable daily target. Progress and Insights show Coming soon.
- Device-local JSON journal written atomically to Application Support. Errors are surfaced; a corrupt file is not silently reset or overwritten.
- Separate `CalorieCore` Swift package contains data models, calculations and persistence without SwiftUI dependencies.

## Verification status

Current build, test and simulator status — including the hand-verified MVP flow and the
exact terminal commands to reproduce it without the Xcode GUI — is maintained in the
repo-root **[`PROGRESS.md`](../PROGRESS.md)** (sections 3–5). That file is the single
source of truth; this README describes the design only.

## First run

1. Install Xcode from the Mac App Store, launch it, and finish its additional-component/iOS simulator installation.
2. Open `ios/CalorieCounter.xcodeproj`, select the shared CalorieCounter scheme and an iPhone simulator. Build and run; resolve any compiler issues before device testing.
3. Run `swift test --package-path ios/CalorieCore` with Xcode's matching toolchain selected.
4. For your physical iPhone, choose your Apple account's team under Signing & Capabilities, select the connected iPhone, and follow Xcode's device setup prompts. Signing identifiers/team can be changed for your account. No signing credentials are stored here.

Apple's device-running guide: https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices

## What is intentionally not connected

- Natural-language meal estimates and camera capture.
- Python semantic search: still the separate offline prototype in `scripts/nutrition_search.py`; the native picker is simple food-name browsing, not a port of hybrid retrieval.
- Account authentication and cloud synchronization. Existing web meal history is not imported.
- App Store submission, app icon, screenshots, privacy disclosures and distribution setup.

The existing Sites identity headers are supplied by its web hosting layer. A native client must not forge those headers or embed an AI API key. Plan a shared authenticated backend with a supported mobile sign-in/token flow and server-side estimation before connecting either cloud meals or AI. Keep source attribution and snapshot nutrient values when saving meals so database updates do not silently rewrite history.

The JSON schema here is native prototype storage version 1, not the web API payload. Define and test an explicit mapping before enabling cloud sync. Decide how conflicts, deletion, and offline edits merge; do not reuse the current whole-history PUT as a mobile sync protocol without that work.

## Resources and updates

`Resources/foods.json` is a compact export of original reference fields from `data/nutrition/indb-2024.sqlite`; no new nutritional facts or aliases are generated. All missing serving values remain null and `servingUsable` preserves validation flags. The database and model weights are not both copied into the app.

The four original PNGs are reused as dock assets. The local WOFF2 font glyphs were repackaged as TTF with distinct GeneralSans-Regular and GeneralSans-Medium native names. Cream/blue styling and lowercase interface copy are carried forward; user records preserve original database names internally.
