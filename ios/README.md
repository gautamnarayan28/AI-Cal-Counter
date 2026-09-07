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

Verified on 7 September 2026 with Xcode 26.6 (Swift 6.3.3):

- `swift test --package-path ios/CalorieCore`: 6 of 6 XCTest cases pass — portion bases and fractions, invalid quantities, missing-serving handling, persistence round-trip and edit, corrupt-file preservation, local-day totals (IST case).
- `xcodebuild -scheme CalorieCounter -destination 'generic/platform=iOS Simulator' build`: succeeds with no errors or warnings.
- Installed and launched on an iPhone 17 Pro simulator; the Home screen renders and the process stays alive. Food picker, meal editor, logs and settings have been exercised only through the unit tests, not yet by tapping through the UI on a simulator or device.
- All 1,014 bundled nutrition records match the validated SQLite source.

Not yet verified: a physical-device install, VoiceOver pass, Dynamic Type at the largest sizes, and behaviour on a fresh device with no Application Support directory.

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
