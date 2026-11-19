# QA Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playwright tests of the running web build against local Supabase + the module simulator, with a fake Plant.id, speed budgets, a compatibility/accessibility matrix, a flow-coverage gate, and CI (PR lane + nightly).

**Architecture:** Tests live in `apps/mobile/e2e/`, drive the Expo web build through accessible names, seed data through the service-role REST API, and run the real Edge Functions (Plant.id swapped for a local fake via `PLANT_ID_BASE_URL`). A zero-dependency script checks that every P1 flow in the inventory has a test. GitHub Actions runs `@pr` tests on every PR and everything nightly.

**Tech Stack:** `@playwright/test` (Chromium only), `@axe-core/playwright`, Node 22 built-ins (http, node:test), Supabase CLI, Expo SDK 58 web, Deno (Edge Functions).

**Spec:** `docs/superpowers/specs/2026-11-19-qa-pipeline-design.md` (approved 2026-11-19). Flow inventory: `docs/qa/2026-11-19-user-flows.md`.

## Global Constraints

- CLAUDE.md applies in full: TDD, root scripts, Node 22, one commit per task on branch `qa-pipeline`, never on `main`, never force-push.
- Work in a git worktree: `git worktree add .claude/worktrees/qa-pipeline -b qa-pipeline m4-devices`; run `npm ci` there. Never copy `supabase/functions/.env` into it.
- New dev dependencies allowed: `@playwright/test`, `@axe-core/playwright` (in `apps/mobile`). No others.
- Edge Functions keep zero runtime npm deps. `PLANT_ID_API_KEY` only in `supabase/functions/.env` (git-ignored). CI never calls Plant.id.
- Watering limits (≤ 40 ml/dose, ≤ 150 ml/24 h, no pump on float low, stop after 2 no-rise doses) are never relaxed.
- Locators: `getByRole` / `getByLabel` / `getByText` only. No CSS selectors, no `waitForTimeout`.
- Every test title starts with its flow ID(s) from the inventory, e.g. `D9 cancel deletes uploaded photos`. `@pr` in the title puts it in the PR lane.
- Each test creates its own user and data; no test depends on another.
- PR lane ≤ 10 min wall clock in CI.
- Speed budgets (spec §5.5): cold load → usable ≤ 2.5 s (static build); launch part ≤ 1,000 ms (`test.fail` until the redesign launch lands); tap → visible feedback ≤ 100 ms, next screen ≤ 1 s; cached revisit shows 0 skeletons; CLS ≤ 0.1; median of 3 runs.
- Matrix (spec §5.4): 375×667, 412×915, 820×1180; light + dark; `reducedMotion: 'reduce'`; 200 % zoom; slow + offline; no console errors; axe no serious/critical.

## Review Focus

- **Parallel tests share one fake Plant.id** — a test that switches the fake's answer must not leak into another worker's identify call (Task 1 + Task 5: branch scenarios run in a separate serial project).
- **Auth rate limits** — `sign_in_sign_ups = 30` per 5 min per IP would fail a full parallel run; Task 2 raises it for local/CI only and adds a test that 40 sign-ins in a row succeed.
- **The local `.env` holds the real Plant.id key** — a local run must refuse to start unless `PLANT_ID_BASE_URL` points at the fake (Task 2 test).
- **Stack screens stay mounted but hidden on web** — clicking `Continue` can hit a hidden earlier step; every multi-step test uses `clickVisible` (Task 2) and waits for the next step's header.
- **Leftover data** — a crashed test must not leave storage objects or users that break later runs; the `user` fixture deletes objects and the user in teardown even on failure (Task 2 test).

---

### Task 1: Fake Plant.id + `PLANT_ID_BASE_URL`

**Files:**
- Modify: `supabase/functions/_shared/plantid.ts:1` (BASE)
- Test: `supabase/functions/_shared/plantid_test.ts` (create if absent; else add to the existing test file for plantid)
- Create: `apps/mobile/e2e/fake-plantid.mjs`
- Test: `apps/mobile/e2e/fake-plantid.test.mjs`

