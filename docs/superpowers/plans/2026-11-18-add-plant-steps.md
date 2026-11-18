# Add a Plant as Steps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single "Add a plant" form with four step screens (Photo → What is it? → Where → Health), each ending in a calm success moment, with a 4-segment progress bar.

**Architecture:** Each step is its own route in the existing `src/app/(app)/add/` stack, sharing the in-memory draft (`src/plants/addDraft.tsx`). Two new house components (`StepProgress`, `StepDone`) and motion tokens carry the progress/success motion with React Native `Animated` (native driver). Server, database and security are unchanged.

**Tech Stack:** Expo SDK 58, Expo Router, TanStack Query 5, React Native `Animated`, jest-expo + RNTL, Playwright (e2e script).

**Spec:** `docs/superpowers/specs/2026-11-18-add-plant-steps-design.md` (approved; §7a edge cases are binding). Background: `docs/superpowers/specs/2026-11-17-m2-plant-library-design.md` §6, §8a.

## Global Constraints
- All of `CLAUDE.md`: tokens only (no raw colours), never cap font scaling, `Icon` component, no emoji, LoadingGroup/FadeIn rules, press handlers synchronous, TanStack Query, `BottomBar` for the primary action, test-first, Ponytail (smallest change).
- No new dependencies (no Reanimated, no haptics). Motion with RN `Animated`, `useNativeDriver: true` for transform/opacity.
- Motion values: ease-out `Easing.bezier(0.23, 1, 0.32, 1)`; success 200 ms; progress 250 ms; text stagger 60 ms; enter from `scale 0.95, opacity 0`; never scale from 0; no bounce. Reduce Motion (`useReduceMotion`): opacity only, progress instant.
- Title "Add a plant" on every step; Cancel plain text top right; 4 segments.
- Photos: identify sends whole + leaf + flower (≤ 3); health sends whole + problem (≤ 2). Leaf/flower deleted on save when no identify scan; problem photo kept for the check.
- Name saved = nickname → chosen type's common name (Plant.id names-only hit → scientific name) → custom type; required on step 3 only when none exists. 1–60 chars; room ≤ 40.
- Copy (verbatim): "Take a photo of your plant", "Got it.", "What kind of plant is it?", "Identify from my photo", "I know it — search", "Skip", "Not sure? You can set it later.", "It's a {type}.", "Where does it live?", "{name} is in the {room}." / "{name} is saved.", "Want a quick health check?", "Check its health now", "Skip for now", "Looking at your plant…", "Try again", "Couldn't check right now." Existing identify/limit copy unchanged.

## Review Focus
1. Double tap on step 3 Continue (or returning to step 3) → exactly one plant created. (Task 4)
2. Step 4 remounts / re-renders with a problem photo → exactly one health check (one credit). (Task 5)
3. Leaving step 4 by any route (Done, Skip, swipe-down, Android back) → plant + whole photo kept; unused problem photo deleted only when no check started. (Task 5)
4. Back to step 1 and changing photos after identify → step 2 starts fresh (no stale type/scan). (Task 2)
5. Very long nickname / room / emoji / RTL → limits enforced (60 / 40), success line wraps, no layout break. (Task 4)

---

### Task 1: Motion tokens, StepProgress, StepDone

**Files:**
- Create: `apps/mobile/src/theme/motion.ts`, `apps/mobile/src/ui/StepProgress.tsx`, `apps/mobile/src/ui/StepDone.tsx`
- Modify: `apps/mobile/src/theme/index.ts`, `apps/mobile/src/ui/index.ts`
- Test: `apps/mobile/src/ui/__tests__/steps.test.tsx`

**Interfaces:**
- Produces: `motion = { easeOut: EasingFunction, duration: { success: 200, progress: 250 }, stagger: 60 }` from `@/theme`; `StepProgress({ step: 1|2|3|4, total?: 4 })` (segments < step filled, segment `step` animates `scaleX` 0→1 from the left on mount; accessibilityRole "progressbar", label "Step {step} of {total}"); `StepDone({ title: string, children?: ReactNode })` (check `Icon` in a status-good circle + title + optional content; enters per Global Constraints; accessibilityLiveRegion polite).

- [ ] **Step 1: Write failing tests**: `StepProgress` exposes label "Step 2 of 4" and renders 4 segments with the first two marked filled (testID `segment-{n}` + accessibilityState or a `filled` prop readable in test); `StepDone` renders its title and children; with `useReduceMotion` mocked true, `StepDone`'s animated style has no `transform` and `StepProgress`'s current segment starts filled.
- [ ] **Step 2: Run** `npx jest src/ui/__tests__/steps.test.tsx` → FAIL (modules missing).
- [ ] **Step 3: Implement** the three files with `Animated.timing` + `motion` tokens; colours from theme status tokens (good + its fill).
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Commit** `feat(ui): step progress and success moment`.

