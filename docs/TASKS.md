# Tasks

_Last updated: 2026-11-18._ Open work only; finished work moves to `docs/CURRENT_STATE.md`.
Requirements come from the specs (`docs/superpowers/specs/`) and plans; this list never changes
them. Priority: P1 now, P2 next, P3 later.

## T0 — Local dev setup (P1, owner; no dependencies)

Handoff §7 has the full list. Still open on this PC:
1. Node 22: `winget install CoreyButler.NVMforWindows`, open a new terminal, `nvm install 22`,
   `nvm use 22` (or install Node 22 LTS directly). `node --version` → `v22.x`.
2. Git Bash for npm scripts (one-time):
   `npm config set script-shell "C:\Program Files\Git\bin\bash.exe"`
3. Repo root: `npm ci` (installs `deno` 2.9.6 and `supabase` 3.2.0).
4. Check: `npx deno --version`, `npx supabase --version`.
5. Env files from handoff §5.3 (`apps/mobile/.env.local` exists; `supabase/functions/.env` exists).
6. GitHub CLI for PRs: `winget install GitHub.cli`, new terminal, `gh auth login`.
7. Optional: Playwright for the e2e script (handoff §5.5).
8. Optional, account-wide: disconnect unused connectors at claude.ai/customize/connectors
   (this repo already blocks them locally).

**Done when** `npm test`, `npm run typecheck`, `npm run lint`, `npm run fn:test` and
`npm run db:test` all run locally.

## M3 — Photo timeline + rescan (P1, in progress on `m3-photo-timeline`)

Spec `docs/superpowers/specs/2026-11-18-m3-photo-timeline-design.md`; plan
`docs/superpowers/plans/2026-11-18-m3-photo-timeline.md`; ledger summary in handoff §2.5.
Depends on T0 (Docker + `db:test`). First: merge `main` into the branch.

1. **Task 1 fixes** (P1, backend, Opus re-review: RLS + migration):
   - Backfill keeps `scan_id` when a health-scan photo is also the plant's main photo
     (`on conflict (plant_id, path) do update … where … scan_id is null`) + pgTAP fixture asserting it.
   - Cross-user delete test must assert something (B's row still exists after A's delete).
   - _Done when_ both have failing-then-passing pgTAP tests and the re-review passes.
   - Deferred minors: trigger tested as user A too; `backfill_plant_photos()` stays security definer.
2. **Task 2** `check-health` upserts timeline rows with `scan_id`. Depends on 1.
3. **Task 3** app data layer: fetch / add / delete photo; `deletePlant` gathers timeline paths
   (Opus review: deletion). Depends on 1.
4. **Task 4** timeline strip + Add a photo (inline health check offer, ruling R1) + Edit loses
   photo controls. Depends on 3.
5. **Task 5** full-screen viewer `plant/[id]/photos` with What is it? and Delete. Depends on 3.
6. **Task 6** e2e, docs, verification, screenshots. Depends on 2–5.
7. **Finish:** final whole-branch review (Opus), `security-review`, PR to `main`; owner merges.

Tasks 4 and 5 touch different routes and could run in parallel once 3 is in (check shared files first).

## Later milestones (P3; product spec §11, in order)

- **M4 Devices (simulated):** device-claim, device-sync, simulator, live status, water-left
  estimate, battery, "I refilled it"; hosted Supabase (README "Hosted project" steps). Depends on M3.
- **M5 Watering plans:** generator, plan display, watering preference; inside safety limits.
- **M6 Alerts & reminders:** push notifications, care reminders, away mode.
- **M7 Firmware:** ESP32-C3, same protocol and safety limits; pairing + calibration.
- **M7b Guided scan:** needs Apple Developer account + EAS dev build.
- **M8 Store readiness:** social sign-in, RevenueCat, privacy policy, account deletion, EAS builds.

## Housekeeping (P2, any time)

- Owner decisions in `docs/CURRENT_STATE.md` → "Open decisions".
- Device checks owed from M2 (handoff §2.4).
- Known minors: fix only when touching that code, test first.