**Interfaces:**
- Produces: `PlantIdClient` constructor option `baseUrl?: string` (default `Deno.env.get('PLANT_ID_BASE_URL') ?? 'https://plant.id/api/v3'` read where clients are built — `identify-plant/index.ts`, `check-health/index.ts`, `search-plants/index.ts` pass it in, matching how `plantIdApiKey` is passed).
- Produces: `startFakePlantId(port = 8787): Promise<{ url: string; setScenario(s: Scenario): void; calls(): number; close(): Promise<void> }>` and a `POST /__scenario` JSON endpoint `{ identify?: 'very_likely'|'low'|'not_plant'|'error', health?: 'healthy'|'issue'|'error' }`; `POST /__reset`. Default scenario `{ identify: 'very_likely', health: 'healthy' }`. Export `FAKE_PLANTID_PORT = 8787`.
- Canned answers: identify `very_likely` → suggestions `Calathea makoyana` (0.92, common name "Peacock plant"), `Calathea ornata` (0.04 — filtered by the 0.05 floor, proving the floor), `Maranta leuconeura` (0.30); `low` → top probability 0.30; `not_plant` → `is_plant.probability 0.1`; `error` → HTTP 500. Health `healthy` → `is_healthy 0.92`, no issues; `issue` → `is_healthy 0.2`, issue `Fungi` 0.7. `name_search` → one entity `Calathea makoyana` matched in common name "Peacock plant".

- [ ] **Step 1: Write the failing Deno test** `PlantIdClient uses baseUrl when given`: a fake `fetch` records the URL; `new PlantIdClient({ apiKey: 'k', fetch, baseUrl: 'http://fake:8787' }).identify(['x'])` → recorded URL starts with `http://fake:8787/identification`. Second test: without `baseUrl` the URL starts with `https://plant.id/api/v3/`.
- [ ] **Step 2: Run** `npm run fn:test` → FAIL (option ignored).
- [ ] **Step 3: Implement** the `baseUrl` option and pass `Deno.env.get('PLANT_ID_BASE_URL')` from the three function entry points.
- [ ] **Step 4: Run** `npm run fn:test` → PASS (all existing function tests still pass).
- [ ] **Step 5: Write the failing node:test** in `fake-plantid.test.mjs`: start on port 0; `POST /identification?details=…` returns `result.classification.suggestions[0].name === 'Calathea makoyana'`; after `setScenario({ identify: 'not_plant' })` the same call returns `result.is_plant.probability < 0.5`; `error` returns status 500; `/health_assessment` healthy → `result.is_healthy.probability > 0.5`; `calls()` counts requests.
- [ ] **Step 6: Run** `node --test apps/mobile/e2e/fake-plantid.test.mjs` → FAIL.
- [ ] **Step 7: Implement** `fake-plantid.mjs` with `node:http` only; also runnable as `node apps/mobile/e2e/fake-plantid.mjs` (listens on 8787).
- [ ] **Step 8: Run** the node test → PASS.
- [ ] **Step 9: Commit** the docs created during design (`docs/qa/2026-11-19-user-flows.md`, `docs/qa/reports/`, `docs/qa/research_notes/`, the spec, this plan — copy them from the main folder into the worktree) and this task: `feat(qa): fake Plant.id and PLANT_ID_BASE_URL`.

### Task 2: Playwright setup, support helpers, spike + decision point

**Files:**
- Modify: `apps/mobile/package.json` (devDeps via `npm i -D -w apps/mobile @playwright/test @axe-core/playwright`; scripts `e2e`, `e2e:pr`, `e2e:speed`), root `package.json` (scripts `e2e`, `e2e:pr`, `e2e:speed`, `qa:coverage`, `qa:test`), `apps/mobile/jest.config.js:6` (ignore `/e2e/`), `supabase/config.toml` `[auth.rate_limit] sign_in_sign_ups = 1000` (local/CI only; hosted is set in the dashboard — restart Supabase after), `.gitignore` (`apps/mobile/test-results/`, `apps/mobile/playwright-report/`, `apps/mobile/dist/`).
- Create: `apps/mobile/playwright.config.ts`, `apps/mobile/e2e/global-setup.ts`, `apps/mobile/e2e/support.ts`, `apps/mobile/e2e/smoke.spec.ts`
- Delete: nothing yet (`m2-security.mjs` goes in Task 4).

