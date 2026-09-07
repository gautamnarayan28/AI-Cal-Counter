# Instructions for coding agents (Codex, Claude Code, others)

**Read `PROGRESS.md` before doing anything.** It is the single source of truth for
where this project stands, what was verified, what is broken, and what is next. It
exists so that an agent with no memory of earlier sessions — or a human who does not
use Xcode — can pick the work up in minutes without re-reading the whole tree.

## Session rules

1. Start by reading `PROGRESS.md` and the section of it relevant to your task.
2. Before you finish, **update `PROGRESS.md`**: bump the status table, move items
   between "verified / open / next", add a dated entry to the log at the bottom.
   Never leave a claim in it that you did not actually verify in this session; if a
   step could not be run, say so and say why.
3. Commit your work to `main` with a descriptive message, and push. Uncommitted work
   has been lost in this project before.
4. Do not commit: `.env.local`, `.dev.vars`, `design/` (full-resolution art),
   `data/nutrition/indb-search.sqlite` (rebuildable), Xcode `DerivedData`. All are
   gitignored — keep it that way.

## Two products in one repo

- `app/`, `worker/`, `db/` — the **web app** (Next.js App Router on Cloudflare
  Workers via `vinext`, hosted on OpenAI Sites). Has AI photo/text estimation and D1
  meal storage. Node is bundled by Codex at
  `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` — it is not
  on the system PATH.
- `ios/` — the **native iPhone app** (SwiftUI, iOS 17+). Deterministic calories from
  the bundled INDB reference data. Build, test and run it entirely from the command
  line; see `PROGRESS.md` → "Working on the iOS app without Xcode".
- `data/nutrition/`, `scripts/` — the **INDB 2024 reference database** and offline
  search prototype (Python). Shared by both products.

The owner does not use the Xcode GUI. Every iOS instruction you write must be a
command that runs in a terminal, and every claim of "it builds / it works" must be
backed by `xcodebuild`, `swift test`, or a simulator run you actually executed.
