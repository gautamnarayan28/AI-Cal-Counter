# PROGRESS.md — project status and agent handoff

**Last updated: 2026-09-07 (Codex).** This file is the single source of truth for
where the project stands. Every agent (Codex, Claude Code) reads it first and updates it
before finishing. See `AGENTS.md` for the rules. If something here contradicts the code,
the code wins — fix this file.

Owner: Gautam (`gautamnarayan28` on GitHub). **Does not use the Xcode GUI.** Every iOS
instruction below is a terminal command.

---

## 1. TL;DR

- The project pivoted on **6 Sep 2026** from a web-only AI calorie journal to a **native
  iPhone app backed by a real nutrition database** (INDB 2024, 1,014 Indian foods).
- The iOS app **builds, passes its tests, installs and runs on the iPhone 17 Pro
  simulator**, and the full MVP flow has been driven by hand and verified (section 5).
- The web app still exists, still works, and is where the AI estimation lives. The two
  are **not connected** (no shared backend, different storage).
- Nothing is on a physical phone or TestFlight yet. That needs the owner's Apple account
  (section 4.4).
- Repo: `github.com/gautamnarayan28/AI-Cal-Counter`, branch `main`, everything pushed.

## 2. What changed since the pivot (6–7 Sep 2026)

| Date | Change | Who |
|---|---|---|
| 6 Sep | Web app redesigned: cream/navy palette, General Sans, illustrated dock, real routes `/logs` `/progress` `/insights` `/settings`, D1 meal storage via `app/api/data/route.ts`. | Codex |
| 6 Sep | Nav icon PNGs shrunk 5.6 MB → 124 KB; originals kept in gitignored `design/`. | Claude |
| 6–7 Sep | **INDB 2024 imported** to `data/nutrition/indb-2024.sqlite` (validated cell-by-cell). Python hybrid search prototype in `scripts/`. | Codex |
| 6–7 Sep | **Native iOS app** created in `ios/` (SwiftUI + `CalorieCore` package). | Codex |
| 7 Sep | iOS made buildable and MVP-ready: app icon added, `ONLY_ACTIVE_ARCH` fixed (simulator link failure), Medium font used, README corrected. First build, test and simulator run. | Claude |
| 7 Sep | Full simulator flow tested. Three fixes: Settings validation no longer dismisses the sheet; swipe-delete is red; portion labels pluralise. All re-verified. | Claude |

## 3. Status by component

| Component | State | Last verified | How |
|---|---|---|---|
| **iOS app** (`ios/`) | Builds and home screen runs on simulator; prior MVP verification in §5 | 7 Sep | Codex rebuilt, installed, launched and visually checked home; tests 6/6 and full flow from prior Claude session |
| iOS → physical iPhone / TestFlight | iPhone 13 Pro connected and paired; Developer Mode enabled; Apple account/signing setup pending; no install yet | 7 Sep | `devicectl list devices` and `device info details` |
| **INDB data** (`data/nutrition/indb-2024.sqlite`) | Complete, validated, 1,014 records, 917 with usable servings | 7 Sep | `python3 tests/test_indb_import.py` 5/5; `validation.json` |
| INDB **license** | **Unresolved.** The dataset page states no license; only the paper is CC BY. | 7 Sep | Checked anuvaad.org.in |
| **Search prototype** (`scripts/nutrition_search.py`) | Works offline in Python only; **not runnable on this Mac right now** (no `fastembed`, model cache gone); not connected to anything | 6 Sep (Codex) | `search-evaluation.json` 22/22 — but lexical-only also scored 22/22 |
| **Web app** (`app/`, `worker/`) | Runs in `vinext dev`; AI text+photo estimation live; auth-gated API | 6 Sep | Browser session |
| Web app deploy | On OpenAI Sites via Codex control plane (project id in `.openai/hosting.json`). **Not** Vercel — see §7. | — | — |

## 4. Working on the iOS app without Xcode (terminal only)

All commands run from the repo root. Xcode 26.6 is installed; `xcode-select` points at it.

### 4.1 Build for the simulator

