# QA pipeline design

_2026-11-19. Owner-approved direction: approach A (browser first, phones later), Playwright as a
dev dependency._

## 1. Why

Unit tests (Jest, ~330, Supabase mocked) and the owner's own checks both miss things. The owner
wants a second net that tests the **running app** the way a user uses it, not only the code, and
that answers "is it working properly and does nothing feel slow" — the owner's definition of
"projected user satisfaction". Research (`docs/qa/reports/App user satisfaction psychology.md`)
shows a pipeline can't predict a satisfaction score without real users; it can prove "works and
isn't slow" with pass/fail budgets. That is what this builds.

The checklist the pipeline is measured against is `docs/qa/2026-11-19-user-flows.md` (flow IDs
A1…N11, priorities P1–P3, where each can be tested).

## 2. Goals, non-goals, anti-goals

**Goals**
- Every P1 flow in the inventory that is testable on the web build has a Playwright test against
  the real local backend (Supabase: auth, DB, storage, Edge Functions) and, for modules, the real
  simulator.
- Speed budgets fail the build when the app gets slower.
- Compatibility on the web build: phone and tablet widths, light/dark, Reduce Motion, enlarged
  text (approximation), slow network and offline.
- Accessibility scan on every tested screen.
- A coverage check that fails when a P1 flow in the inventory has no test and isn't listed as
  deliberately uncovered, so new flows can't be silently missed.
- Runs in GitHub Actions: a fast lane on every PR, the full matrix nightly.

**Non-goals (this design)**
- Native phone tests (Maestro/Flashlight on Android emulator, iOS simulator). Stage 2, after
  redesign Phase 3 when screens settle (owner chose A). Native-only flows stay marked "Native" in
  the inventory.
- Visual screenshot regression: the redesign changes every screen within weeks; revisit after it.
- Cross-browser (Firefox/WebKit): the web build is a test stand-in for the phone app, not a
  product; browser engines don't change what iOS/Android render.
- Post-launch telemetry, surveys, crash reporting (new services; owner decision later).
- Predicted satisfaction scores; LLM UI review as a gate (research: misses most interaction
  issues; may be added later as advisory only).
