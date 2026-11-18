# Current state

_Last updated: 2026-11-18 (M3 built on `m3-photo-timeline`, PR to `main` open)._
Update this file at the end of every substantial task. Detail and history live in
`docs/LOCAL_MIGRATION_HANDOFF.md` (cloud → local handoff, 2026-11-18) and the specs/plans; this
file is the short, current summary.

## Status

- `main` = `917e4e8` (PR #6 = Claude Code workflow). M1 and M2 are done.
- **M3 photo timeline + rescan is built** on `m3-photo-timeline` (`main` merged in); PR to `main`
  awaits the owner. Spec `docs/superpowers/specs/2026-11-18-m3-photo-timeline-design.md`, plan
  `docs/superpowers/plans/2026-11-18-m3-photo-timeline.md`.
  - DB: `plant_photos` (owner-only RLS, insert grant on plant_id/path/taken_at only), trigger from
    `plants.photo_path`, backfill (keeps health `scan_id`, dedupes paths shared by several scans),
    `delete_plant_photo` RPC (locks the plant, promotes the next newest main photo).
  - `check-health` upserts its photos onto the timeline with `scan_id` (failure non-fatal).
  - App: timeline strip + Add a photo with an inline health-check offer on plant detail; full-screen
    viewer `plant/[id]/photos` (swipe, health result, What is it?, Delete); Edit has no photo controls;
    deleting a plant removes timeline photos too.
  - Reviews (Opus): Task 1 fixes approved; Tasks 2–3 found a two-device delete race → fixed with the
    RPC, re-review approved. Final whole-branch review: see the PR.
  - Verified 2026-11-18: Jest 281, typecheck, lint, `fn:test` 72, `db:test` 103, e2e security script
    10/10 (Playwright installed outside the repo), web screenshots light + dark. Owner phone check owed.
  - Web dev server: `CI=1 npx expo start --web` does not watch files; restart it after edits.

## Completed (merged to `main`)

| PR | Branch | What |
|---|---|---|
| #1 | `claude/jolly-archimedes-v394b2` | Software + hardware spec, M1 plan, design/animation skills |
| #2 | `m1-foundation` | M1: monorepo, Expo app shell, local Supabase, auth, profiles + RLS, CI; email confirmation |
| #3 | `email-domain-check` | `before-user-created` hook (disposable / mail-less domains, fails open on DNS); UI foundation |
| #4 | `appearance-setting` | Light by default, Dark option in Settings; launch animation timing; loading rules |
| #5 | `m2-plant-library` | M2: plant library + detail, photos (private bucket, re-encoded), Plant.id identify / health / name search functions with limits, 190 curated species, 4-step add flow |

Plan checkboxes in `docs/superpowers/plans/` are not ticked; git history and this file are the record.

## Known bugs and limitations

Non-blocking items from the M2 reviews are listed in handoff §2.4 (name search for common names,
unconfirmed health-issue names, 92 unchecked species, count-then-call limit race,
`plants.setup_step` user-writable, "{n} need you" counts loaded pages only, orphan uploads,
`npm audit` noise in build tooling — never `npm audit fix --force`). Older deferred minors:
`docs/superpowers/handoff/2026-11-17-m2-handoff.md` (end). Device checks still owed by the owner:
handoff §2.4. Jest prints a worker-exit warning at the end (pre-existing; `-- --forceExit` if it hangs).

## Local environment (Windows, checked 2026-11-18)

- T0 done: Node 22.23.5 via nvm-windows (`C:\nvm4w\nodejs`), npm 10.9.9, npm `script-shell` =
  Git Bash, `npm ci` (deno 2.9.6, supabase 3.2.0), `gh` signed in as AlexC-789, Docker running.
  A Claude Code session started before nvm was installed has a stale PATH: restart it.
- All five checks run locally: `fn:test` 69 tests and `db:test` 71 tests pass (on `main`'s schema).
- Plugins (user scope, installed 2026-11-18): `superpowers@claude-plugins-official` 7.0.2,
  `ponytail@ponytail` 5.3.3 (its task board writes a local CSV under `~/.config/ponytail/band/`;
  webhook off). `unslop` arrives synced from claude.ai. Project plugin: `expo` (`apps/mobile/.claude`).
- MCP: `.claude/settings.json` blocks the unrelated claude.ai connectors (Expedia, Kiwi.com,
  lastminute.com, Gmail, Google Calendar) in this project; Claude Docs and Google Drive remain.

## Open decisions (owner)

- App UI design open questions 1–4 (`docs/superpowers/specs/2026-11-17-app-ui-design.md` §8).
- `origin/claude/busy-ride-ov5sv2`: 5 unmerged app-UI-design doc commits (2026-11-17), probably
  superseded by the spec on `main`. Keep or delete?

## Next recommended task

Owner: review/merge the M3 PR and do the phone check. Then M4 Devices (simulated) needs a
brainstorm → design → plan (product spec §11; `docs/TASKS.md` "Later milestones").