```bash
xcodebuild -project ios/CalorieCounter.xcodeproj -scheme CalorieCounter \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath /tmp/cc-derived CODE_SIGNING_ALLOWED=NO build
```

Expect `** BUILD SUCCEEDED **`. The app lands at
`/tmp/cc-derived/Build/Products/Debug-iphonesimulator/CalorieCounter.app`.

### 4.2 Run the tests

```bash
swift test --package-path ios/CalorieCore
```

Expect `Executed 6 tests, with 0 failures`. Business logic (portion math, persistence,
validation, local-day totals) lives in `CalorieCore` and is what these test. The SwiftUI
layer in `ios/CalorieCounter/` has no automated tests — verify it in the simulator.

### 4.3 Install, launch, screenshot on the simulator

```bash
UDID=$(xcrun simctl list devices available | grep 'iPhone 17 Pro (' | head -1 | grep -oE '[0-9A-F-]{36}')
xcrun simctl boot $UDID; xcrun simctl bootstatus $UDID -b
xcrun simctl install $UDID /tmp/cc-derived/Build/Products/Debug-iphonesimulator/CalorieCounter.app
xcrun simctl launch  $UDID com.gautamnarayan.CalorieCounter
xcrun simctl io      $UDID screenshot /tmp/home.png
```

Saved meals live at
`$(xcrun simctl get_app_container $UDID com.gautamnarayan.CalorieCounter data)/Library/Application Support/calorie-journal/meals.json`.
Reading that file is the fastest way to prove a save/edit/delete actually happened.

### 4.4 Get it onto Gautam's iPhone (owner's step — needs Apple credentials)

Not yet done. Two routes; both need an Apple ID (a free one works for personal-device
installs, re-signed every 7 days):

1. **One-time in Xcode GUI** (simplest): open `ios/CalorieCounter.xcodeproj`, Xcode →
   Settings → Accounts → add Apple ID; select the target → Signing & Capabilities → pick
   the Team; plug in the iPhone; press Run. Signing style is already `Automatic`.
2. **Terminal only**: find the Team ID at developer.apple.com/account (Membership), then
   ```bash
   xcodebuild -project ios/CalorieCounter.xcodeproj -scheme CalorieCounter \
     -destination 'generic/platform=iOS' -allowProvisioningUpdates \
     DEVELOPMENT_TEAM=XXXXXXXXXX build
   xcrun devicectl list devices
   xcrun devicectl device install app --device <device-id> <path-to-.app>
   ```
   This route has **not been exercised** in this repo yet; expect to iterate.

For TestFlight/App Store: resolve the INDB license (§6) first, pick one product name
(§8), and replace the placeholder icon.

### 4.5 Project facts that will bite you

- `project.pbxproj` is **XML plist format**, hand-written, not Xcode-generated. Edit
  with care; Xcode will happily rewrite it into the classic format on save.
- `ONLY_ACTIVE_ARCH = YES` is set on project-level Debug. Without it a simulator build
  tries to link an x86_64 slice `CalorieCore` never built and **fails at link**.
- App icon: `Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` — a
  **placeholder** made from the dock's house illustration. 1.2 MB. Replace before launch.
- Fonts: `general-sans-400.ttf` (Regular) and `-500.ttf` (Medium); PostScript names
  `GeneralSans-Regular` / `GeneralSans-Medium`, registered in `Info.plist` `UIAppFonts`.
- `Resources/foods.json` is a 200 KB export of `indb-2024.sqlite` (1,014 records). If
  the database changes, regenerate this file — nothing does it automatically yet.
- Bundle id `com.gautamnarayan.CalorieCounter`; display name **"calorie journal"**.
- Storage: one JSON file, schema `version: 1`, written atomically. A corrupt file is
  surfaced as an error and **never overwritten** (tested).

### 4.6 If you are an agent driving the simulator panel

The Claude Code simulator tool's tap coordinates land at **~0.78×** the aimed point:
aim at `target ÷ 0.78`. Never send `text` unless a screenshot shows a focused field with
a cursor — typing into nothing wedges the simulator's gesture system until
`xcrun simctl shutdown <UDID> && xcrun simctl boot <UDID>`. The first tap after a launch
tends to race the launch animation; screenshot first.