**Interfaces:**
- Consumes: `startFakePlantId`, `FAKE_PLANTID_PORT` (Task 1).
- Produces (`support.ts`):
  - `test` = base test extended with fixtures `admin: Admin` (worker scope) and `user: TestUser` (test scope: confirmed user via `POST /auth/v1/admin/users`, email `e2e-<uuid8>@gmail.com`, password `e2e-password-1`; teardown deletes every `plant-photos/<uid>/*` object then the user, also on failure). Re-export `expect`.
  - `type TestUser = { id: string; email: string; password: string }`
  - `class Admin { rest(path: string, init?: RequestInit): Promise<Response>; createUser(): Promise<TestUser>; deleteUser(u: TestUser): Promise<void>; seedPlant(uid: string, p: { name: string; room?: string; withPhoto?: boolean; speciesId?: string }): Promise<{ id: string; photoPath?: string }>; seedPhoto(uid: string, plantId: string, takenAt?: string): Promise<string>; seedDevice(uid: string, plantId: string, f: Partial<DeviceRow>): Promise<{ id: string }>; seedScans(uid: string, n: number, kind?: 'identify'|'health'): Promise<void>; listObjects(uid: string): Promise<string[]> }` — `seedDevice` sets a random 64-hex `secret_hash`; `seedPhoto` uploads `FIXTURE_JPEG` re-encoded-free (bytes as is) to `<uid>/<uuid>.jpg` and inserts a `plant_photos` row; users made with `createUser` are deleted by the worker teardown.
  - `signIn(page: Page, u: TestUser): Promise<void>` — UI sign-in, waits for the Plants header.
  - `clickVisible(page: Page, name: string): Promise<void>` — clicks `role=button[name=…] >> visible=true`.
  - `startSim(o: { code: string; name: string; scenario?: string; from?: '1d'|'6h'; speed?: number }): Promise<{ stop(): Promise<void> }>` — spawns `node sim/sim.ts --claim … --name … --url $SUPABASE_URL`; `stop` kills it and deletes `sim/.devices/<name>.json`.
  - `mailpitLink(email: string): Promise<string>` — polls `http://127.0.0.1:54324/api/v1/search?query=to:"<email>"` (expect.poll, ≤ 10 s), returns the first `http…/auth/v1/verify…` link in the message text.
  - `FIXTURE_JPEG` (absolute path to `e2e/fixtures/gps-plant.jpg`), `hasExifGps(buf: Buffer): boolean` (moved from `m2-security.mjs`).
- Produces (`global-setup.ts`): reads `npx supabase status -o env` into `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; **throws** unless `supabase/functions/.env` has `PLANT_ID_BASE_URL` pointing at port 8787; starts the fake (stopped in teardown).
- Produces (`playwright.config.ts`): `testDir: 'e2e'`, Chromium only, `use.baseURL: 'http://localhost:8081'`, viewport 390×844, `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, `retries: process.env.CI ? 1 : 0`, `forbidOnly: !!process.env.CI`, reporters `list` + `html` (+ `github` in CI). `webServer`: `CI=1 npx expo start --web --port 8081` with `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY`/`EXPO_PUBLIC_EMAIL_CONFIRMED_URL=http://localhost:8081/email-confirmed`, `reuseExistingServer: !process.env.CI`, timeout 180 s. Projects: `main` (everything except `*.branches.spec.ts`, `speed.spec.ts`), `plantid-branches` (`*.branches.spec.ts`, `dependencies: ['main']`, `fullyParallel: false`), `speed` (only when `E2E_SPEED=1`; own static `webServer` added in Task 11).

- [ ] **Step 1: Write the failing spike tests** in `smoke.spec.ts`:
  - `A2 @pr signed-in cold start shows Plants`: `signIn` → `expect(page.getByRole('header', { name: 'Plants' }).or(page.getByText('Plants'))).toBeVisible()`.
  - `D5 @pr identify goes through the fake Plant.id`: seed nothing; add flow with `FIXTURE_JPEG` via file chooser → Continue → `Identify from my photo` → `expect(page.getByText("It's a Peacock plant.")).toBeVisible()`; then `admin.rest('/rest/v1/scans?user_id=eq.<uid>&kind=eq.identify')` returns 1 row.
  - `infra user fixture cleans up on failure`: a nested run is overkill — instead assert in `afterAll` of a describe that the users created by that describe no longer exist (`GET /auth/v1/admin/users/<id>` → 404) and `listObjects` is empty.
  - `infra 40 sign-ins in a row succeed`: 40 × `POST /auth/v1/token?grant_type=password` for one user → all 200.
- [ ] **Step 2: Run** `npm run db:start` (after the config change: `npx supabase stop` first), put `PLANT_ID_BASE_URL=http://host.docker.internal:8787` and `PLANT_ID_API_KEY=fake` in the worktree's own `supabase/functions/.env` (local runs: the owner's main-folder file is not touched), then `npm run e2e -- smoke.spec.ts` → FAIL before helpers exist, then implement.
- [ ] **Step 3: Implement** config, global setup, support helpers, scripts, jest ignore, gitignore.
- [ ] **Step 4: Run** `npm run e2e -- smoke.spec.ts` → 4 PASS. Also check the guard: with `PLANT_ID_BASE_URL` removed, `npm run e2e` exits with the guard's message and no request reaches plant.id.
- [ ] **Step 5: DECISION POINT.** If `D5` can't reach the fake from the Edge Runtime: try adding the host-gateway mapping (`[edge_runtime]` settings / `--add-host`) once; if still unreachable, switch the identify/health tests to `page.route('**/functions/v1/identify-plant', …)` returning the function's response shape, mark spec §4 fallback as taken in the spec, and report to the lead before continuing.
- [ ] **Step 6: Run** `npm test`, `npm run typecheck`, `npm run lint` → PASS (e2e files typecheck and lint; Jest ignores them).
- [ ] **Step 7: Commit** `feat(qa): Playwright setup, helpers and smoke tests`.

