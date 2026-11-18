# Plant Care — project guide for Claude

Companion app for a self-watering device (saucer with ~705 ml tank + pump, stake with
capacitive moisture probe, ESP32-C3, Wi-Fi, LiPo). Users scan plants (Plant.id), keep a
plant library, see moisture / estimated water left / battery, and the backend generates
watering plans the device executes. Subscription model (RevenueCat, later).

- Spec (authority): `docs/superpowers/specs/2026-11-16-plant-care-design.md`
- Hardware: `docs/hardware/2026-11-16-saucer-and-stake-v1.md`
- Plans per milestone: `docs/superpowers/plans/`
- **Where we are:** `docs/CURRENT_STATE.md` (status, known issues, next task) and `docs/TASKS.md`
  (open work). Read both at the start of a session; background in `docs/LOCAL_MIGRATION_HANDOFF.md`.

## Layout

```
apps/mobile/          Expo (SDK 58) + Expo Router app, TypeScript strict
  src/app/            routes only: (auth)/ signed-out, (app)/ signed-in
  src/lib/            supabase client, generated database.types.ts
  src/auth/ src/profile/ ...   feature code + __tests__
  src/theme/          design tokens (colours light/dark, type, spacing, radii), useTheme(),
                      useIsAccessibilitySize(); the ONLY place colour values live
  src/ui/             shared building blocks: Text, Button, InsetGroup, Row, Icon, TextLink, PotDrawing,
                      Skeleton/SkeletonText/SkeletonRow/LoadingGroup, ShimmerProvider
  src/launch/         launch animation + once-per-run gate
  src/lib/queryClient.ts  the client cache (TanStack Query)
  src/test-utils/     supabaseMock for jest.mock('@/lib/supabase')
supabase/             config.toml, migrations/, tests/database/ (pgTAP),
                      functions/ (Edge Functions, Deno; tests: npm run fn:test)
```