## 5. Verified MVP flow (7 Sep 2026, iPhone 17 Pro simulator, iOS 26.5)

| Step | Result |
|---|---|
| Home | "calories left 1,900", date, dock, "choose a food" |
| Food picker | all 1,014 INDB foods, alphabetical, serving unit shown |
| Select "afghani chicken" | editor pre-fills plate / 1 / **287 kcal** / `OSR062` |
| Quantity → 12 | live recalculation **3,450** |
| Add to log | sheets dismiss; `meals.json` written with full food snapshot |
| Home | **"over target 1,550"**, eaten 3,450 |
| Logs | grouped "today · 3,450 kcal" |
| Edit → grams | 12 g → **18 kcal**; "save changes"; same meal id, edited in place |
| Swipe → delete → confirm | popover; file drops to 0 meals; target preserved |
| Empty Logs | "no meals yet" |
| Settings → 19000 → save | **rejected inline**, sheet stays open, file unchanged at 1900 |

Not visually re-verified after the 7 Sep fixes (built and compiled only): the red
swipe-delete tint and the pluralised label ("12 plates", "2 glasses"). Both are
one-line view changes; check them next time a multi-serving meal is logged.

Not verified at all: physical device, VoiceOver, largest Dynamic Type, fresh device with
no Application Support directory, iPad (target is iPhone-only: `TARGETED_DEVICE_FAMILY=1`).

## 6. Open items, ranked

1. **INDB license.** Email `awasthi@anuvaad.org.in` asking for explicit redistribution
   terms before shipping `foods.json` in an App Store bundle. Fine for personal use.
2. **Physical device install** (§4.4). Blocks everything "on my phone".
3. **Two apps, no shared backend.** Web: D1 via OpenAI identity headers + AI estimates.
   iOS: local JSON, no AI, no sync. The iOS README says how *not* to bridge them (don't
   forge identity headers, don't embed the API key). The real MVP is the merge; nobody
   has designed it yet. Decide which product is primary before building more UI.
4. **Progress and Insights tabs** are "coming soon" stubs on both platforms.
5. **Search prototype**: the embedding half isn't earning its keep (lexical + aliases
   scored the same 22/22) and can't run in the Cloudflare Worker. Recommendation: port
   the FTS5 + alias + qualifier logic (works in D1/SQLite natively) and add embeddings
   only when real unseen queries fail. `indb-search.sqlite` is gitignored — rebuild it
   with `python scripts/nutrition_search.py build` after `pip install -r
   scripts/nutrition-search-requirements.txt`.
6. **Web app** leftovers: `app/page.tsx:89` lint error (`setState` in effect); overage
   is still clamped to 0 (iOS got this right); `/api/estimate` rate limiter is
   in-memory only — set a spend cap on the OpenAI key.
7. Placeholder icon; product name (§8); 82 INDB foods lack per-serving kcal and are
   correctly forced to grams — but the picker doesn't explain *why* ("weight required").

## 7. Decisions made, and why (don't relitigate without new information)

- **Native iOS, not PWA**, because the owner wants an app on the phone and the AI
  estimate accuracy problem is better solved by a reference database than by a bigger
  model (research: AI photo estimates ~36% MAPE; adding context helps more than model
  tier; a database gives deterministic numbers).
- **Deterministic calories from INDB in the iOS app**; AI stays server-side. A native
  client must never embed the OpenAI key.
- **Per-100 g and per-serving are separate bases** and stored separately. `energy_kcal`
  is never treated as "per piece". Missing serving data is `null`, never 0.
- **Meals snapshot the food record** (name, kcal, code) so database updates don't
  rewrite history.
- **Web app stays on OpenAI Sites / Cloudflare Workers**, not Vercel. `vinext` is
  Cloudflare's; the OpenAI-specific surface is ~30 lines (identity headers, hosting.json,
  `chatgpt-auth.ts`). Moving to Vercel would be an infra rewrite for no accuracy gain;
  moving to a personal Cloudflare account is ~1–2 h if ever needed.
