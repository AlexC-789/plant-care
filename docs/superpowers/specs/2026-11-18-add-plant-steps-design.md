# Add a plant as steps — design

Date: 2026-11-18
Status: Approved by owner 2026-11-18
Supersedes: M2 design (`2026-11-17-m2-plant-library-design.md`) §5.2 and the add-flow parts of §5.3 / §5.7.
Builds on: M2 design §5.3–5.7, §6, §8a (unchanged: data, functions, security, limits).

## 1. Intent
Adding a plant should feel like a series of small wins, not filling in a form. Owner (2026-11-18):
"make it more interactive so that the user feels success at every step … different screens for adding a
photo, identifying if needed, adding the room and finally the health check."

## 2. Goals / non-goals / anti-goals
**Goals**
- Four step screens: **Photo → What is it? → Where → Health**, each ending in a short success moment.
- A visible sense of progress across the steps.
- Optional nickname; the plant is otherwise called by its type.
- Health check runs automatically only when there's a Problem spot photo; otherwise it's offered (owner chose option b).
- Calm motion that respects Reduce Motion.

**Non-goals:** device steps (module, Wi-Fi, pot, stake, tank — later milestones join the same flow);
haptics (owner: add for production); Reanimated (owner: switch when gestures arrive); changes to the
Edit sheet, detail screen, functions, database or security.

**Anti-goals:** confetti/bounce/celebration noise (the app is calm); spending a Plant.id credit the user
didn't ask for (health only with a problem photo or an explicit tap); asking for the same photos twice
(owner complaint 2026-11-17); losing a plant because a step failed.

## 3. Approaches (owner picked 1)
1. **One screen per step inside the existing add stack (chosen).** Native push transitions and back
   swipe for free; smallest change; device steps later append screens. Owner: "if I don't like it we'll
   do the second."
2. One screen swapping step content with a custom slide. Full control of the transition, but back
   handling and gestures rebuilt by hand — more code, easier to feel non-native.
Motion tool (owner agreed): React Native's built-in `Animated` with the native driver (Reanimated can't
load under Jest here; revisit when gestures arrive).

## 4. The flow

Header on every step: title, Cancel (plain text, top right), and a **4-segment progress bar** under it.

```
Step 1  Photo          "Take a photo of your plant"
        Cards: Whole plant (required) · One leaf · Flower · Problem spot (these three skippable)
        ✓ "Got it." — the whole-plant photo shown large                     [Continue]

Step 2  What is it?    "What kind of plant is it?"
        [Identify from my photo]  (explicit tap; 1 credit)    [I know it — search]    Skip
        → suggestions list (tap applies; Very likely / Likely / Possibly)
        ✓ "It's a moth orchid." — common + scientific name                  [Continue]

Step 3  Where          "Where does it live?"
        Room (optional) · Nickname (optional; placeholder = the type, e.g. "Moth orchid")
        Continue SAVES the plant
        ✓ "Moth orchid is in the Living room."  (or "Moth orchid is saved.")

Step 4  Health         with a Problem spot photo: runs automatically → "Looking at your plant…" → result
                       without: "Want a quick health check?" [Check its health now] [Skip for now]
                       "Check now" uses the photos already taken (whole plant [+ problem spot]) — no re-prompt
        Result = the redesigned health result (photo, status line, note, What to do)
        [Done] → closes the flow and opens the new plant's detail
```

### Rules
- **Name:** nickname if given, else the species' first common name, else the custom type. If none of
  those exists (step 2 skipped and no search pick), step 3 requires a name ("Name it" — Required).
  Stored in `plants.name` (1–60) as today.
- **Step 2 skip / failure:** "Not sure? You can set it later." Skip continues with no type.
  Identify failure / not a plant / limit → the existing copy, with search offered; never blocks Continue.
- **Photos:** prepared + uploaded as soon as chosen (unchanged). Identify sends whole + leaf + flower;
  health sends whole + problem spot (function caps 3 / 2). On save (step 3): leaf/flower deleted if no
  identify scan (R5); problem spot kept for the health check.
- **Saving:** the plant is created at the end of step 3 (the health check needs a plant id). Before
  that, Cancel deletes every upload and saves nothing. From step 4, Back is hidden and Cancel becomes
  **Done** (the plant exists; leaving keeps it). If the user leaves step 4 without checking, unused
  problem-spot photo is deleted.
- **Continue** sits in the BottomBar on every step. It's enabled when the step is satisfiable:
  step 1 needs the whole-plant photo uploaded; steps 2 and 3 are always satisfiable (step 3 needs a
  name only in the no-type case).
- **Back:** native back between steps 1–3 keeps everything entered (shared draft).