### Task 3: Flow-coverage gate

**Files:**
- Create: `scripts/check-flow-coverage.mjs`, `scripts/check-flow-coverage.test.mjs`
- Modify: `docs/qa/2026-11-19-user-flows.md` (add section `## Not covered by e2e` with lines `- F6: fn:test + sim:test (watering limits)`, `- I3: db:test (column grants)`, `- F8: not built (M7)`, plus each Native-only flow ID with "native, stage 2").

**Interfaces:**
- Produces: `checkCoverage(inventoryMd: string, testSources: string[]): { missingP1: string[]; gapsOther: string[] }`; CLI `node scripts/check-flow-coverage.mjs` reads the inventory + `apps/mobile/e2e/**/*.spec.ts`, prints both lists, exits 1 when `missingP1` is non-empty.
- Rules: inventory rows `| <ID> | … | <Where> | <P> |` with ID `/^[A-Z]\d+$/`; skip IDs starting with `N` (planned) and section J (no P column). A row is in scope when Where contains `Web` or `Sim`. Tested IDs = every leading ID in a `test(`/`test.fail(` title: `/^((?:[A-Z]\d+ )+)/`. Excused IDs = `- <ID>:` lines under `## Not covered by e2e`. P column "starts with P1" → P1.

- [ ] **Step 1: Write failing node:tests:** (a) a P1 Web row with no test → in `missingP1`; (b) same row with test title `'D9 @pr cancel …'` → not missing; (c) a title `'D9 D10 …'` covers both; (d) excused `- F6: …` → not missing; (e) `N3` row ignored; (f) P2 untested → in `gapsOther`, exit stays 0; (g) row with Where `Native` only → ignored; (h) `P1 (grant)` counts as P1.
- [ ] **Step 2: Run** `npm run qa:test` → FAIL.
- [ ] **Step 3: Implement** the script.
- [ ] **Step 4: Run** `npm run qa:test` → PASS. Run `npm run qa:coverage` → exits 1 listing today's missing P1s (expected until Task 10; CI wiring waits for Task 12).
- [ ] **Step 5: Commit** `feat(qa): flow coverage gate`.

### Task 4: Security and cleanup (`security.spec.ts`)

**Files:**
- Create: `apps/mobile/e2e/security.spec.ts`
- Delete: `apps/mobile/e2e/m2-security.mjs` (its checks move here 1:1); update the CLAUDE.md line that names it (in Task 12).

**Interfaces:**
- Consumes: `test`, `admin`, `user`, `signIn`, `clickVisible`, `FIXTURE_JPEG`, `hasExifGps` (Task 2).

Tests (all `@pr`), assertions:
- [ ] `D4 @pr upload is JPEG without GPS`: fixture has GPS; after choosing it in the add flow, the single stored object starts `FF D8` and `!hasExifGps`.
- [ ] `D4 @pr bucket rejects PNG and over 3 MB`: with the user's access token: JPEG accepted (control), PNG rejected, 3 MB + 1 byte rejected.
- [ ] `H2 @pr deleting a plant leaves no photos, scans or timeline rows`: port of m2 part (b); after "No plants yet" use `expect.poll(() => admin.listObjects(uid)).toEqual([])` (no fixed wait), scans and plant_photos empty.
- [ ] `D9 @pr cancel at each step deletes uploaded photos`: three sub-cases (step 1, 2, 3 Cancel) → `expect.poll(listObjects).toEqual([])` and no `plants` rows.
- [ ] `D10 leaf photo is deleted after save when identify was not used`: add whole + leaf, skip identify, save → only the whole photo remains.
- [ ] `G4 @pr deleting a photo removes it and promotes the next newest`: seed plant with 2 timeline photos; viewer → Delete photo → Delete → object gone, `plants.photo_path` = the other path; deleting the last one closes the viewer.
- [ ] `E2 @pr another user's plant shows nothing`: user B's plant id opened by user A → `—` header, no B name anywhere.
- [ ] `A6 @pr signed-out deep links redirect to sign in`: `/plant/<id>`, `/settings` → Sign in screen.
- [ ] `B9 @pr sign-out clears the cache`: user A sees plant "Fern A"; Settings → Sign out; sign in as user B (second `user` via `admin`) → "Fern A" never visible, "No plants yet" shown; Back doesn't return to A's screens.
- [ ] Run `npm run e2e -- security.spec.ts` → all PASS; then `git rm apps/mobile/e2e/m2-security.mjs`.
- [ ] Commit `test(qa): security and cleanup flows`.

