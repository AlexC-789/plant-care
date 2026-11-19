# Current state

_Last updated: 2026-11-18 (M4 done on `m4-devices`, PR to `main` open; hosted deploy waits for the owner)._
Update this file at the end of every substantial task. Detail and history live in
`docs/LOCAL_MIGRATION_HANDOFF.md` (cloud → local handoff, 2026-11-18) and the specs/plans; this
file is the short, current summary.

## Status

- `main` = `73eadcc`. M1–M3 merged. M4 done on branch `m4-devices` (PR #9 open) and deployed to hosted
  (2026-11-19: both M4 migrations pushed, `device-claim` + `device-sync` deployed `--no-verify-jwt`;
  hosted PG 17; without an `apikey` header an unknown code → 404 and an unknown secret → 410, so the
  gateway, the tables and the service_role grants work). Owner phone check on mobile data still owed.
  The CLI login lacks `database_write`: `db push` needs `--password=…` (the `=` form; the password starts with `-`).
- **Direction E redesign, Phase 2 Home + plant page** (branch `design-e-home`, stacked on Phase 1; 2026-11-19).
  Specs: SCREEN_SPECIFICATIONS §11–12, UX_ARCHITECTURE §6 (latest design commit `cb52776` on `design-direction-e`,
  not yet on `main`). `status.ts`: one sentence per plant plus a plant-page headline + line, no middle dots;
  "no module", "waiting" and "wet" are Doing well; red (`now`) only for fault and tank. New `WaterLine`,
  `TankBar`, `HeroPhoto` (page-colour fade, frosted back/more via `expo-blur`, owner OK; room + red-state pills).
  Home: "{n} need(s) you" rows (ordered fault, tank, offline, battery), "doing well" 2-column grid (1 at
  accessibility sizes), "All {m} doing well", empty "No plants yet / Scan a plant", toolbar "Add a plant".
  Plant page: name, "{Latin}, {room}", headline + line, tank bar, Soil/Battery rows (no module: Set up a module,
  Check its health), "How watering works" sheet (`plant/[id]/watering`), ⋯ menu (Edit, Check its health,
  Remove module, Delete {name}), Resume watering in the BottomBar then "Waiting for the module…".
  Owner choices: photo strip stays until Phase 5 (it now shows health-check progress/errors); health card and
  About removed (with the latest-health query). Deferred (data not there yet, M5): Last drink, "about {n} days",
  Today's limit line, "Watering resumed"/"Back to normal", Pause watering; server-side counts; offline line.
  Review (code-reviewer): offline tank shows no current reading, menu backdrop + screen-reader modal, Resume
  "Sending…" + error line, tank level in Home row labels, hero shimmer stops if signing fails; all fixed test-first.
  Verified: Jest 337 (`--maxWorkers=2`; full 50% runs time out while other sessions load the machine),
  typecheck, lint, `db:test` 166, `fn:test`, `sim:test` 7. Not checked on a device.
- **Direction E redesign, Phase 1 Foundation** (branch `design-e-foundation`, based on `m4-devices`; 2026-11-19).
  Design package: `docs/design/` on PR #10 (`DESIGN_SYSTEM.md`, `DESIGN_ROADMAP.md` §1). New palette (ink on
  neutral page, blue only water, red only `statusNow`; `statusFine/Soon/Quiet`, `band`, `nowFill`, `soonFill`
  removed), Archivo static TTFs in `apps/mobile/assets/fonts/` (OFL; loaded by `useFonts` behind the splash,
  system font if loading fails), type scale `display` + six sizes (`title3`/`callout`/`caption1` removed),
  Button ink 52/14 with `line` (was `bordered`) and `plain`, Row secondary label + ink tabular value,
  StepProgress ink on track. Interim until Phase 2: Home status dot is red for `now`, grey otherwise;
  StatusBanner untinted. Verified: Jest 337, typecheck, lint, `db:test` 166, `fn:test`, `sim:test` 7.
  Not checked on a device or in the browser.
- **M4 Devices, simulated** (branch `m4-devices`). Spec `docs/superpowers/specs/2026-11-18-m4-devices-design.md`,
  plan `docs/superpowers/plans/2026-11-18-m4-devices.md`.
  - Cloud "digital twin": the module uploads raw readings/events, the cloud converts them (`_shared/twin.ts`)
    and sends instructions back. Module rules + compiled limits in `_shared/watering.ts` (≤ 40 ml/dose,
    ≤ 150 ml/24 h, float low = no pump, 2 no-rise doses = fault; state loss = budget used up); the sim
    imports it unchanged and the M7 firmware ports it.
  - DB: `device_claims` (12-char code, 15 min), `devices` (secret only as SHA-256, never readable),
    `readings`, `device_events`, `device_commands` (`clear_fault`); owner-only RLS, column grants,
    service_role grants asserted; `claim_device` RPC (service_role only).
  - Functions `device-claim`, `device-sync` (`verify_jwt = false`, bearer secret, 410 twice = unpaired,
    bad items skipped, idempotent upserts, ≤ 20 commands per reply).
  - Simulator `sim/` (zero deps, Node 22): `node sim/sim.ts --claim CODE [--scenario …]`; `npm run sim:test`.
  - App: Home status per plant + "Needs you / Doing well" (refetches on focus), plant detail banner +
    Module group (water vessel, soil, battery, check-in), Resume watering, Remove module, setup steps
    (code → tank). Real tank level sensor replaces "I refilled it" (part chosen in M7).
  - Reviews: every task reviewed (Opus for DB, functions, watering); final whole-branch Opus review →
    2 Important (> 20 pending commands broke sync; Home stale after setup) + minors fixed test-first.
  - Verified 2026-11-18: Jest 328, typecheck, lint, `db:test` 166, `fn:test`, `sim:test` 7; local e2e
    (web app + sim on local Supabase) 8/8 steps incl. claim, tank full, fault → Resume, Remove → sim
    unpairs; screenshots light + dark. App jest runs with `maxWorkers: '50%'` (full runs timed out).
