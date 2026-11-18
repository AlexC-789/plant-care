# Current state

_Last updated: 2026-11-18 (local Windows setup; Claude Code workflow on `chore/claude-code-workflow`)._
Update this file at the end of every substantial task. Detail and history live in
`docs/LOCAL_MIGRATION_HANDOFF.md` (cloud → local handoff, 2026-11-18) and the specs/plans; this
file is the short, current summary.

## Status

- `main` = `fc3e7b4` (PR #5 = M2, plus the migration handoff doc). M1 and M2 are done.
- **M3 photo timeline + rescan is in progress** on `m3-photo-timeline` (head `53de807`, no PR yet).
  - Spec: `docs/superpowers/specs/2026-11-18-m3-photo-timeline-design.md` (approved).
  - Plan: `docs/superpowers/plans/2026-11-18-m3-photo-timeline.md` (6 tasks).
  - Task 1 (`plant_photos` table, RLS, trigger, backfill) is committed, but its Opus security review
    returned **Needs fixes**: 2 Important findings are open (handoff §2.5, `docs/TASKS.md`).
  - That branch predates the handoff and this workflow setup: merge `main` into it before continuing.

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

- Node 24.11.1 installed; project and CI use Node 22 (`.nvmrc`). No version manager yet.
- Root `node_modules` is stale: `deno` and `supabase` dev dependencies are missing, so
  `npm run fn:test` and `npm run db:*` fail until `npm ci`. npm `script-shell` is unset (cmd.exe),
  which breaks `fn:test`'s POSIX loop. Fix: `docs/TASKS.md` T0.
- Passing on this branch: lint, typecheck, Jest (261 tests), pgTAP via `npx supabase test db`
  (71 tests on `main`'s schema). `fn:test` not run yet.
- Superpowers and Ponytail plugins are **not installed** locally. The handoff (§3.3) recommends
  installing both; waiting for the owner's go-ahead. Their rules are also in `CLAUDE.md`.

## Open decisions (owner)

- Install Superpowers + Ponytail plugins (handoff §3.3)?
- App UI design open questions 1–4 (`docs/superpowers/specs/2026-11-17-app-ui-design.md` §8).
- `origin/claude/busy-ride-ov5sv2`: 5 unmerged app-UI-design doc commits (2026-11-17), probably
  superseded by the spec on `main`. Keep or delete?

## Next recommended task

Finish T0 (local setup), merge `main` into `m3-photo-timeline`, then fix M3 Task 1's two Important
findings test-first with an Opus re-review (`docs/TASKS.md` M3).
