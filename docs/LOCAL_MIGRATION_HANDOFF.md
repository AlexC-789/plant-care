# Plant Care — handoff: cloud Claude Code → local Claude Code on Windows

Written 2026-11-18 at the end of a cloud Claude Code session, for a fresh Claude Code session that has
no access to that conversation. **Read this file first, then `CLAUDE.md`.**

Legend: **[Verified]** = checked in the repo or this cloud session while writing this file.
**[Recommendation]** = what to do; a judgement, not a fact. **[Assumption]** = believed true but not
checked from here (usually because it concerns your Windows machine or a third-party catalog).

---

## 0. TL;DR (state at hand-off)

- **[Verified]** `main` = `02b82fe` (PR [AlexC-789/plant-care#5](https://github.com/AlexC-789/plant-care/pull/5),
  milestone 2, merged 2026-11-18 01:36 UTC, CI green: jobs `mobile` + `db`).
- **[Verified]** Active branch **`m3-photo-timeline`** (pushed, in sync with `origin/m3-photo-timeline`), head
  `53de807 feat(db): plant photo timeline table`. No PR yet.
- **[Verified]** Milestone 3 is mid-build: design + plan approved; **Task 1 of 6 is committed but its review
  returned "Needs fixes" with 2 Important findings that are NOT fixed yet** (§2.5). Fix those first.
- **[Verified]** Work happens with the Superpowers process (brainstorm → design doc → owner approval →
  plan → subagent-driven build with a review per task → final review → PR → owner merges) plus the
  owner's **Ponytail** rule (laziest solution that works) — both must be installed locally (§3).
- This file is committed on `main` (so it is on every branch created from main after 2026-11-18). `m3-photo-timeline` predates it: merge `main` into that branch or read it from `main`.

---

## 1. Project overview

### 1.1 What it is [Verified]
Companion app + backend for a self-watering device (saucer with ~705 ml tank + pump, stake with capacitive
moisture probe, ESP32-C3, Wi-Fi, LiPo). Users add plants (photos, Plant.id identification and health checks),
keep a plant library, and later (milestones 4+) see moisture / water left / battery and get watering plans
the device executes. Owner tests on an **iPhone with Expo Go** and develops on a **Windows** laptop (no Mac,
no Apple Developer account yet).

Authoritative docs (all in the repo):
- Product spec: `docs/superpowers/specs/2026-11-16-plant-care-design.md` (milestones in §11)
- Hardware: `docs/hardware/2026-11-16-saucer-and-stake-v1.md`
- UI design: `docs/superpowers/specs/2026-11-17-app-ui-design.md` (links a design canvas artifact)
- Per-feature designs `docs/superpowers/specs/*-design.md`; plans `docs/superpowers/plans/*.md`
- Previous handoff (M1→M2): `docs/superpowers/handoff/2026-11-17-m2-handoff.md`

### 1.2 Stack [Verified versions from package.json / this sandbox]
| Area | Tech |
|---|---|
| App | Expo SDK 58 (`expo ~58.0.25`), Expo Router `~58.0.31`, React Native 0.88.1, React 19.3.0, TypeScript strict |
| App data | `@supabase/supabase-js ^2.119`, `@tanstack/react-query ^5.107` |
| Images | `expo-image`, `expo-image-picker`, `expo-image-manipulator` |
| Motion | React Native `Animated` (native driver). `react-native-reanimated 4.7.1` is installed but **not usable under Jest here** (see §6) |
| Tests (app) | jest-expo + `@testing-library/react-native ^14` |
| Backend | Supabase local (CLI `supabase ^3.2.0` as npm devDependency; Docker), Postgres + RLS, Storage, Auth |
| Edge Functions | Deno 2 (`deno ^2.9.6` npm devDependency), **zero runtime npm deps**, plain `fetch` |
| DB tests | pgTAP (`supabase test db`) |
| e2e proofs | Playwright script `apps/mobile/e2e/m2-security.mjs` (run manually; Playwright NOT a dependency) |
| CI | `.github/workflows/ci.yml`: Node 22; job `mobile` (npm ci, lint, typecheck, test, fn:test); job `db` (supabase db start, test db) |
| Node (sandbox) | v22.23.4, npm 10.9.9 |

### 1.3 Repository structure [Verified]
```
apps/mobile/                 Expo app (npm workspace "plant-care-mobile")
  src/app/                   routes only — (auth)/ signed-out, (app)/ signed-in
    (app)/index.tsx          Plants home
    (app)/add/               add-a-plant steps: photo, identify, search, where, health (+ _layout)
    (app)/plant/[id]/        index (detail), health, edit
    (app)/settings.tsx
  src/plants/                plant feature code: api.ts, queries.ts, photos.ts, addDraft.tsx,
                             CaptureCards, Suggestions, TypeSearch, HealthCard, HealthResult, AboutPlant, PlantRow
  src/ui/                    house components: Text, Button, BottomBar, InsetGroup, Row, Icon, TextLink,
                             PotDrawing, Skeleton*, LoadingGroup, FadeIn, ShimmerProvider, StepProgress, StepDone
  src/theme/                 tokens (colours light/dark, type, spacing, radii, motion.ts), useTheme, appearance
  src/auth/ src/profile/ src/launch/ src/navigation/ src/lib/ (supabase client, database.types.ts, queryClient)
  src/test-utils/            supabaseMock, queryWrapper
  e2e/m2-security.mjs        Playwright security proofs (+ fixtures/gps-plant.jpg)
  AGENTS.md                  Expo-specific agent rules (read versioned docs, don't trust memory)
supabase/
  config.toml                local Supabase config (functions with verify_jwt; local-only hook secret)
  migrations/                schema (profiles, plants/scans/species, bucket, species seed, search_log, checks, plant_photos)
  tests/database/*.test.sql  pgTAP
  functions/                 before-user-created, identify-plant, check-health, search-plants, _shared/
docs/                        specs, plans, handoff, hardware, species curation
.claude/skills/              20 repo skills (Emil Kowalski design/animation set) — see §3
skills-lock.json             provenance of those 20 skills (emilkowalski/skills @ 64eb3de…)
CLAUDE.md                    binding project rules for Claude
```

### 1.4 Important architectural decisions (not all obvious from code) [Verified — from specs/ledgers]
- **Plant.id key never in the app.** The app calls Supabase Edge Functions (`identify-plant`, `check-health`,
  `search-plants`), which call Plant.id with `PLANT_ID_API_KEY` from function secrets.
- **Photos: upload first, then identify** (spec M2 §4 approach A). App re-encodes every photo
  (`preparePhoto`: longest side ≤ 1600 px, JPEG 0.7) → **no EXIF/GPS** reaches storage. Private bucket
  `plant-photos`, 3 MB, JPEG only, path `{user_id}/{uuid}.jpg`, owner-only storage policies; shown via 1 h signed URLs.
- **Identification and health are separate.** Health runs automatically only when the add flow has a
  "Problem spot" photo; otherwise on demand. One credit per tap; double taps guarded.
- **Own curated species DB** (190 rows, names via GBIF; 98 care facts compared to NC State Extension,
  92 name-only — `docs/species/curation.md`) instead of paid Plant.id detail lookups. Plant.id name search
  (free) is a fallback when local search has < 3 matches; picking a Plant.id-only name is rate-limited and
  only stored on an exact Plant.id match.
- **Limits:** 20 Plant.id calls (identify + health, statuses ok/not_plant) per user per rolling 24 h; search
  120/user/hour; Plant.id timeout 20 s; function body ≤ 10 KB.
- **Functions:** `verify_jwt` on + own `/auth/v1/user` check; validate every input; reject unknown fields;
  uniform error bodies; logs only `{fn, requestId, userId, outcome[, status]}` — never keys, photos or provider text.
- **Data:** every user table RLS owner-only with pgTAP cross-user tests; server-controlled columns protected by
  column grants (e.g. `scans` insert only by service role; owner may set `scans.plant_id` once, to an own plant).
- **TanStack Query** for all server data (cache 24 h, refetch on foreground, cleared on sign-out).
- **UI rules:** tokens only (raw colours fail lint), never cap font scaling, `Icon` component, no emoji,
  `BottomBar` for primary actions (sheets keep Done in header), loading rules (LoadingGroup 300 ms, Skeleton,
  FadeIn 150 ms, virtualised lists). Light theme by default; Dark selectable in Settings.
- **Add flow = 4 step screens** (photo → identify → where (saves the plant once) → health) sharing an
  in-memory draft; progress bar + calm success moments; motion tokens in `src/theme/motion.ts`.

### 1.5 Implementation status [Verified]
- M1 Foundation — done (merged earlier).
- M2 Library + identification (+ add-flow redesign, owner feedback rounds) — **done, merged in PR #5**.
- M3 Photo timeline + rescan — **in progress** on `m3-photo-timeline` (§2.5).
- M4+ not started.

---

## 2. Development progress

### 2.1 Completed milestones and features [Verified]
- **M1 Foundation:** repo, Expo shell, local Supabase, email/password auth with **email confirmation**
  (Mailpit locally), sign-up email check (`before-user-created` auth hook; fails open on DNS problems),
  profiles, appearance setting (light default), UI foundation, loading rules, launch animation, CI.
- **M2 (PR #5):** tables `species`/`plants`/`scans`/`search_log`, private photo bucket, 190-species seed,
  three Plant.id functions + `_shared/`, app data layer, Plants home, 4-step Add-a-plant flow with automatic
  health check on a Problem-spot photo, plant detail (hero photo, About facts, Health card), on-demand
  health check screen with redesigned result, Edit/Delete plant, BottomBar rule, keyboard handling,
  e2e security proofs, security review (no findings).

### 2.2 M2 implementation details worth knowing [Verified]
- Plant.id request/response shapes were first written from Kindwise's public Python client
  (`github.com/flowerchecker/kindwise-api-client`) and then corrected live with the owner's key:
  - **`similar_images: false` is rejected (400)** — the field must be omitted (commit `1857989`).
  - Live health answer for a yellow-leaf orchid: top issue "nutrient deficiency" ≈ 0.50 → the threshold for
    naming a mapped issue was lowered **0.5 → 0.3**; the top issue name/probability is stored on the scan
    (`health.top_issue`, never logged) for tuning (`0d582e4`).
  - Light text parsing ignores negated phrases ("avoid direct sun") (`13fee5c`).
  - Provider errors log Plant.id's HTTP `status` (`31a9dc3`): 401/403 key, 402/429 credits, 400 request shape.
- After pulling a branch with new functions you must **restart Supabase** or the edge runtime keeps serving
  only the old functions (this caused a "Couldn't tell" error in owner testing).

### 2.3 Git [Verified]
- Remote: `https://github.com/AlexC-789/plant-care` (owner GitHub: AlexC-789).
- `main` @ `02b82fe` (merge of PR #5). Older merged branches still exist remotely (`m2-plant-library`, …).
- `m3-photo-timeline` commits on top of main:
  - `229abe5` docs: M3 design (draft) · `8d0c7a0` docs: M3 plan; design approved · `53de807` feat(db): plant photo timeline table.
- Commit trailer used in this project:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (+ a `Claude-Session:` link line in cloud sessions —
  drop that line locally).

### 2.4 Outstanding bugs, limitations, technical debt [Verified unless marked]
From the M2 final reviews (all non-blocking, listed in PR #5's description):
- Plant.id **common-name** name search returns nothing until a live response confirms `entity_name`
  (local DB covers common names).
- 16 of 19 health-issue names in `supabase/functions/_shared/health_notes.ts` are unconfirmed against live
  answers; unknown names show "Couldn't tell" (never a raw provider name).
- 92/190 species have unchecked care facts (owner reviews `docs/species/curation.md` once).
- Daily-limit check is count-then-call (a parallel burst can exceed 20 by a few). No CORS on functions (native app).
- `plants.setup_step` is user-writable (decide when device steps land).
- "{n} need you" on Plants home counts only loaded pages (wrong above 20 plants).
- Orphan uploads from a killed app are accepted (cleanup job at store readiness).
- A failed automatic health check's error line stays until the next check; "avoid hot, direct sunlight" can
  still read as direct sun.
- Edit sheet rows not yet at the new row height; minor formatting churn; some raw icon sizes.
- `npm audit`: 82 advisories (glob/minimatch/picomatch in build tooling) — **identical on main, not added by
  this work**; do **not** run `npm audit fix --force` (it bumps Expo/RN majors). Clears with the next Expo SDK.
- **Device-only checks still owed by the owner:** progress bar fills from the left; no Back/swipe after save
  in the add flow; Done lands on the new plant; keyboard never covers Continue; header buttons readable on
  bright photos.
- `supabase/config.toml` contains a **local-only** auth-hook secret value (commented as such); the hosted
  project must use its own (README "Sign-up email check").

### 2.5 Next milestone: M3 (in progress) [Verified]
**Spec:** `docs/superpowers/specs/2026-11-18-m3-photo-timeline-design.md` (approved).
**Plan:** `docs/superpowers/plans/2026-11-18-m3-photo-timeline.md` (6 tasks).

Owner decisions: adding a photo is **free** (Plant.id only on request); tapping a timeline photo opens a
**full-screen swipe viewer**; storage via a new **`plant_photos`** table (not "photo" scans, to keep
`scans` server-written only).

Tasks: 1 table/RLS/trigger/backfill · 2 `check-health` upserts timeline rows with `scan_id` ·
3 app data layer (fetch/add/delete photo; deletePlant gathers timeline paths) · 4 timeline strip + Add a
photo (+ inline health check offer) + Edit loses photo controls · 5 viewer (`plant/[id]/photos`) with
What is it? and Delete · 6 e2e/docs/verification/screenshots.

Controller ruling R1 (in the plan ledger): "Check its health" after Add a photo runs **inline**
(`useCheckHealth` with `[newPath]`; HealthCard shows progress) rather than routing through the health screen.

**Task 1 status — `53de807` committed, review = Needs fixes (Opus security review). Open findings:**
1. **Important — backfill loses `scan_id`** when a health-scan photo is also the plant's main photo (every
   add-flow health check). In `supabase/migrations/20261118100000_plant_photos.sql` the scans pass uses
   `on conflict do nothing` after the plants pass inserted the same `(plant_id, path)` with `scan_id = null`.
   Fix: `on conflict (plant_id, path) do update set scan_id = excluded.scan_id where excluded.scan_id is not null
   and public.plant_photos.scan_id is null`; add a pgTAP fixture where a health scan's `photo_paths` contains
   the plant's `photo_path` and assert `scan_id`.
2. **Important — "A cannot delete B's row" test asserts nothing** (`supabase/tests/database/plant_photos.test.sql`
   ~60-61): it counts rows visible to A. Fix: after `reset role`, assert B's row still exists (or count a
   `delete … returning` as A = 0).
Minor (deferred): trigger only tested as superuser (run the `photo_path` update as A too);
`public.backfill_plant_photos()` stays as a security-definer function (execute revoked from clients; harmless).
Cross-task notes from that review: until Task 3/4 land, `deletePlant` doesn't gather timeline paths and
Edit's photo replace deletes an object that now has a timeline row — both are planned in Tasks 3/4.

Process for each fix round: resume/redo with a fresh implementer, test-first, then a scoped re-review.

Dependencies: local Supabase (Docker) for Tasks 1–2 and 6; Plant.id key only for live testing (all tests
use fixtures).

---

## 3. Skills and plugins

### 3.1 Inventory [Verified in this cloud session]
| Source | Where it lives | Travels with git? |
|---|---|---|
| **Repo skills** (20): animate, animate-expo, animation-performance, animation-vocabulary, apple-design, ask-emil, ask-sonner, break-ui, choreograph, emil-design-eng, find-animation-opportunities, gestures, improve-animations, learn-taste, mobile-native, pick-ui-library, prototype, remove-animations, review-animations, write-swift | `.claude/skills/<name>/SKILL.md` (+ RECIPES/CATALOG/etc.); provenance in `skills-lock.json` (`emilkowalski/skills`, commit `64eb3deb…`) | **Yes** — committed. Claude Code loads project skills from `.claude/skills/` automatically. |
| **Superpowers** plugin v7.0.2 (Jesse Vincent, `github.com/obra/superpowers`, MIT) — skills: brainstorming, writing-plans, subagent-driven-development, executing-plans, test-driven-development, systematic-debugging, requesting/receiving-code-review, verification-before-completion, finishing-a-development-branch, using-git-worktrees, dispatching-parallel-agents, writing-skills, diagnosing-superpowers, using-superpowers | cloud: synced from the claude.ai account (`marketplace_name: anthropic-plugin-directory`) into `~/.claude/plugins/synced/…` | **No** — install locally (§3.3). |
| **Ponytail** plugin v5.3.3 (Dietrich Gebert, `github.com/DietrichGebert/ponytail`) — skills ponytail, ponytail-review, ponytail-audit, ponytail-debt, ponytail-gain, ponytail-help; **SessionStart/lifecycle hooks** (Node) that inject "PONYTAIL MODE ACTIVE"; optional status-line script | cloud: account marketplace `ponytail` | **No** — install locally. The rule itself is also in `CLAUDE.md` ("Ponytail (owner, 2026-11-17)"), so it applies even without the plugin. |
| **unslop** plugin (Damir Sokolovsky, `github.com/heydamir/unslop`, CC-BY-4.0) — UI de-slop skill | cloud: account marketplace `unslop` | No — optional. |
| **Built-in Claude Code skills** used here: security-review, code-review, simplify, init, update-config, run, loop, claude-api, etc. | ship with Claude Code | Available locally (same CLI version family). |
| **claude.ai-synced skills** (docs, docx, pdf, pptx, xlsx, google-workspace, deep-research, llm-council, chrome-browser, built-in-browser, computer-use, morning, import-memory, cowork-prompt-optimiser, skill-creator) + artifact skills (artifact-design, artifact-capabilities, artifact-diagramming, dataviz) | `~/.claude/skills/synced/…` from the account | **Cloud/claude.ai only** — not needed for this project. [Assumption] some appear locally if you sign in with the same account and the desktop app syncs them. |
| **Cloud-only hooks**: `~/.claude/settings.json` SessionStart (`session-start-setup-script-failure.sh`) and **Stop hook `stop-hook-git-check.sh`** (nags to commit/push) | cloud container | Not needed locally (bash scripts; don't port to Windows). |

[Verified] Note: in this cloud session only 15 of the 20 repo skills were surfaced in the skill list
(ask-emil, learn-taste, pick-ui-library, prototype, review-animations were present on disk but not listed).
[Assumption] that's a listing/frontmatter quirk; they load from disk locally. Check with `/skills` locally.

### 3.2 Which skills matter for this project
- **Process (required):** Superpowers — brainstorming, writing-plans, subagent-driven-development,
  test-driven-development, requesting-code-review, verification-before-completion, finishing-a-development-branch.
- **Owner rule (required):** Ponytail (plugin or at least the CLAUDE.md rule).
- **Design work (used on owner request):** repo skills `emil-design-eng`, `animate`, `animate-expo`; plugin `unslop`.
- **Reviews:** built-in `security-review` (run before each PR, per spec §8a.10 practice).

### 3.3 Make them available locally [Recommendation]
1. Repo skills: nothing to do — they come with `git pull`. Verify with `/skills` (or ask Claude "which skills
   are available?") inside the repo folder.
2. **Superpowers:** in Claude Code run `/plugin` → Discover/Marketplaces and install **superpowers**
   (official directory). [Assumption] equivalently:
   ```
   /plugin marketplace add obra/superpowers-marketplace
   ```
   ```
   /plugin install superpowers@superpowers-marketplace
   ```
   If those names differ, use `/plugin` → browse and search "superpowers".
3. **Ponytail** [Verified from its INSTALL.md] — two separate prompts:
   ```
   /plugin marketplace add DietrichGebert/ponytail
   ```
   ```
   /plugin install ponytail@ponytail
   ```
   Its hooks need **Node on PATH** (Node 22 from §5 satisfies it). Optional status line badge: Ponytail ships
   a bash status-line script; on Windows skip it or run Claude Code from Git Bash/WSL. [Assumption]
4. **unslop** (optional): `/plugin marketplace add heydamir/unslop` then `/plugin install unslop@unslop`
   [Assumption — verify the marketplace name with `/plugin`].
5. If you use the **Claude desktop app** signed in to the same account, account-synced plugins
   (superpowers/ponytail/unslop) may appear automatically [Assumption]; still verify with `/plugin`.
6. Restart Claude Code after installing plugins so SessionStart hooks run.

### 3.4 MCP integrations [Verified]
Cloud session MCP servers: `claude-code-remote` (cloud session tooling: GitHub PR subscriptions, scheduled
check-ins, environments, repo attach — **cloud-only**), `Claude_Docs` (claude.ai docs — cloud/claude.ai),
plus travel/Drive connectors (Expedia, Google Drive, Kiwi.com, lastminute.com — unrelated, now disconnected).
**None are required for development.** Locally:
- GitHub: use the **`gh` CLI** (`gh auth login`) for PRs/CI instead of cloud PR subscriptions.
  [Verified] In the cloud, GraphQL was blocked so PRs were made via `gh api repos/AlexC-789/plant-care/pulls`;
  locally `gh pr create` works normally. [Assumption]
- No MCP server needs recreating for Plant Care.

---

## 4. Claude Code configuration

### 4.1 CLAUDE.md [Verified]
`CLAUDE.md` (repo root, committed) is binding and current: layout, commands, rules (deps via `npx expo install`,
no secrets in app, RLS + pgTAP, migrations only, entitlement gating, auth hook, restart after config.toml
changes, email confirmation, appearance, UI rules + BottomBar, loading rules, TanStack Query, Animated not
Reanimated, launch, no expo-status-bar, routes/tests placement, plant library + security, add flow, press
handlers synchronous, **watering safety limits**, **Ponytail**, TDD + commit per task). Also read
`apps/mobile/AGENTS.md`.
Cloud-specific line to adjust mentally: "in this cloud sandbox: `EXPO_OFFLINE=1 npx expo install`" — locally
plain `npx expo install` works (the proxy blocked Expo's version API only in the cloud). [Recommendation]
optionally edit that line after migrating.

### 4.2 Agents / skills config [Verified]
- No `.claude/settings.json`, no `.claude/agents/` in the repo. Only `.claude/skills/` + `skills-lock.json`.
- Subagents were the built-in `general-purpose` agent with an explicit `model` each time.
- **Model mix agreed with the owner:** Sonnet for implementers and most reviews; **Opus** for reviews of
  security-critical tasks (RLS, storage, functions, deletion) and the final whole-branch review; Haiku only for
  tiny single-file fix rounds. The controller (main session) ran on Opus (~75% of usage per `/usage`); owner
  may switch the controller to Sonnet with `/model` to save cost (trade-off: weaker coordination).

### 4.3 Cloud-specific assumptions that do NOT hold locally
- `.superpowers/` (git-ignored) held the subagent-driven-development **ledger** and per-task briefs/reports.
  **It does not travel.** The M3 ledger content that matters is reproduced in §2.5; a fresh run recreates
  the workspace with `scripts/sdd-workspace` from the Superpowers skill.
- Proxy quirks (EXPO_OFFLINE, WebFetch bypass, blocked hosts), container restarts, `dockerd &`, scratchpad
  paths under `/tmp/claude-0/…`, Stop-hook nags — all cloud-only.
- Playwright is preinstalled in the cloud; locally install it yourself for e2e (§5.5).

### 4.4 Recommended local Windows configuration [Recommendation]
- Run Claude Code from the repo root (`C:\Users\<you>\Desktop\plant_app\plant-care` per the owner's prompts).
- npm scripts use POSIX shell features (`fn:test` is a `for … do … done` loop). npm on Windows runs scripts
  with `cmd.exe` by default → `npm run fn:test` **fails in PowerShell/cmd**. Options (pick one):
  - `npm config set script-shell "C:\\Program Files\\Git\\bin\\bash.exe"` (Git for Windows), or
  - run the repo inside **WSL2** (Ubuntu) — closest to CI and the cloud sandbox, or
  - run Deno tests per folder manually (§5.6).
- Consider a project `.claude/settings.local.json` (git-ignored by Claude Code) for permission allows such
  as `Bash(npm run *)`, `Bash(npx supabase *)`, `Bash(git *)`, `Bash(gh *)`.
- Keep `CLAUDE.md` + plugins as the single source of rules; don't duplicate them in settings.

### 4.5 Claude Code 2.1.327 compatibility [Verified version / Assumption details]
- [Verified] This cloud session ran **Claude Code 2.1.327**.
- [Assumption] Same version locally ⇒ same plugin/skill formats: project skills in `.claude/skills/*/SKILL.md`,
  `/plugin` marketplace commands, plugin hooks. Plugin hooks that call `node` need Node on PATH (Ponytail).
- [Assumption] Hooks written as bash scripts (Ponytail status line, the cloud Stop hook) need Git Bash/WSL on
  Windows; Ponytail's own lifecycle hooks are Node and work natively.
- The cloud-only tools in this conversation (`send_later`, PR subscriptions, `add_repo`, environments, Artifacts)
  don't exist locally; use `gh` and plain git.

---

## 5. Environment and dependencies

### 5.1 Required tools [Verified requirement / Recommendation for install]
- **Node.js 22** (README + CI). npm 10.
- **Git** (+ Git Bash recommended on Windows).
- **Docker Desktop** (WSL2 backend) for local Supabase.
- Supabase CLI and Deno come as **npm devDependencies** (`npx supabase`, `npx deno`) — no global install needed.
- **Expo Go** on the iPhone (same Wi-Fi as the laptop).
- Optional: `gh` CLI; Playwright for the e2e script.

### 5.2 npm workspace [Verified]
Root `package.json` workspaces `["apps/*"]` → one `npm ci` at the root installs app + CLI tools.
Root scripts: `test`, `typecheck`, `lint` (delegate to `apps/mobile`), `db:start|stop|reset|test|types`, `fn:test`.

### 5.3 Environment variables and secrets (names only — never commit values) [Verified]
| File (git-ignored) | Variable | Purpose |
|---|---|---|
| `apps/mobile/.env.local` (copy of `.env.example`) | `EXPO_PUBLIC_SUPABASE_URL` | local `http://127.0.0.1:54321`; **on the phone use the laptop's LAN IP** |
| | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | from `npx supabase status` |
| | `EXPO_PUBLIC_EMAIL_CONFIRMED_URL` | default `http://127.0.0.1:8081/email-confirmed` (must be in `additional_redirect_urls`) |
| `supabase/functions/.env` | `PLANT_ID_API_KEY` | Kindwise/Plant.id key (owner has one) |
| injected by Supabase runtime | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | used by functions |
| config.toml (local only) / hosted secret | `BEFORE_USER_CREATED_HOOK_SECRET` | auth hook; hosted value set via `supabase secrets set` in M4 |
| e2e script env | service-role key + URL from `npx supabase status -o json` | read at runtime, never committed |

### 5.4 Run locally [Verified commands]
```
npm ci
```
```
npm run db:start
```
(fallback if Studio image fails: `npx supabase start -x studio`)
```
cd apps/mobile
```
```
npx expo start -c
```
Emails (sign-up confirmation) arrive at Mailpit http://127.0.0.1:54324 — **click the link on the laptop**, not the phone.
After `db:reset` the phone may stay "signed in" as a deleted user — sign out manually (expected locally).
After pulling new functions/config: `npx supabase stop` then `npm run db:start`.
Function logs: `docker logs supabase_edge_runtime_plant-care --tail 30`.

### 5.5 Tests [Verified commands]
- `npm test` (Jest; add `-- --forceExit` if it hangs — pre-existing worker-exit hang), `npm run typecheck`,
  `npm run lint`, `npm run db:test` (Supabase running), `npm run fn:test` (needs a POSIX shell, §4.4).
- **Run all five before calling work done** (CLAUDE.md).
- e2e security proofs: start the web app `cd apps/mobile` → `npx expo start --web --port 8081`, Supabase
  running, then `node apps/mobile/e2e/m2-security.mjs` (needs Playwright: `npx playwright install chromium`
  and a resolvable `playwright` package — e.g. `npm i -g playwright` and set `NODE_PATH` to `npm root -g`;
  [Assumption] details for Windows). Expect all checks PASS.

### 5.6 fn:test without bash [Recommendation]
Per function folder (PowerShell):
```
npx deno test --config supabase/functions/_shared/deno.json --allow-read --allow-env --allow-net=jsr.io,registry.npmjs.org supabase/functions/_shared
```
Repeat for `identify-plant`, `check-health`, `search-plants`, `before-user-created`.

---

## 6. Important implementation knowledge

### 6.1 Non-obvious decisions [Verified]
- Plants are saved **once**, at add-flow step 3; Cancel never deletes photos of a saved/saving plant; steps 1–2
  redirect to step 4 once the plant exists (prevents deleting the saved photo by retaking).
- A failed health check counts as no check: its problem-spot photo is deleted on leaving (spec §7a.3 refinement).
- Health: healthy ≥ 0.8; else top **mapped** issue ≥ 0.3 → plain-words note; else "Couldn't tell…".
- Delete order everywhere: database row first, then storage object (never a row pointing at a deleted object;
  orphan objects are accepted).
- `scans` are written only by functions; app links an identify scan to the plant once via `scans.plant_id`.
- Add-flow title is "Add a plant" (the spec's "Plant · 1 of 6" returns with device steps, M4+).
- Edit sheet keeps Done in the header; empty Plants screen keeps "Add a pot" inline.
- Health-check 429 copy differs per screen on purpose (identify vs health wording).

### 6.2 Pitfalls and failed approaches [Verified]
- Plant.id: `similar_images: false` → 400; KB detail endpoints (`/kb/plants/{token}`) cost credits — don't use;
  name search lacks scientific names for common-name hits.
- Docs for Kindwise are on a Postman host (blocked in the cloud); the official Python client
  (`flowerchecker/kindwise-api-client`) is the reliable shape reference.
- **Reanimated 4 + Worklets cannot load under Jest here** (native worklets init; official mock fails with
  `setCSSEventHandler is not available in JSReanimated`). Use RN `Animated`; a ~30-line hand mock is the path if
  Reanimated is adopted later (owner: "switch when gestures arrive").
- `expo-crypto` was rejected — use `uuid.v4()` from `expo`.
- `BackHandler.addEventListener` throws on react-native-web — guard with `Platform.OS !== 'web'`.
- `accessibilityLiveRegion` is Android-only — on iOS call `AccessibilityInfo.announceForAccessibility`.
- `transformOrigin: 'left'` on a native-driven `scaleX` (progress bar) — verify on device.
- Header transparency on detail needed a screen-level transparent `headerStyle` (layout-wide header bg overrode it).
- Supabase local: Studio image had an exec-format issue once → `npx supabase start -x studio`.
- Storage SQL deletes in pgTAP need `set local storage.allow_delete_query = 'true'`.
- Shallow clones / autosquash after pushing caused branch divergence in the cloud — never rewrite pushed history;
  rebuild on top instead.

### 6.3 Testing considerations [Verified]
- TDD is mandatory: capture RED, then GREEN; commit per task. Reviews reject tests that assert nothing.
- Every user table: pgTAP cross-user tests for **every** operation (select/insert/update/delete).
- Functions tested with injected `fetch` and fixtures in `supabase/functions/_shared/fixtures/`; **never** add a
  fake-provider code path to production code; Playwright screenshots intercept function calls with route fixtures.
- Jest: `src/**/__tests__/` only (never under `src/app/`); press handlers synchronous (`void doAsync()`).
- Web screenshots can't prove iOS header/keyboard/gesture behaviour — owner checks on the phone.

### 6.4 Safety constraints [Verified — CLAUDE.md + product spec §5.6]
- **Watering limits (never relax; plans must stay inside them):** ≤ 40 ml per dose, ≤ 150 ml per 24 h,
  **never pump when the float switch reads low**, **stop after 2 doses with no moisture rise**. They live in
  firmware and the shared watering module (M5/M7) and the simulator must mirror them exactly.
- Connectivity failures: per product spec, the device keeps watering on its own schedule/limits when offline;
  the app must show "—" for unknown values, never a guessed value. Read spec §5.4–5.7 before M4.
- Photos/privacy: no EXIF/GPS uploaded; deleting a plant removes every stored photo (e2e-proved).
- No secrets in the app; Plant.id key only in function secrets.

---

## 7. Migration instructions (Windows) [Recommendation]

1. **Sync the repository**
   ```
   git clone https://github.com/AlexC-789/plant-care
   ```
   (or in your existing clone)
   ```
   git fetch origin
   ```
   ```
   git checkout m3-photo-timeline
   ```
   ```
   git pull
   ```
   This handoff lives on `main`. To have it on the M3 branch too: `git merge origin/main` while on
   `m3-photo-timeline` (a docs-only merge, no conflicts expected).
2. **Install tools:** Node 22 (nvm-windows or the installer), Git for Windows (Git Bash), Docker Desktop
   (WSL2 backend), optionally `gh` (`gh auth login`), Expo Go on the iPhone.
3. **Shell for npm scripts:** `npm config set script-shell "C:\\Program Files\\Git\\bin\\bash.exe"` (or use WSL).
4. **Dependencies:** `npm ci` at the repo root.
5. **Env files:** copy `apps/mobile/.env.example` → `apps/mobile/.env.local` and fill from `npx supabase status`
   (phone: LAN IP). Put `PLANT_ID_API_KEY=<your key>` in `supabase/functions/.env`.
6. **Supabase:** `npm run db:start` (applies all migrations incl. M3 Task 1). Then `npm run db:test`.
7. **Plugins:** in Claude Code: install **Superpowers** and **Ponytail** (§3.3), optionally unslop; restart Claude Code;
   check `/plugin` and that a new session shows the Ponytail banner and Superpowers skills.
8. **Skills:** run `/skills` (or ask) inside the repo — the 20 repo skills should be listed.
9. **MCP:** nothing to recreate; use `gh` for GitHub.
10. **Recommended first Claude Code session prompt:**
    > Read `docs/LOCAL_MIGRATION_HANDOFF.md`, `CLAUDE.md` and `apps/mobile/AGENTS.md`. Verify the local
    > environment (npm ci, db:start, the five checks). Then continue milestone 3 on branch
    > `m3-photo-timeline` with superpowers:subagent-driven-development and the Ponytail lens: first fix the
    > two Important findings on Task 1 (handoff §2.5) test-first with a scoped re-review, then Tasks 2–6 of
    > `docs/superpowers/plans/2026-11-18-m3-photo-timeline.md`. Pass `model` explicitly to every subagent
    > (Sonnet implementers/reviews, Opus for security-critical reviews and the final review). Ask me before any merge.

---

## 8. Immediate next steps (prioritized checklist)

**1. Complete the local migration**
- [ ] Pull `main` (this file is there); merge `main` into `m3-photo-timeline` if you want it on the branch.
- [ ] Install Node 22, Git Bash, Docker Desktop, gh; set npm `script-shell`.
- [ ] `git checkout m3-photo-timeline && git pull`; `npm ci`.
- [ ] Create `apps/mobile/.env.local` and `supabase/functions/.env` (no values in git).

**2. Configure the multi-agent workflow**
- [ ] Install Superpowers + Ponytail plugins; restart; confirm skills via `/plugin` and `/skills`.
- [ ] Decide the controller model (`/model`: Opus as before, or Sonnet to save cost).
- [ ] Optional `.claude/settings.local.json` permission allows for npm/npx/git/gh.

**3. Verify the local environment**
- [ ] `npm run db:start` → `npm run db:test` (expect PASS incl. `plant_photos.test.sql`).
- [ ] `npm test` (`-- --forceExit` if needed), `npm run typecheck`, `npm run lint`, `npm run fn:test` → all green.
- [ ] `npx expo start -c` in `apps/mobile` → open in Expo Go; sign up (Mailpit link on the laptop), add a plant.
- [ ] Optional: e2e security script → all PASS.
- [ ] Owner device checks still owed from M2 (§2.4).

**4. Start (continue) M3**
- [ ] Fix Task 1's two Important findings (backfill `scan_id` upgrade; real cross-user delete assertion), test-first; `npm run db:test`; commit; scoped re-review.
- [ ] Tasks 2–6 per the plan, one implementer + one review each; Opus reviews for Task 3 (deletion) and the final review.
- [ ] Run `security-review`, open the PR from `m3-photo-timeline` to `main` with decisions + deferred items; owner merges.