### Task 5: Account flows (`auth.spec.ts`, `auth.branches.spec.ts`)

**Files:** Create `apps/mobile/e2e/auth.spec.ts`.

Tests:
- [ ] `B1 B5 @pr sign up, confirm by email, sign in`: UI sign-up with a fresh `e2e-<uuid8>@gmail.com` → Sign in screen shows the confirmation-sent notice and the email pre-filled; `mailpitLink(email)` → open it → "Email confirmed"; Sign in → Plants. Teardown deletes the user via admin.
- [ ] `B5 used link shows Link expired`: open the same link twice → second shows "Link expired".
- [ ] `B2 invalid input shows field errors and sends nothing`: empty email; `bad`; 7-char password → messages from `src/auth/validation.ts`; Mailpit has no message for that address.
- [ ] `B3 existing email`: sign up with the `user` fixture's email → "An account with this email already exists. Sign in instead."
- [ ] `B4 disposable and no-mail domains are blocked`: `x-<uuid8>@mailinator.com` → `DISPOSABLE_MESSAGE` text from `apps/mobile/src/auth/authErrors.ts`; `x-<uuid8>@example.com` → `NO_MAIL_MESSAGE` text.
- [ ] `B6 sign in before confirming offers resend with cooldown`: unconfirmed user → "Confirm your email first…"; Resend → "Confirmation email sent to <email>."; button shows the 60 s cooldown (use `page.clock` to advance 60 s → enabled again).
- [ ] `B7 @pr wrong password and double tap`: wrong → "Email or password is incorrect."; double-click Sign in with correct password → one session (Plants shown, no error).
- [ ] `B8 footer links switch screens without stacking`: Sign in → Sign up → Sign in; browser Back leaves the auth area (no loop).
- [ ] `A4 expired session lands on sign in`: signed in; revoke via `POST /auth/v1/admin/users/<id>/logout` or delete the user's sessions via admin, then reload → Sign in; cached plant names not visible.
- [ ] `A7 opening sign in while signed in goes home`.
- [ ] Run → PASS. Commit `test(qa): account flows`.

### Task 6: Add-a-plant flows (`add.spec.ts`, `add.branches.spec.ts`)

**Files:** Create `apps/mobile/e2e/add.spec.ts`, `apps/mobile/e2e/add.branches.spec.ts`.

Tests in `add.spec.ts`:
- [ ] `D1 @pr happy path`: photo → Identify (fake: Peacock plant applied automatically) → Where: room "Living room", nickname "Stripes" → Continue → health offer → "Check its health now" → result shows the fake's healthy note → Done → plant detail "Stripes"; Plants home lists "Stripes".
- [ ] `D2 photo step rules`: Continue disabled until whole photo; add, Remove and Skip an optional card.
- [ ] `D5 @pr identify limit`: `admin.seedScans(uid, 20)` → identify → the limit text from `identify.tsx` (`LIMIT`).
- [ ] `D6 search and custom type`: "I know it — search" → type "Peacock" → pick → "It's a Peacock plant."; again with "Mystery fern" → `Use “Mystery fern” as the type`.
- [ ] `D7 skip type requires a name`: Skip → "Not sure? You can set it later."; Where shows Name (required) and Continue disabled until filled.
- [ ] `D8 @pr double tap saves one plant; save failure retries`: double-click Continue → exactly 1 `plants` row; failure: `page.route('**/rest/v1/plants*', r => r.abort(), { times: 1 })` → "Couldn't save your plant. Try again." → Continue → saved.
- [ ] `D11 @pr problem photo starts the check; Done keeps the plant`: add whole + problem photos → health check starts by itself → result → Done → plant detail.
- [ ] `D12 @pr going back after save never makes a second plant`: after save, browser Back twice → health step shown again; 1 `plants` row.

Tests in `add.branches.spec.ts` (serial project; each sets the fake scenario first and calls `__reset` after):
- [ ] `D5 not a plant`: scenario `not_plant` → "Couldn't tell from this photo…"
- [ ] `D5 low confidence shows choices`: scenario `low` → up to 3 suggestions, none auto-applied; pick one → "It's a …".
- [ ] `D11 failed check offers Try again`: scenario `health: 'error'` → "Couldn't check right now." + "Try again"; Skip for now → detail; problem photo removed from storage.
- [ ] Run → PASS. Commit `test(qa): add-a-plant flows`.