### Task 2: Draft, step 1 (Photo) and the add stack

**Files:**
- Create: `apps/mobile/src/app/(app)/add/photo.tsx`
- Modify: `apps/mobile/src/plants/addDraft.tsx`, `apps/mobile/src/app/(app)/add/_layout.tsx`, `apps/mobile/src/app/(app)/index.tsx` (+ any `'/add/plant'` push), `apps/mobile/src/plants/CaptureCards.tsx` (only if needed for inline use)
- Test: `apps/mobile/src/plants/__tests__/AddSteps.test.tsx` (new; grows over Tasks 2–5)

**Interfaces:**
- Produces: `Draft` = `{ photos, scanId?, suggestions?, species?, nickname: string, room: string, plantId?: string, healthStarted?: boolean }` (`name` removed); `typeName(draft): string | undefined` and `plantName(draft): string | undefined` exported from `addDraft.tsx` (rule in Global Constraints; `species` gains an optional `scientific` for names-only hits if needed); `clearIdentify(set)` helper or inline: changing photos sets `scanId`, `suggestions`, `species` to undefined.
- Routes: `add/photo` (first screen, `headerBackVisible: false`, `gestureEnabled: false`), `add/identify`, `add/search` (kept), `add/where`, `add/health`; every screen title "Add a plant", headerRight Cancel (TextLink), `StepProgress` under the header (headerTitle or top of content — builder's call).
- Consumes: Task 1 components; `CaptureCards` (cards prop), `BottomBar`.

- [ ] **Step 1: Write failing tests** in `AddSteps.test.tsx`: "+ opens step 1" shows "Take a photo of your plant" and "Step 1 of 4"; Continue disabled until the whole-plant photo is uploaded; after upload "Got it." shows with that photo; Whole plant card has no Skip, the other three do; Continue pushes `/add/identify`; Cancel deletes all uploads and closes; changing photos after an identify clears `scanId`/`suggestions`/`species` (Review Focus 4).
- [ ] **Step 2: Run** `npx jest src/plants/__tests__/AddSteps.test.tsx` → FAIL.
- [ ] **Step 3: Implement** draft changes, `photo.tsx` (CaptureCards inline with `ADD_CARDS`), layout routes, home/empty-state push `/add/photo`.
- [ ] **Step 4: Run** → PASS; `npm run typecheck` clean (old `add/plant.tsx`, `capture.tsx` may still compile against `nickname` — adapt minimally or leave for Task 6 deletion; keep the app compiling).
- [ ] **Step 5: Commit** `feat(mobile): add-a-plant step 1 (photo)`.

### Task 3: Step 2 (What is it?)

**Files:**
- Create: `apps/mobile/src/app/(app)/add/identify.tsx`
- Modify: `apps/mobile/src/app/(app)/add/search.tsx` (return to identify with the pick), `apps/mobile/src/plants/Suggestions.tsx` (only if needed)
- Test: `AddSteps.test.tsx`

**Interfaces:**
- Consumes: `useIdentify`, `Suggestions`, `TypeSearch` via `add/search`, draft `species`/`scanId`/`suggestions`.
- Produces: draft `species` set (local id + common name, names-only id + scientific name, or `{custom}`); success via `StepDone` "It's a {type}." (+ scientific name line when known).

- [ ] **Step 1: Write failing tests**: "Identify from my photo" calls identify with whole+leaf+flower paths only (never problem); Very likely top suggestion applied automatically and "It's a moth orchid." shows; tapping another suggestion switches; "I know it — search" pushes `/add/search` and a pick returns with the success line ("It's a {custom}." for a custom type, no scientific line); failure / not a plant / 429 show existing copy and keep search + Skip available; Skip shows "Not sure? You can set it later." and Continue goes to `/add/where`; Continue always enabled; identify scan stays in draft after a search pick.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `identify.tsx`; `search.tsx` sets the draft and `router.back()` to identify.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mobile): add-a-plant step 2 (what is it)`.

### Task 4: Step 3 (Where) — the save point

**Files:**
- Create: `apps/mobile/src/app/(app)/add/where.tsx`
- Test: `AddSteps.test.tsx`

**Interfaces:**
- Consumes: `useCreatePlant` (`NewPlant = { name, room?, speciesId?, customType?, photoPath?, scanId? }`), `deletePhotos`, `plantName(draft)`, `typeName(draft)`.
- Produces: draft `plantId`; navigation `router.replace('/add/health')`.

- [ ] **Step 1: Write failing tests**: fields Room ("Optional", maxLength 40) and Nickname (placeholder = `typeName(draft)` or "Required" when none, maxLength 60); ScrollView has `automaticallyAdjustKeyboardInsets` + `keyboardShouldPersistTaps="handled"`; Continue disabled only when no type and no nickname; Continue creates the plant once with `name: plantName(draft)` (nickname wins; else type), `photoPath` whole, `scanId`; double tap → `createPlant` called once (Review Focus 1); leaf/flower deleted when no `scanId`, kept when present; problem photo never deleted here; success "{name} is in the {room}." or "{name} is saved." then `router.replace('/add/health')`; a 60-char emoji/RTL nickname saves and the success line wraps (Review Focus 5).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `where.tsx` (guard with draft `plantId` + mutation pending state; show the success moment briefly, then replace — builder picks the delay, ≤ 800 ms, or replace immediately and show "saved" on step 4's header area; keep it simple).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mobile): add-a-plant step 3 (where) saves the plant`.