- **`gpt-5.6-luna` for text estimates; recommend `gpt-5.6-terra` for photos** —
  cost is <$2/month either way at personal volume, so optimise accuracy.
- **Validation errors are inline; the root alert is for disk failures only.** (7 Sep fix.)

## 8. Naming — pick one

Repo `AI-Cal-Counter` · web `<title>Calorie Counter</title>` · iOS display name
**"calorie journal"** · folder `calorie-counter`. Decide before any store listing.

## 9. Do not

- Commit `.env.local`, `.dev.vars`, `design/`, `data/nutrition/indb-search.sqlite`,
  `DerivedData`, or the INDB `.xlsx` source. All gitignored; keep it so.
- Run two `vinext dev` servers on one checkout — they corrupt `node_modules/.vite`
  and break hydration (seen 6 Sep). `rm -rf node_modules/.vite` fixes it.
- Claim "verified" in this file for anything you didn't run.
- Open the pbxproj in Xcode "just to look" if you want to keep it in XML format.

## 10. Web app quick reference

Node is Codex-bundled, not on PATH:
`export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"`.
`npm` is absent; invoke CLIs directly, e.g.
`node node_modules/.pnpm/eslint@*/node_modules/eslint/bin/eslint.js . --ignore-pattern dist`.
Dev server: `node node_modules/.pnpm/vinext@*/node_modules/vinext/dist/cli.js dev`
(binds `[::1]:3000`; add `--hostname 0.0.0.0` to reach it from a phone on the same
Wi-Fi — the estimator will 401 there because no identity header is injected outside
OpenAI Sites).

Env: `OPENAI_API_KEY`, `ALLOWED_ESTIMATE_EMAILS` (see `.env.example`).

---

## Session log (newest first — add an entry every session)

- **2026-09-07 — Codex signing setup.** Confirmed Developer Mode enabled and
  device services available on the paired iPhone. `security find-identity -v -p
  codesigning` returned zero valid identities. Opened Xcode Apple Accounts settings;
  it shows the sign-in prompt with no account configured. Awaiting owner sign-in
  directly in Xcode before provisioning, building, and installing. No app changes.
- **2026-09-07 — Codex physical-device setup.** Confirmed wired, paired iPhone
  13 Pro running iOS 26.5 via `devicectl`. Developer Mode is disabled; owner must
  enable it before proceeding. Project has no development team configured. No
  physical-device build or installation yet. Owner reported completing the simulator
  food/log walkthrough; not independently re-tested in this session.
- **2026-09-07 — Codex simulator walkthrough, step 1.** Successfully rebuilt with
  `xcodebuild`, opened Simulator, installed and launched on iPhone 17 Pro. Screenshot
  confirmed the loaded home screen with 1,900 calories left and food picker entry.
  Left the app open for the owner to try. No source changes; tests and meal flows
  were not rerun this session.
- **2026-09-07 — Codex handoff review.** Read the progress notes and repository
  instructions to catch up on the native iOS work. Implementation status is
  unchanged; the build, test, and simulator results above are from the previous
  session and were not rerun during this documentation-only review.
- **2026-09-07 — Claude Code.** Reviewed the pivot; verified iOS builds/tests/runs for
  the first time (README had claimed no Xcode). Added AppIcon set, `ONLY_ACTIVE_ARCH`,
  Medium font use; gitignored search index; committed `d188663`. Hand-drove the full
  simulator flow (§5). Found Settings validation dismissing the sheet via the root
  alert; fixed with local range validation. Made swipe-delete red; pluralised portion
  labels. Rebuilt, 6/6 tests, re-verified Settings inline error. Created `AGENTS.md`,
  `CLAUDE.md`, this file.
- **2026-09-06/07 — Codex.** Imported INDB 2024 to SQLite with validation; built
  hybrid search prototype; created the native iOS app and `CalorieCore` package;
  redesigned the web app (cream/navy, real routes, D1 storage).
- **2026-09-03/04 — Claude Code.** Web app review; model cost research; auth + rate
  limit on `/api/estimate`; photo+note combined estimation; GitHub repo created and
  first push; icon shrink.