- **M3 photo timeline + rescan** (merged). Spec `docs/superpowers/specs/2026-11-18-m3-photo-timeline-design.md`, plan
  `docs/superpowers/plans/2026-11-18-m3-photo-timeline.md`.
  - DB: `plant_photos` (owner-only RLS, insert grant on plant_id/path/taken_at only), trigger from
    `plants.photo_path`, backfill (keeps health `scan_id`, dedupes paths shared by several scans),
    `delete_plant_photo` RPC (locks the plant, promotes the next newest main photo).
  - `check-health` upserts its photos onto the timeline with `scan_id` (failure non-fatal).
  - App: timeline strip + Add a photo with an inline health-check offer on plant detail; full-screen
    viewer `plant/[id]/photos` (swipe, health result, What is it?, Delete); Edit has no photo controls;
    deleting a plant removes timeline photos too.
  - Reviews (Opus): Task 1 fixes approved; Tasks 2–3 found a two-device delete race → fixed with the
    RPC, re-review approved. Final whole-branch review: 1 Important (leaving the Health screen mid-check
    deleted photos the check put on the timeline) + 3 Minors fixed test-first; security pass clean.
  - Verified 2026-11-18: Jest 284, typecheck, lint, `fn:test` 72, `db:test` 103, e2e security script
    10/10 (Playwright installed outside the repo), web screenshots light + dark. Owner phone check owed.
  - Web dev server: `CI=1 npx expo start --web` does not watch files; restart it after edits.
  - Owner phone test on hosted (iPhone + a friend's Android, 2026-11-18) found and fixed, all on the PR:
    service_role grants (hosted grants nothing), execute on `species_search_text`, Android uploads were
    0 bytes (`fetch(file://).arrayBuffer()`; now base64 from the encoder, empty upload refused), health
    copy (cause named from 0.2; healthy < 0.5 with no cause → "cause unclear"). Owner: "everything works".
    Checks after: Jest 285, typecheck, lint, `fn:test`, `db:test` 110. e2e script not re-run.

## Completed (merged to `main`)

| PR | Branch | What |
|---|---|---|
| #1 | `claude/jolly-archimedes-v394b2` | Software + hardware spec, M1 plan, design/animation skills |
| #2 | `m1-foundation` | M1: monorepo, Expo app shell, local Supabase, auth, profiles + RLS, CI; email confirmation |
| #3 | `email-domain-check` | `before-user-created` hook (disposable / mail-less domains, fails open on DNS); UI foundation |
| #4 | `appearance-setting` | Light by default, Dark option in Settings; launch animation timing; loading rules |
| #5 | `m2-plant-library` | M2: plant library + detail, photos (private bucket, re-encoded), Plant.id identify / health / name search functions with limits, 190 curated species, 4-step add flow |
| #7 | `m3-photo-timeline` | M3: photo timeline + rescan; hosted Supabase set up; hosted/Android fixes from the phone test |

Plan checkboxes in `docs/superpowers/plans/` are not ticked; git history and this file are the record.

## Known bugs and limitations

Non-blocking items from the M2 reviews are listed in handoff §2.4 (name search for common names,
unconfirmed health-issue names, 92 unchecked species, count-then-call limit race,
`plants.setup_step` user-writable, "{n} need you" counts loaded pages only, orphan uploads,
`npm audit` noise in build tooling — never `npm audit fix --force`). Older deferred minors:
`docs/superpowers/handoff/2026-11-17-m2-handoff.md` (end). Device checks still owed by the owner:
handoff §2.4. Jest prints a worker-exit warning at the end (pre-existing; `-- --forceExit` if it hangs).

## Hosted Supabase (set up 2026-11-18, ahead of M4)

- Project "AlexC-789's Project", ref `qbbkzxbyxzogebaethpp`, eu-west-1, free plan; repo linked
  (`npx supabase link`). Schema = all migrations up to M3 (`20261118110000`), pushed from the M3 branch.
- Functions deployed: `identify-plant`, `check-health`, `search-plants`, `before-user-created`
  (`--no-verify-jwt`). Secrets: `PLANT_ID_API_KEY`, `BEFORE_USER_CREATED_HOOK_SECRET` (from the
  dashboard hook, not the local one in `config.toml`). Hook enabled and verified (mailinator rejected).
- Auth: email confirmation on, password min 8, built-in mailer (2 emails/h). `site_url` is still the
  default `http://localhost:3000`, so confirmation links land on a dead page after confirming;
  set a real site URL / redirect when there is one.
- `apps/mobile/.env.local` points at hosted; the local values are kept there as comments.
- Changing auth settings through the Management API needs `project_admin_write`; do them in the dashboard.
- Hosted gives `service_role` no table privileges, so every function failed with 42501 ("Something
  went wrong") until `20261118120000_service_role_grants.sql` + `…130000` (execute on
  `species_search_text`, which the generated `species.search_text` calls); identify verified 200 on hosted.
- Phone testing away from the LAN: `npx expo start --tunnel` (`@expo/ngrok` installed globally).

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

Owner: approve the hosted M4 deploy (`docs/TASKS.md` M4 item 1), then review/merge the M4 PR and check
the phone on mobile data. Then M5 Watering plans (brainstorm → design → plan).