- Fixing app issues the research found (launch length, skeleton minimum time): the redesign took
  the design ones (PR #10); the rest go to `docs/TASKS.md`.

**Anti-goals (would make this a failure even if it runs)**
- Flaky tests that teach everyone to re-run red builds. Zero tolerance: no fixed sleeps, each test
  owns its data, retries only in CI and a test that passes on retry is reported, not hidden.
- Using up the real Plant.id quota or ever calling Plant.id from CI.
- A PR lane slow enough that people skip it (target ≤ 10 min wall clock).
- Tests that need rewriting on every restyle (no CSS selectors, no DOM structure).
- Weakening any security or watering-safety rule to make a test pass.

## 3. Constraints

- CLAUDE.md applies: TDD, root scripts, Node 22, no secrets in the app, Edge Functions zero npm
  deps, `PLANT_ID_API_KEY` only in `supabase/functions/.env`, watering limits never relaxed.
- The app is Expo SDK 58; the web build is served by `expo start --web` (port 8081). With
  `CI=1` it doesn't watch files.
- Local Supabase needs Docker; GitHub `ubuntu-latest` has it. The repo is public, so Actions
  minutes are free.
- The redesign (DESIGN_ROADMAP phases 1–7, PR #10) will change most screens. Tests must target
  behaviour and accessible names, and each redesign PR updates the tests it breaks.
- Three Claude sessions share the working folder: implementation happens in a git worktree on its
  own branch.

## 4. Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| **A** | Playwright on the web build + local Supabase + simulator; phones later | Cheap, fast, stable, covers ~80 % of flows; misses camera, permissions, native start-up, iOS/Android differences until stage 2 | **Chosen by owner** |
| B | Maestro on Android emulator + iOS simulator first | Closest to real use; slower PRs, more flake, the redesign breaks it within weeks | Later (stage 2) |
| C | Both from day one | Most coverage; most cost and churn during the redesign | Rejected |

Within A, faking Plant.id:
- **Chosen:** `_shared/plantid.ts` reads an optional `PLANT_ID_BASE_URL` (default the real URL) and
  CI points it at a tiny zero-dependency Node fake that returns canned identification and health
  answers. The real Edge Functions, limits, scans and timeline writes are exercised.
- Fallback if the Edge Runtime container can't reach the host: intercept the app's calls to
  `functions/v1/identify-plant` and `check-health` with `page.route`. Weaker (skips the function),
  so only if the chosen way fails.

## 5. Design

### 5.1 Layout

```
apps/mobile/
  playwright.config.ts
  e2e/
    support.ts               users, sign-in, seeding via service role, simulator helper
    fixtures/                test files (gps-plant.jpg)
    fake-plantid.mjs         canned Plant.id answers (zero deps)
    *.spec.ts                one file per inventory area (auth, home, add, detail, module,
                             photos, edit, settings, security, matrix, speed)
    m2-security.mjs          ported into security.spec.ts, then removed
scripts/check-flow-coverage.mjs   inventory ↔ test-title check (zero deps)
.github/workflows/ci.yml          new `e2e` job (PR lane)
.github/workflows/nightly.yml     full suite on a schedule
```

`@playwright/test` is added to `apps/mobile` devDependencies (owner-approved). Only Chromium is
installed. Root scripts: `npm run e2e` (full) and `npm run e2e:pr` (PR lane).

### 5.2 How a test runs

- **Backend:** `supabase start` (auth, DB with migrations + seed, storage, Edge Functions,
  Mailpit). Functions get `PLANT_ID_BASE_URL` pointing at the fake.
- **App:** Playwright `webServer` starts `CI=1 npx expo start --web --port 8081` with the local
  Supabase URL/anon key; reuses a running server locally.
- **Data:** every test creates its own confirmed user via the service-role admin API and seeds what
  it needs (plants, photos, devices) via the API; the flow under test is driven through the UI.
  No test depends on another; tests run in parallel.
- **Modules:** a fixture starts `node sim/sim.ts --claim CODE --scenario …` as a child process and
  stops it after the test.
- **Email:** confirmation links are read from Mailpit's HTTP API.
- **Locators:** role / label / text only (`getByRole`, `getByLabel`, `getByText`); no CSS or test
  IDs unless there is no accessible name (and then the missing name is the bug to fix).
- **Waiting:** web-first assertions only; no `waitForTimeout`.
- **Naming:** every test title starts with its flow ID, e.g. `D9 cancel deletes uploaded photos`.
- **Tags:** `@pr` for the PR lane; everything runs nightly.

### 5.3 What gets covered now (stage 1)

PR lane (`@pr`, default phone width, light):
- Security and data cleanup: D4 (EXIF/GPS, PNG, > 3 MB — port of `m2-security.mjs`), D9, D10,
  G4, H2, E2 (other user's plant), A6 (signed-out redirect), B9 (sign-out clears cache).
- Core journeys: B1 + B5 (sign-up → Mailpit link → confirmed), B7, D1 (happy path), D8 (double
  tap = one plant), D11, D12, C5.
- Module (simulator): F1, F4, F5 (each status), E5 (fault → Resume), F7 (remove → unpairs).

Nightly: every remaining web-testable flow in the inventory, plus the matrix (5.4) and speed
(5.5) suites. Planned flows (A+ section, N1–N11) get tests in the redesign phase that builds them.

### 5.4 Compatibility and accessibility (nightly; one smoke case in the PR lane)

For Home, plant detail, each add step, settings, module setup:
- Widths: 375×667 (small phone), 412×915 (large phone), 820×1180 (tablet).
- Light and dark (appearance stored before load).
- Reduce Motion (`reducedMotion: 'reduce'`): shimmer static, no looping motion.
- Enlarged text approximation: page zoom 200 %; nothing clipped or overlapping the primary
  action. (Real OS text size is native-only → stage 2.)
- Slow network (delayed backend responses) and offline (`context.setOffline`): skeletons then "—"
  or an error with a working retry; never a blank screen; no guessed values.
- No console errors or unhandled promise rejections on any screen.
- Accessibility scan with axe-core (`@axe-core/playwright`, owner-approved dev dependency): no
  serious/critical violations.

### 5.5 Speed budgets

Measured in the browser with the Performance API, median of 3 runs, nightly (one PR smoke):

| Metric | Budget | Source |
|---|---|---|
| Cold load → first usable screen | ≤ 2.5 s locally; launch animation part ≤ 1.0 s once the redesign launch lands (expected to fail today: ~1.45 s, marked `test.fail` with a pointer) | Android splash guidance; research report |
| Tap → visible response (button state or next screen header) | ≤ 100 ms feedback, ≤ 1 s next screen | Nielsen/RAIL bands |
| Cached screen revisit shows content with no skeleton | 0 skeleton frames | Loading rules |
| Layout shift on any screen | CLS ≤ 0.1 | Core Web Vitals |
| Skeleton never shown for < 300 ms | — | Loading rules (minimum display time is a TASKS item, not a gate yet) |

Budgets live in one constants block in the speed spec; changing one needs a reason in the PR.

### 5.6 Coverage check

`scripts/check-flow-coverage.mjs` reads the flow tables in `docs/qa/2026-11-19-user-flows.md`,
collects the IDs, and greps test titles in `apps/mobile/e2e/*.spec.ts`. It fails when a P1 flow
whose "Where" includes Web or Sim has no test and isn't in the inventory's "not covered on
purpose" list. It prints P2/P3 gaps as a report without failing. Runs in the PR lane (seconds, no
backend needed).

### 5.7 CI

- **PR (`ci.yml`, new `e2e` job, parallel to `mobile`/`db`):** npm ci → install Chromium →
  coverage check → `supabase start` → fake Plant.id → `npm run e2e:pr`. Retries 1; HTML report,
  traces, screenshots and video uploaded on failure. Target ≤ 10 min.
- **Nightly (`nightly.yml`, cron + manual trigger):** full suite + matrix + speed; failures open or
  update a single GitHub issue labelled `nightly-qa`. (Shortcut: no issue automation if it needs a
  new action; the failed run itself is the signal.)
- **Local:** `npm run e2e` with `npm run db:start` running; documented in CLAUDE.md commands.

### 5.8 Keeping it honest during the redesign

- CLAUDE.md gains: "UI changes keep `npm run e2e:pr` green and update the flow inventory; a new
  flow gets its test in the same PR." (Owner approves this doc → this rule.)
- The redesign build session (plant-care-25) is told the selectors rule (accessible names on every
  control).

## 6. Decided by the owner

- Approach A; Playwright and `@axe-core/playwright` added to the repo (2026-11-19).
- This design approved as written, including §7 and §9 calls and the CLAUDE.md rule in §5.8
  (2026-11-19).
- "Projected user satisfaction" = everything works properly and nothing feels slow; checked as
  pass/fail budgets, not a score.

## 7. Calls made by the lead (check these)

- Chromium only; no Firefox/WebKit.
- No visual screenshot diffs until the redesign settles.
- `PLANT_ID_BASE_URL` override in `_shared/plantid.ts` (default unchanged) + Node fake.
- Port `m2-security.mjs` into the suite and delete the script.
- Enlarged text tested as 200 % page zoom on web (approximation).
- Speed measured with Playwright + Performance API, not Lighthouse (no extra dependency; Lighthouse
  scores an SPA's first load poorly anyway).
- Fixtures for setup, plain locators in tests; no page-object layer until a selector repeats in
  three or more specs.

## 8. Left to the builder

- Exact canned Plant.id payloads (match the shapes `_shared/plantid.ts` parses).
- How the session is injected for seeded users (UI sign-in vs storage state) — whichever is faster
  and stable.
- How the Edge Runtime reaches the fake on Linux CI (host gateway); fall back per §4 if impossible.
- Splitting specs across workers so the PR lane stays ≤ 10 min.

## 9. Answers to the builder check (lead's calls unless marked)

1. **Fake Plant.id (spike first).** The plan starts with a spike with a decision point: Edge
   Functions read `PLANT_ID_BASE_URL` from `supabase/functions/.env` (the file `supabase start`
   already loads; still git-ignored). CI writes that file with `PLANT_ID_BASE_URL=http://host.docker.internal:<port>`
   and a placeholder `PLANT_ID_API_KEY=fake` (not a secret). `host.docker.internal` is already how
   the auth hook reaches functions (`config.toml:294`); the spike confirms the Edge Runtime reaches
   the host on Linux CI too (else add the host-gateway mapping, else the §4 fallback). **Locally,
   `npm run e2e` refuses to run unless `PLANT_ID_BASE_URL` in that file points at the fake**, so a
   local run can never spend the real quota; the owner switches the line when running e2e.
2. **Plant.id limit.** Fresh user per test, so it never bites by accident. The limit branch seeds
   20 recent `scans` rows via service role, then expects the limit message.
3. **Coverage gate.** Counts tests in any tag (PR or nightly). The inventory gets a machine-readable
   list, "Not covered by e2e", one line per ID: `- F6: fn:test + sim:test (watering limits)`,
   `- I3: db:test (column grant)`, plus every Native-only flow. Planned flows (section A+, N*) are
   skipped until built. The stage-1 build therefore writes tests for every other P1 Web/Sim flow,
   including A4, C6, E3, E4, G6 (nightly where not `@pr`). The lead edits the list; a PR that adds
   a line says why.
4. **Simulator and time.** Status states (C6, F5 offline/wet/battery/tank/fault) are seeded
   directly as `devices`/`readings` rows via service role with the needed timestamps; the sim is
   used where the real loop matters (F1 claim, F4 fill, E5 resume, F7 unpair) with
   `--scenario`, `--from`, `--speed`. Each test uses a unique `--name` and deletes its
   `sim/.devices/<name>.json` afterwards. Client time (F2 code expiry, 30 s refetch) uses
   Playwright `page.clock`; no app test hooks, no server clock control.
5. **Web limits.** Library pick via the file chooser and the canvas re-encode already work in
   headless Chromium (`m2-security.mjs` drives the real add steps). Camera stays Native. B5 needs no
   config change: `site_url` and `additional_redirect_urls` already include
   `localhost:8081/email-confirmed`.
6. **Speed is measured on a static build, not the dev server.** Functional tests use
   `CI=1 expo start --web`; the speed suite runs against `expo export --platform web` (web output
   is `single`, an SPA) served by a zero-dependency Node static server with an index.html fallback.
   Budgets in §5.5 apply to that build.
7. **CI.** The 10-minute target includes `supabase start` and the bundle; Docker images and the npm
   cache are cached. If it's still over, trim the `@pr` set (nightly keeps everything). No nightly
   issue automation: a failed scheduled run is the signal. axe-core: **owner's call**, see §5.4.
8. **Files.** Helpers live in `apps/mobile/e2e/support.ts` (`e2e/fixtures/` stays for files like
   `gps-plant.jpg`). Jest ignores `/e2e/`; `e2e/` is inside the app's tsconfig and lint, so root
   `typecheck` and `lint` cover it.

## 10. Stage 2 (not in this build)

After redesign Phase 3: Maestro flows on an Android emulator (x64 Linux runner with KVM) nightly,
Flashlight performance score, `adb` cold-start median ≤ 2 s on a mid-range profile; native-only
flows (camera, permissions, Android back, notifications). iOS simulator on macOS runners when the
repo's Actions minutes allow.