### Task 7: Home and plant detail (`home.spec.ts`, `detail.spec.ts`)

**Files:** Create both.

**Interfaces:** Consumes `admin.seedPlant`, `admin.seedDevice`. Status seeds (times relative to now; copy from `apps/mobile/src/devices/status.ts`):

| Key | Device fields | Expected line |
|---|---|---|
| setup | no device | `Setup isn't finished · Add its module` |
| waiting | `last_seen_at: now`, `reading_ts: null` | `Waiting for its first check-in` |
| fault | `fault_code: 'no_moisture_rise'`, `last_seen_at: now` | `Watering stopped · Check the stake is in the soil` |
| tank | `float_low: true`, `last_seen_at: now` | `Tank needs refilling` |
| offline | `last_seen_at: now − 4 h`, `sync_interval_s: 3600` | starts `Not heard from since` |
| wet | `reading_ts: now`, `soil_pct: 70` | `Soil is very wet · Watering is on hold` |
| battery | `reading_ts: now`, `soil_pct: 45`, `battery_pct: 10` | `Battery is low · Charge it this week` |
| fine | `reading_ts: now`, `soil_pct: 45`, `battery_pct: 80` | `Doing well · Still learning how fast it drinks` |

Tests:
- [ ] `C1 empty library`: "No plants yet" + "Add a pot" opens step 1.
- [ ] `C2 C3 C4 loading, failure, cache`: route `**/rest/v1/plants*` delayed 1 s → skeleton appears (Loading) then rows; aborted with no cache → "Couldn't reach Plant Care…" + Try again works; aborted after a successful load + reload → cached rows still shown.
- [ ] `C5 C6 @pr each status shows its line and section`: seed one plant per row of the table → each line visible; summary `N need you · M doing well` matches `needsYou` (everything but `fine`); "Needs you" header present.
- [ ] `C7 paging`: seed 45 plants → scroll to the end → the 45th name visible.
- [ ] `C8 pull to refresh and refocus`: seed a plant while home is open → open detail → back → new plant visible.
- [ ] `C9 header buttons`: "Add a pot" and "Settings" open their screens.
- [ ] `E1 detail view`: name, type, room, pot drawing when no photo; unknown id → "—".
- [ ] `E3 @pr menu: edit, remove module, cancel`: More options → Edit plant opens edit; with a device: Remove module → Cancel keeps it; Remove → `devices` row gone, status back to setup.
- [ ] `E4 module card values`: device `water_left_ml: 430, soil_pct: 40, battery_pct: 80, last_seen_at: now` → "About 450 ml left", "Damp · 40 %", battery value, a time for "Checked in"; `float_low` → "Needs refilling"; device load aborted → card with "—".
- [ ] `E5 @pr fault then Resume watering`: seeded fault → banner text from `status.ts` → "Resume watering" → "Resumes at the next check-in…"; `device_commands` has one unacked row for the device.
- [ ] `E6 about this plant` shows when a species is set (seed `species_id` from the seeded `species` table).
- [ ] Run → PASS. Commit `test(qa): home and plant detail`.

### Task 8: Module with the simulator (`module.spec.ts`)

**Files:** Create `apps/mobile/e2e/module.spec.ts`.

Tests:
- [ ] `F1 @pr claim with the simulator`: plant with no device → "Add its module" → code visible (`XXXX XXXX XXXX`) → `startSim({ code, name: 'e2e-<uuid8>' })` → screen becomes "Fill the tank"; back on home the plant no longer says setup unfinished.
- [ ] `F4 @pr fill the tank`: continue F1 with a sim that reports a full tank (scenario `normal`; else seed `water_left_ml: 700`) → "The tank is full." → returns to detail. `Done` before full also returns.
- [ ] `F2 code expires`: `page.clock.install()` before opening setup; `fastForward('16:00')` → "This code expired." → New code → a different code.
- [ ] `F3 code failure`: route `**/rest/v1/device_claims*` abort once → "Couldn't make a code. Try again." → Try again → code.
- [ ] `F5 @pr simulator states reach the app`: for scenarios `tank-empty` and `battery-low` (with `--from 6h --speed 600`), detail shows the matching line from the Task 7 table within 60 s (`expect.poll`, interval 2 s).
- [ ] `F7 @pr remove module unpairs the simulator`: claimed sim → Remove module → Remove → sim process exits after two 410s (await its exit ≤ 60 s) → plant shows setup again.
- [ ] Run → PASS. Commit `test(qa): module flows with the simulator`.