### Task 5: Step 4 (Health) and the shared result view

**Files:**
- Create: `apps/mobile/src/app/(app)/add/health.tsx`, `apps/mobile/src/plants/HealthResult.tsx`
- Modify: `apps/mobile/src/app/(app)/plant/[id]/health.tsx` (use `HealthResult`), `apps/mobile/src/app/(app)/add/_layout.tsx` (health: no back, `gestureEnabled: false`, Cancel → Done)
- Test: `AddSteps.test.tsx`, existing `PlantDetail.test.tsx` stays green

**Interfaces:**
- Consumes: `useCheckHealth` (`mutationKey ['check-health']`, variables `{ plantId, photoPaths }`), `useHealthCheckStatus(plantId)`, draft `plantId`, `photos`, `healthStarted`.
- Produces: `HealthResult({ result: HealthResult, photoUri?: string })` — the redesigned result (photo, status line, note, "What to do") extracted unchanged from `plant/[id]/health.tsx`.

- [ ] **Step 1: Write failing tests**: with a problem photo the check starts on mount with `[whole, problem]` and "Looking at your plant…" shows; re-render/remount does not start a second check (`healthStarted`; Review Focus 2); without a problem photo "Want a quick health check?" with "Check its health now" (sends `[whole]`, no capture screen) and "Skip for now"; result renders `HealthResult`; failure shows the error line (429 server copy / "Couldn't check right now.") plus "Try again" and "Skip for now"; Done (and Skip) dismisses the add stack and opens `/plant/{plantId}`; unmount without a started check deletes the problem photo only; after a started check nothing is deleted (Review Focus 3); Android back = Done (BackHandler).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `HealthResult.tsx` (move, don't duplicate), `add/health.tsx`, layout options. Closing: dismiss the add cover (e.g. `router.dismissTo('/')` or `router.dismissAll()` then `router.push('/plant/{id}')` — whichever Expo Router 58 docs confirm; check versioned docs per AGENTS.md).
- [ ] **Step 4: Run** → PASS, plus `npx jest src/plants/__tests__/PlantDetail.test.tsx`.
- [ ] **Step 5: Commit** `feat(mobile): add-a-plant step 4 (health)`.

### Task 6: Remove the old form, e2e, docs, verification

**Files:**
- Delete: `apps/mobile/src/app/(app)/add/plant.tsx`, `apps/mobile/src/app/(app)/add/capture.tsx`, old `AddPlant.test.tsx` cases they cover (move any still-valid case into `AddSteps.test.tsx`)
- Modify: `apps/mobile/e2e/m2-security.mjs` (drive step 1 → … → step 3 save; GPS and delete proofs unchanged), `CLAUDE.md` (one line: add flow = four step screens with StepProgress/StepDone; motion tokens in `src/theme/motion.ts`), M2 spec §5.2 pointer to the new design.

- [ ] **Step 1:** Delete the old screens; `grep -rn "add/plant\|add/capture" apps/mobile/src apps/mobile/e2e` → no hits.
- [ ] **Step 2:** Run `npm test` (--forceExit ok), `npm run typecheck`, `npm run lint`, `npm run fn:test`, `npm run db:test` → all pass.
- [ ] **Step 3:** Run the e2e script per its header (`node apps/mobile/e2e/m2-security.mjs` with the web app on :8081 and local Supabase) → every check PASS.
- [ ] **Step 4:** Web screenshots (phone size, light + dark) of each step incl. success states and step 4's three states (Playwright route fixtures for functions) into `/tmp/claude-0/-home-user-plant-care/06e2532b-fe64-530e-8207-bfb9aa93d5e3/scratchpad/m2-screens/steps/`; look at them and fix anything broken.
- [ ] **Step 5: Commit** `refactor(mobile): retire the single add form; e2e and docs for the steps`.
