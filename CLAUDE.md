# Claude Code — project notes

Follow `AGENTS.md`, and read `PROGRESS.md` first: it is the shared, always-current
handoff document for every agent working here. Update it before ending a session.

Tooling facts that cost time to rediscover:

- Node lives at `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`
  (Codex-bundled, not on PATH). `npm` is absent; run CLIs as
  `node node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/bin/<cli>.js`.
- iOS: `xcodebuild` and `xcrun simctl` work from the terminal; the simulator panel
  tool needs `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` once.
  Its tap coordinates land at ~0.78× the aimed point — divide targets by 0.78 — and
  never send `text` without first confirming a field has focus (it wedges the
  simulator's gesture system until `simctl shutdown`/`boot`).
- Two `vinext dev` servers on one checkout corrupt `node_modules/.vite`; run one.