### Task 9: Photos, health, edit, settings (`photos.spec.ts`, `edit.spec.ts`, `settings.spec.ts`)

Tests:
- [ ] `G1 timeline strip`: 3 seeded photos newest first; "See all" opens viewer at index 0; tapping the 2nd thumbnail opens at index 1.
- [ ] `G2 add a photo from detail`: Choose from library → new main photo → inline "Check its health" / "Not now"; Not now hides it.
- [ ] `G3 viewer`: date + health text for a photo with a health scan; `?start=25` with 30 photos loads the further page; aborted load → "—".
- [ ] `G5 what is it`: viewer → "What is it?" → pick Peacock plant → "Plant type updated."; plant's `species_id` set.
- [ ] `G6 @pr health check from detail`: Check its health → Check disabled until whole photo → Check → result → Done; leaving before checking deletes uploaded photos (`expect.poll(listObjects)` back to the seeded set).
- [ ] `G7 health card states`: no check yet → offer; seeded health scan → its result text.
- [ ] `H1 edit`: rename, change type via search, room → saved on detail; empty name → "Give it a name (up to 60 characters)."; save aborted → "Couldn't save that. Try again."
- [ ] `I1 appearance persists`: Dark → reload → still dark (`html` background matches the dark token: read via `page.evaluate(getComputedStyle(document.body).backgroundColor)` and compare to the light value — must differ).
- [ ] `A3 stored dark shows dark from the first frame`: `addInitScript` stores Dark → on load, sample `body` background in the first `requestAnimationFrame` → dark value, never the light one.
- [ ] `I2 units`: Metric → `profiles.units = 'metric'`.
- [ ] `I3 I4 plan and account`: "Free (testing)", email shown; Sign out covered by B9.
- [ ] Run → PASS. Commit `test(qa): photos, health, edit and settings`.

### Task 10: Compatibility and accessibility matrix (`matrix.spec.ts`)

**Files:** Create `apps/mobile/e2e/matrix.spec.ts`.

**Interfaces:** `screens: { name: string; open(page, ctx): Promise<void> }[]` for Home (2 seeded plants), plant detail (with device), add step 1–3, settings, module setup. Sizes `[[375,667],[412,915],[820,1180]]`, appearance `['light','dark']` (set via `localStorage` key used by `src/theme/appearance.ts` before load, `page.addInitScript`).