## 5. Motion (from the animation review)
- **Gate:** adding a plant is rare → delight budget allowed. Purposes: progress (state indication) and
  feedback (step done).
- **Between steps:** the native stack push (no custom transition).
- **Progress bar:** 4 segments; the current segment fills left→right via `scaleX` (transform origin
  left) over 250 ms with the strong ease-out `Easing.bezier(0.23, 1, 0.32, 1)`; completed segments stay
  filled. Reduce Motion: instant.
- **Success moment (`StepDone`):** a check in a soft status-good circle enters from `scale 0.95,
  opacity 0` → `1, 1` in 200 ms (same ease-out); its line of text fades in 60 ms later (200 ms).
  Never scale from 0, no bounce. Reduce Motion: opacity only.
- **Tokens:** add `src/theme/motion.ts` — `easeOut`, `durations { fast: 200, progress: 250 }`,
  `stagger: 60` — and use them; native driver for transform/opacity.

## 6. Structure (builder's call within this)
- Routes under `src/app/(app)/add/`: `photo` (step 1, replaces `plant`), `identify` (step 2), `search`
  (kept, pushed from step 2), `where` (step 3), `health` (step 4). `capture` is folded into step 1
  (CaptureCards inline). The draft context (`src/plants/addDraft.tsx`) gains `nickname` and the saved
  `plantId`.
- New house pieces: `src/ui/StepProgress.tsx`, `src/ui/StepDone.tsx` (exported from `src/ui`).
- Health step reuses the health result UI from `plant/[id]/health.tsx` (extract the result view into
  `src/plants/HealthResult.tsx` rather than duplicating it).
- Copy above is the starting copy; keep it short and plain.

## 7. Testing
- Each step: renders its heading, Continue rules, success moment after the action.
- Name rule (nickname / type / custom / required case); save happens once at step 3; Cancel before
  save deletes uploads; leaving step 4 keeps the plant.
- Health step: auto-runs only with a problem photo; "Check now" uses existing photos (no capture
  screen); Skip closes to detail.
- Motion: Reduce Motion path renders without transforms (assert props); tokens used.
- Browser screenshots of all four steps, light and dark; owner checks feel on the phone.

## 7a. Edge cases (controller's calls after the builder check — owner may correct)
1. **Save point.** Continue on step 3 creates the plant once: the saved `plantId` lives in the draft and a
   second tap (or a return to step 3) never creates another plant. Step 3 → step 4 uses `router.replace`
   so step 3 is no longer underneath; step 4 has no Back, `gestureEnabled: false`, and Android back
   acts as Done.
2. **Automatic health check** runs once per flow (guarded by a draft flag, so re-renders/remounts never
   spend a second credit). It uses the shared check mutation (`mutationKey ['check-health', plantId]`) so
   tapping Done mid-check is fine: the detail screen keeps showing "Looking at your plant…" and the
   result. On failure step 4 shows the error line (limit → server copy; else "Couldn't check right now.")
   and falls back to the offer: **Try again** / **Skip for now**.
3. **Leaving step 4** (Done, Skip, Cancel, swipe-down — handled in one unmount cleanup): the plant and its
   whole-plant photo are kept; the problem-spot photo is deleted only if no check was started.
4. **Step 1:** Whole plant has no Skip (required); the other three cards can be skipped. When the
   whole-plant photo is uploaded, "✓ Got it." with that photo large appears above the cards (cards stay
   for adding more). Going back to step 1 and changing photos clears the identify result
   (`scanId`, suggestions, applied type) so step 2 starts fresh.
5. **Step 2:** a Very likely top suggestion is applied automatically and the success line shows at once;
   tapping another suggestion switches it. A search pick (or custom type) after an identify keeps the
   identify scan linked. Custom type success copy: "It's a {type}." (no scientific name).
6. **Name:** the draft's `name` becomes `nickname` (only what the user typed); the saved name is derived
   at save time: nickname → the chosen type's common name (from the suggestion / search hit; Plant.id
   names-only hits fall back to the scientific name) → custom type. Step 3's placeholder and success
   copy follow the current type.
7. **Tests:** `AddPlant.test.tsx` is rewritten for the steps; the e2e security script
   `apps/mobile/e2e/m2-security.mjs` is updated to drive the new screens and must still pass.
8. **Progress bar:** each step screen draws earlier segments filled and animates its own segment on mount.
   Step 1 keeps no Back (`headerBackVisible: false`); title "Add a plant" on every step.
9. **Done** on step 4 closes the whole add cover (dismiss the add stack) and opens `/plant/{id}`.

## 8. Left to the builder
Exact copy polish within the tone above, component boundaries, how the progress bar is placed in the
header, test structure.