Also read `apps/mobile/AGENTS.md` (Expo-specific rules: fetch versioned docs, don't trust memory).

## Commands (repo root)

`npm test` · `npm run typecheck` · `npm run lint` · `npm run db:start` · `npm run db:reset` ·
`npm run db:test` · `npm run db:types` · `npm run fn:test`. Run all of test/typecheck/lint/db:test/fn:test before calling work done.
Use these root scripts, not the bare commands in `apps/mobile/AGENTS.md` (`typecheck` also generates route types).
Node 22 (`.nvmrc`, CI). `db:*` need Docker; `fn:test` is a POSIX loop, so on Windows npm's
`script-shell` must be Git Bash. Never report a check as passed unless it ran and passed; name the ones you couldn't run.

## Rules

- Add Expo deps with `npx expo install` (cloud sandbox only: `EXPO_OFFLINE=1 npx expo install`,
  the version API is blocked by the proxy there).
- No secrets in the app. Only `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  Third-party keys (Plant.id, RevenueCat secret) live in Edge Function secrets.
- Every user-owned table: RLS on, owner-only policies, pgTAP tests proving it (incl. a
  cross-user test). Server-controlled columns (e.g. `subscription_status`) are never
  writable by `authenticated` — use column-level grants.
- Schema changes only via `supabase/migrations/`; then `npm run db:types`.
- Gate paid features only through `useEntitlement()`.
- Sign-up email check: `before-user-created` auth hook (Edge Function). It must fail open on
  DNS problems; its user-facing messages are mirrored in `apps/mobile/src/auth/authErrors.ts`.
  Edge Functions keep zero runtime npm deps (the local runtime may not reach npm).
- After changing `supabase/config.toml`, restart Supabase (`npx supabase stop` + `npm run db:start`).
- Email confirmation is ON (sign-up → sign-in; resend has a 60 s cooldown matching
  `max_frequency`). Local emails go to Mailpit: http://127.0.0.1:54324.
- Appearance: **light by default** (not the phone's setting); users can choose Dark in Settings.
  Stored on the phone (`src/theme/appearance.ts`, AsyncStorage) and read before the first
  frame. `useTheme()` follows this choice, never `useColorScheme()`.
- UI follows `docs/superpowers/specs/2026-11-17-app-ui-design.md` (canvas linked there).
  Screens use `src/ui` + theme tokens only; raw colours outside `src/theme/` fail lint. Never cap
  font scaling (`maxFontSizeMultiplier`/`allowFontScaling={false}`). Icons: `Icon` (SF Symbols on
  iOS, Material Symbols elsewhere). No emoji.
- Screens with a primary action put it in `BottomBar` (pinned above the safe area); sheets keep Done in the header.
- **Loading rules (owner, 2026-11-17), every screen** — `docs/superpowers/specs/2026-11-17-loading-rules-design.md`:
  1. Lazy loading: fetch per screen, on demand, paged; images via `expo-image` (load when shown,
     cached); long lists virtualised (`FlatList`/`FlashList`, never `ScrollView` + `map`); heavy
     rarely-used modules load with their screen.
  2. UI before data: render the full layout immediately; never a blank screen or a
     full-screen spinner (`ActivityIndicator` only inside a busy button).
  3. Loading looks like the UI: wrap placeholders in `LoadingGroup` (300 ms delay, one
     "Loading" announcement) using `Skeleton` / `SkeletonText` / `SkeletonRow`; wrap arriving
     content in `FadeIn` (150 ms). The shared shimmer is the only looping motion allowed, runs
     only while a skeleton is mounted, and is static under Reduce Motion (`useReduceMotion`).
- Server data on the phone goes through TanStack Query (`src/lib/queryClient.ts`): show cached
  data instantly (kept 24 h), refresh in the background and when the app returns to the
  foreground; the cache is cleared on sign-out. A failed load with no cache shows "—", never a
  guessed value. No Redis until
  rate limiting or sustained DB load needs it.
- Animations use React Native's `Animated` (native driver where possible). Reanimated 4 can't
  load under Jest in this setup.
- Launch: native splash is plain paper (blank image, theme background) → `LaunchAnimation`
  (draws the pot ~0.7 s, rests 0.5 s, then fades out into the first screen) once per app run. The splash is hidden
  from the overlay's first layout, so the hand-off is paper to paper.
- Don't add expo-status-bar's `<StatusBar>`: it hangs React's act() in Jest; the system style
  already follows light/dark.
- Route files only in `src/app/`; tests go in `src/**/__tests__/` (not under `src/app/`).
- Plant library (M2; spec `docs/superpowers/specs/2026-11-17-m2-plant-library-design.md`, §8a security):
  - `species` is read-only to users; `scans` are inserted only by functions (service role); the owner may set
    `scans.plant_id` once, only to an own plant. `plants`/`scans` are owner-only under RLS.
  - Functions `identify-plant` (body exactly `{ photoPaths }`), `check-health`, `search-plants`; shared code in
    `supabase/functions/_shared` (plain `fetch`, no npm deps). `verify_jwt` on, validate every input and reject
    unknown fields, uniform errors (no stack/keys/provider text), body ≤ 10 KB, 20 Plant.id calls / 24 h / user,
    log only request id, user id, outcome. `PLANT_ID_API_KEY` only in `supabase/functions/.env` (git-ignored).
  - Photos: private bucket `plant-photos`, 3 MB, JPEG only, path `{uid}/{uuid}.jpg`. The app always re-encodes
    (`preparePhoto`: longest side ≤ 1600 px, JPEG 0.7) so no EXIF/GPS is uploaded; show via 1 h signed URLs.
    Deleting a plant removes its scans and every stored photo.
  - Security proofs (GPS-free upload, no objects left after delete, PNG / >3 MB rejected):
    `node apps/mobile/e2e/m2-security.mjs` (Playwright, local Supabase + `expo start --web --port 8081`).
- Add flow = four step screens in `src/app/(app)/add/` (photo, identify, where, health) with `StepProgress` / `StepDone`; motion tokens in `src/theme/motion.ts`.
- Press handlers stay synchronous (`void doAsync()`); RNTL awaits async handlers.
- Watering safety limits (≤ 40 ml/dose, ≤ 150 ml/24 h, never pump when float switch is low,
  stop after 2 doses with no moisture rise) live in firmware and the shared watering module.
  Never relax them; plans must stay inside them.
- **Ponytail (owner, 2026-11-17):** the laziest solution that works — YAGNI, standard library
  first, one line over fifty. Applies to every implementation and review.
- Test-first (TDD: failing test, then the smallest change that passes).
- **Git (owner, 2026-11-18):** commit freely on feature branches (one commit per task, never on
  `main`) and push them. When a big task is done, open a PR to `main` (`gh pr create`) with what
  changed, what was verified and what is open; the owner reviews and merges. Never merge, push to
  `main`, force-push or rewrite pushed history. Never discard or overwrite uncommitted work;
  check `git status` before editing. No new dependencies, speculative refactors or unrelated
  changes without asking.

## Agent workflow

The session's model is chosen at launch (`claude --model opus` or `/model`); this file can't set
it. The lead (Opus) plans, decides architecture, handles hard debugging and safety-critical
logic, integrates all delegated work and owns the final answer. Do small or tightly coupled work
directly; delegate only when it saves real effort.

| Agent (`.claude/agents/`) | Model | Use for |
|---|---|---|
| `Explore` | haiku | read-only lookups: where/how is X, summarize docs or code |
| `backend-implementer` | sonnet | migrations, RLS, pgTAP, Edge Functions |
| `mobile-implementer` | sonnet | screens, UI, hooks, TanStack Query, Jest tests |
| `test-quality` | sonnet | run checks, find coverage gaps (writes only assigned tests) |
| `code-reviewer` | sonnet | read-only review of a diff |

- Security-critical reviews (RLS, grants, auth, storage, Edge Functions, secrets, watering
  safety) and architecture decisions use Opus: do them as the lead, or pass `model: "opus"` to
  `code-reviewer`; the final whole-branch review also uses Opus. Haiku (`model: "haiku"`) is fine
  for tiny single-file fix rounds.
- Briefs are self-contained: goal, spec section, exact files the agent owns, checks to run.
  Ask for short reports. Give each question to one agent only; don't re-run research you have.
- **Parallel:** only independent tasks with no shared files; 2–3 agents by default. Dependent
  steps run in order. Research may run in parallel freely.
- **Worktrees:** use `isolation: "worktree"` only when two agents edit at the same time. Worktrees
  start from the current `HEAD` (`worktree.baseRef: "head"` in `.claude/settings.json`) and have
  no `node_modules` or `.env` files: the agent runs `npm ci` there, and `apps/mobile/.env.local`
  is not copied (create it from `.env.example` only if the task runs the app; Jest mocks
  Supabase). Never copy `supabase/functions/.env` into a worktree. The lead merges worktree
  branches into the feature branch, reviews the diff and removes the worktree.
- **Substantial task loop:** read the spec + code → list affected files → short plan → decide on
  delegation → implement (TDD) → integrate → run checks → `code-reviewer` on significant changes →
  fix confirmed issues → read the full `git diff` → update `docs/CURRENT_STATE.md` and
  `docs/TASKS.md` → commit + push → PR → report what changed, what was verified, what is still open.
- Process skills: Superpowers (brainstorming, writing-plans, subagent-driven-development, TDD,
  verification) and Ponytail are installed as user plugins; use them with these agents.
- Keep context lean: read only the spec sections you need, use `/compact` on long tasks and a
  fresh session per milestone. Record decisions in the docs, not only in chat.