Tests (generated per screen × size × appearance; one combination tagged `@pr`: Home, 412×915, light):
- [ ] `J1 J3 <screen> <size> <appearance> renders cleanly`: no `console.error` / `pageerror` (collected via listeners); every visible button and link has an accessible name; the primary action button's bounding box is fully inside the viewport (after scrolling it into view) and not overlapped (`elementFromPoint` at its centre is the button or a child).
- [ ] `J4 <screen> <appearance> axe`: `new AxeBuilder({ page }).analyze()` → no `serious`/`critical` violations.
- [ ] `J5 reduce motion keeps skeletons still`: `reducedMotion: 'reduce'` + delayed plants route → skeleton visible and its transform unchanged across two animation frames.
- [ ] `J2 200 % zoom`: `document.documentElement.style.zoom = '2'` at 412×915 → same "renders cleanly" assertions.
- [ ] `J6 slow and offline`: backend routes delayed 3 s → skeleton then content, never a blank body (`body.innerText` non-empty at 500 ms); `context.setOffline(true)` with no cache → "—" or the error copy with a working "Try again" after going online.
- [ ] Run → PASS (fix real app bugs found only with the lead's OK; otherwise `test.fail` with a TASKS.md pointer). `npm run qa:coverage` → exit 0. Commit `test(qa): compatibility and accessibility matrix`.

### Task 11: Speed budgets (`speed.spec.ts` + static server)

**Files:**
- Create: `apps/mobile/e2e/serve-static.mjs` (node:http; serves `apps/mobile/dist`, falls back to `index.html`; port 8082), `apps/mobile/e2e/serve-static.test.mjs`, `apps/mobile/e2e/speed.spec.ts`
- Modify: `apps/mobile/playwright.config.ts` (when `E2E_SPEED=1`: second `webServer` `npx expo export --platform web && node e2e/serve-static.mjs`, `speed` project with `baseURL: 'http://localhost:8082'`); app script `e2e:speed` = `E2E_SPEED=1 playwright test --project speed`.

**Interfaces:** `BUDGETS = { coldLoadMs: 2500, launchMs: 1000, tapFeedbackMs: 100, nextScreenMs: 1000, cls: 0.1 }` exported from `speed.spec.ts`; `median(xs: number[]): number`.

- [ ] **Step 1: Failing node:test** for `serve-static.mjs`: `/` and `/plant/abc` both return the index.html body; `/_expo/static/js/x.js` returns that file with `content-type` JavaScript; `/../package.json` → 404 (no path traversal).
- [ ] **Step 2: Run → FAIL; implement; run → PASS.**
- [ ] **Step 3: Speed tests** (each measured 3 times, median compared):
  - `A2 cold load to usable home ≤ 2.5 s`: fresh context, signed-in storage state, `goto('/')` → time until the first plant row is visible.
  - `A1 launch animation ≤ 1 s` as `test.fail` with comment `shortcut: launch is ~1.45 s until redesign launch (PR #10) lands; remove .fail then`.
  - `C5 tap feedback ≤ 100 ms and next screen ≤ 1 s`: tap a plant row → `performance.now()` deltas to the row's pressed state / detail header (via `page.evaluate` with a `MutationObserver`).
  - `C8 cached revisit shows no skeleton`: home → detail → back → no element with the Loading announcement appears (listen for 1 s).
  - `J7 layout shift ≤ 0.1` on home, detail, add step 1: `PerformanceObserver({ type: 'layout-shift', buffered: true })` sum of values without recent input.
- [ ] **Step 4: Run** `npm run e2e:speed` → PASS (the launch test reported as expected failure).
- [ ] **Step 5: Commit** `test(qa): speed budgets on the static web build`.

### Task 12: CI, scripts, docs, PR

**Files:**
- Modify: `.github/workflows/ci.yml` (new `e2e` job), `CLAUDE.md` (commands + rule), `docs/CURRENT_STATE.md`, `docs/TASKS.md`
- Create: `.github/workflows/nightly.yml`

- [ ] **Step 1: `ci.yml` job `e2e`** (`ubuntu-latest`, `timeout-minutes: 20`): checkout → setup-node 22 + npm cache → `npm ci` → `npm run qa:test` → `npm run qa:coverage` → cache `~/.cache/ms-playwright` → `npx playwright install --with-deps chromium` (workdir `apps/mobile`) → write `supabase/functions/.env` with `PLANT_ID_BASE_URL=http://host.docker.internal:8787` and `PLANT_ID_API_KEY=fake` → `npx supabase start` → `npm run e2e:pr` → on failure upload `apps/mobile/playwright-report` and `apps/mobile/test-results` (7 days).
- [ ] **Step 2: `nightly.yml`**: `on: schedule: cron '23 3 * * *'` + `workflow_dispatch`; same setup; `npm run e2e` then `npm run e2e:speed`; upload the report always.
- [ ] **Step 3: Push the branch and watch the PR-lane run** (`gh run watch`). Expected: green, wall clock ≤ 10 min. If over: trim `@pr` tags (keep D4, H2, D9, E2, B9, D1, F1) and say which in the PR.
- [ ] **Step 4: Trigger nightly once** (`gh workflow run nightly.yml --ref qa-pipeline`) → green or failures reported in the PR.
- [ ] **Step 5: CLAUDE.md**: add `npm run e2e` · `npm run e2e:pr` · `npm run e2e:speed` · `npm run qa:test` · `npm run qa:coverage` to Commands with the `.env` note (`PLANT_ID_BASE_URL` must point at the fake; `npm run db:start` first); replace the `m2-security.mjs` line with `apps/mobile/e2e/security.spec.ts`; add the rule "UI changes keep `npm run e2e:pr` green and update `docs/qa/2026-11-19-user-flows.md`; a new flow gets its test in the same PR."
- [ ] **Step 6: Docs**: CURRENT_STATE (QA pipeline status, counts, what ran); TASKS: skeleton minimum display ≈ 400 ms (`useDelayedVisible`), `FadeIn` native driver check, stage 2 (Maestro/Flashlight after redesign Phase 3), any `test.fail` items from Task 10.
- [ ] **Step 7: Run all checks**: `npm test`, `npm run typecheck`, `npm run lint`, `npm run db:test`, `npm run fn:test`, `npm run sim:test`, `npm run qa:test`, `npm run qa:coverage`, `npm run e2e`, `npm run e2e:speed` → all PASS (name any that couldn't run).
- [ ] **Step 8: Whole-branch review** with `code-reviewer`, `model: "opus"` (touches an Edge Function and auth config). Fix confirmed issues test-first.
- [ ] **Step 9: Commit, push, PR** to `main` (base note: depends on #9 for M4 flows): what changed, what was verified, what is open.
