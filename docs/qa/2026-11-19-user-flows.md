# User flows (QA inventory)

_2026-11-19, from the code on `m4-devices` (every route in `apps/mobile/src/app/` and the shared
components they use). This is the checklist the QA pipeline is measured against: every flow and
branch here should be covered by at least one test, or listed as not covered on purpose._

**Where it can be tested**
- **Web**: Playwright against the web build + local Supabase (+ `sim/` for modules).
- **Native**: needs a real phone or emulator (camera, native back button, OS permission dialogs,
  native start-up, push to Settings app).
- **Sim**: needs the module simulator (`node sim/sim.ts --claim CODE --scenario …`).

**Priority**: P1 = data loss, security, watering safety or the core job is blocked. P2 = the user is
stuck or misled. P3 = polish.

Jest already tests every screen with Supabase mocked (~330 tests). What it can't catch: the real
backend, real navigation between screens, real rendering, speed. Those are this pipeline's job.

---

## A. Start-up and session

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| A1 | Cold start, signed out | Paper splash → pot drawing (~0.7 s) → fades into Sign in. Plays once per app run, not on every screen. | Web, Native | P2 |
| A2 | Cold start, signed in | Same animation → Plants home; no flash of Sign in. | Web, Native | P2 |
| A3 | Appearance before first frame | Stored Dark → first frame is dark (no light flash). Default with nothing stored = Light, even if the phone is in dark mode. | Web, Native | P3 |
| A4 | Session expires / signed out elsewhere | Any signed-in screen → lands on Sign in; cached data cleared. | Web | P1 |
| A5 | App returns from background | Home and plant detail refresh; cached data shows instantly first. | Native | P2 |
| A6 | Open a signed-in URL while signed out | `/plant/<id>`, `/settings` → redirected to Sign in. | Web | P1 |
| A7 | Open Sign in while signed in | → redirected to Plants home. | Web | P3 |

## A+. First run without sign-up first (planned, not built)

Model A, owner-approved direction; written up in `docs/design/UX_ARCHITECTURE.md` §3, §6, §8,
`SCREEN_SPECIFICATIONS.md` and `DESIGN_ROADMAP.md` §3–4 (confirmed by the design session,
2026-11-19). Nothing built yet; starts after M4 merges. Replaces A1/B1 as the first thing a new
user sees. Backend is open (`DESIGN_ROADMAP.md` §4 items 1–3): proposed Supabase anonymous sign-in,
guest identify limit 3, captcha on guest sign-in; Apple/Google undecided (email is the minimum);
undecided what happens to a guest plant when signing in to an existing account. Rows change with
those decisions.

Order: Welcome → Capture → Result → Name and place → "Keep {name}" sheet → Health → module offer →
Connect → Fill the tank → Notifications → Plants.

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| N1 | Welcome | Only "Scan a plant" and "I already have an account" (→ Sign in). "Start from a module" is a later branch. | Web, Native | P1 |
| N2 | Guest capture | Photo now; 3D scan later with "Use a photo" fallback. Captcha on guest sign-in. | Web, Native | P1 |
| N3 | Result | Confident → the type; low confidence → "Might be" with alternatives; guest limit (3) reached → account sheet. | Web (stub Plant.id) | P1 |
| N4 | Name and place | Name; room as chips; light Bright / Medium / Low. | Web | P2 |
| N5 | "Keep {name}" sheet | Guest plant is already saved at "Save {name}". Email (Apple/Google if decided); Terms + Privacy. Neutral "Not now" → the plant stays as a guest plant; adding a module needs an account. Guest plant survives closing the app, email confirmation and sign-in. (PR #10, cb52776.) | Web (email), Native (Apple/Google) | P1 |
| N6 | Guest data moves to the account | Capture, scan and plant end up owned by the new account; nothing lost; nobody else can claim a guest's data. Existing account: move via a function or drop (undecided). | Web | P1 |
| N7 | Health | Same as D11, now after the account. | Web | P1 |
| N8 | Module offer | Yes → Connect (F1, M4 copy; "It isn't connecting" opens a checklist) → Fill the tank (Done enabled only when full; "I'll fill it later") → N9. "Not now" → straight to Plants. | Web, Sim | P2 |
| N9 | Notifications | Asked only after the first module setup ("The tank is full"); "Not now" never triggers the OS prompt; never on the skip-module path; alerts clear when the condition clears (tank: one reminder after 24 h). Camera permission asked on the "Scan a plant" tap, with a reason. | Native | P2 |
| N10 | Launch (redesign) | Shorter, no rest, tap to skip, plays on every cold start; target ≤ 1,000 ms to a usable screen. | Web, Native | P2 |
| N11 | Watering transparency (redesign) | "Resume watering": Sent → pending → "Watering resumed" when the module confirms; "why it isn't watering" line; "How watering works" sheet with the limits; Home opens with a just-added plant already cached. | Web, Sim | P1 |

**Redesign changes to existing flows** (same source; update the rows above when built):
- Home (C5, C6): "{n} need you" first, then a "{m} doing well" grid; plants without a module and
  wet-soil plants count as doing well; status copy loses the middle dots; "Add a pot" → "Add a plant".
- Plant detail (E1–E5): hero photo, status headline + line, tank bar, Soil / Last drink / Battery
  rows, a "Photos and watering history" row, ⋯ menu (Edit, Check its health, Remove module, Delete).
  StatusBanner is retired.
- Add flow (D): route `add/photo` → `add/capture`; rooms are chips; light is a three-way choice;
  Health runs after the account.
- Settings (I): guests see "Keep your plants".

## B. Account

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| B1 | Sign up | Valid email + ≥ 8-char password → Sign in with "confirmation sent" notice and email pre-filled. Email arrives (Mailpit locally). | Web | P1 |
| B2 | Sign up, bad input | Empty / malformed email; password < 8; field errors shown, nothing sent. | Web | P2 |
| B3 | Sign up, existing email | "An account with this email already exists. Sign in instead." | Web | P2 |
| B4 | Sign up, disposable or no-mail domain | Blocked by the `before-user-created` hook with its message; DNS failure lets sign-up through (fail open). | Web | P2 |
| B5 | Confirm email link | Valid link → "Email confirmed" page → Sign in. Used/expired link → "Link expired". Page never signs anyone in. URL is cleaned after reading. | Web | P1 |
| B6 | Sign in before confirming | "Confirm your email first…" + Resend button; resend → "Confirmation email sent to …"; 60 s cooldown; too many → rate-limit message. | Web | P2 |
| B7 | Sign in | Correct → Plants home. Wrong password → "Email or password is incorrect." Double-tap sends once (busy button). | Web | P1 |
| B8 | Switch Sign in ↔ Sign up | Footer links replace the screen (no stack build-up). | Web | P3 |
| B9 | Sign out | Settings → Sign out → Sign in; back gesture can't return; next user sees none of the previous user's cached plants. | Web | P1 |

## C. Plants home

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| C1 | Empty library | Pot drawing, "No plants yet", Add a pot → add flow. | Web | P2 |
| C2 | Loading | Layout first, skeleton rows after 300 ms, never a blank screen or full-screen spinner. | Web | P2 |
| C3 | Load fails, no cache | "Couldn't reach Plant Care…" + Try again. Never guessed values. | Web | P2 |
| C4 | Load fails, cache present | Cached list stays; no error wipe-out. | Web | P2 |
| C5 | List with plants | Summary "N need you · M doing well"; "Needs you" section only when something needs you; photo thumbnails; tap → plant detail. | Web, Sim | P1 |
| C6 | Status per plant | Each status line: setup, waiting, fault, tank, offline (± low battery), wet, battery, fine (see F). | Web, Sim | P1 |
| C7 | Long list | Paging loads more on scroll; virtualised (no lag at 100+ plants). | Web | P2 |
| C8 | Pull to refresh; refocus | Pull refreshes; coming back from detail/setup refetches. | Web | P2 |
| C9 | Header buttons | Add a pot (+), Settings. | Web | P3 |

## D. Add a plant (4 steps, full-screen)

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| D1 | Happy path | Whole-plant photo → Identify → pick suggestion → Where (room, nickname) → Continue saves once → health check → Done → plant detail; plant on home. | Web (library pick), Native (camera) | P1 |
| D2 | Photo step | Continue disabled until whole-plant photo; optional leaf / flower / problem cards (add, remove, skip); Take photo vs Choose from library. | Web, Native | P1 |
| D3 | Camera / library permission denied | Message + Open Settings. | Native | P2 |
| D4 | Uploaded photo is clean | Re-encoded JPEG ≤ 1600 px, no EXIF/GPS; PNG and > 3 MB rejected by storage (covered by `e2e/m2-security.mjs`). | Web | P1 |
| D5 | Identify | Very likely → applied automatically; up to 3 suggestions to choose; not a plant / no result → "Couldn't tell…"; daily limit (20/24 h) → limit message; button busy, Continue disabled while busy. | Web (stub Plant.id) | P1 |
| D6 | Search a type | "I know it — search" → results (`Name — Scientific`) → pick; no match → "Use "term" as the type" (custom). | Web | P2 |
| D7 | Skip type | Skip → "Not sure? You can set it later."; Where then requires a Name. | Web | P2 |
| D8 | Where step | Name required when no type (nickname optional with type); room ≤ 40, name ≤ 60; save failure → "Couldn't save your plant. Try again." and retry works; double tap creates one plant; Cancel hidden while saving/saved. | Web | P1 |
| D9 | Cancel at steps 1–3 | Plant not created; every uploaded photo deleted from storage. | Web | P1 |
| D10 | Leaf/flower photos after save | Deleted when no identify scan used them. | Web | P2 |
| D11 | Health step | Problem photo → check starts automatically; else offer: Check / Skip for now; result shown; error → Try again; limit message; Done/Skip/Android back all keep the plant and open its detail; failed check's problem photo deleted. | Web, Native (back) | P1 |
| D12 | Re-entering steps after save | Back to step 1/2 after save → redirected to health (no second plant). | Web | P1 |

## E. Plant detail

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| E1 | View | Hero photo (or pot drawing), name, type/scientific, room; skeleton while loading; "—" if it can't load. | Web | P2 |
| E2 | Another user's plant / unknown id | Shows "—", no data leaked (RLS). | Web | P1 |
| E3 | More options menu | Edit plant; Remove module (only with a module) → confirm → removed; Cancel. | Web, Sim | P1 |
| E4 | Status banner + module card | Water left (rounded to 50 ml / "Needs refilling"), soil (Dry/Damp/Very wet + %), battery, checked in; refreshes every 30 s; module load fails → card with "—". | Web, Sim | P1 |
| E5 | Fault → Resume watering | `no_moisture_rise` fault banner + Resume watering → "Resumes at the next check-in…"; other fault text says it resumes by itself. | Web, Sim | P1 |
| E6 | About this plant | Species care info when a species is set. | Web | P3 |

## F. Module (device) — needs the simulator

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| F1 | Add its module | Banner button → code shown (`XXXX XXXX XXXX`), expiry time; sim claims it → jumps to Fill the tank; home no longer says setup unfinished. | Web, Sim | P1 |
| F2 | Code expires (15 min) | "This code expired." → New code. | Web (clock) | P2 |
| F3 | Code fails | "Couldn't make a code. Try again." → retry. | Web | P2 |
| F4 | Fill the tank | Vessel fills as the sim reports; ≥ 90 % → "The tank is full." → back; Done leaves any time. | Web, Sim | P2 |
| F5 | Status states | setup → waiting (no reading yet) → fine; wet (> 55 %); battery < 20 %; offline (> 3 sync intervals, ± low battery); tank low; fault. Priority order: fault > tank > offline > waiting > wet > battery > fine. | Web, Sim | P1 |
| F6 | Watering safety | Plans never exceed 40 ml/dose, 150 ml/24 h; no pump with float low; stop after 2 no-rise doses (sim + `fn:test`). | Sim | P1 |
| F7 | Remove module | Module unpairs at its next check-in (410 twice); plant goes back to "setup". | Web, Sim | P1 |
| F8 | Real module setup over Wi-Fi | Not built yet (M7). | — | — |

## G. Photos and health

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| G1 | Timeline strip | Thumbnails newest first; See all; tap opens viewer at that photo. | Web | P2 |
| G2 | Add a photo from detail | Take photo / Choose from library / Cancel; becomes the main photo; then inline "Check its health" / Not now offer; permission denied → Open Settings. | Web, Native | P2 |
| G3 | Photo viewer | Swipe pages; date; health result for that photo; loads further pages when opened deep; "—" on failure. | Web | P2 |
| G4 | Delete a photo | Confirm → deleted from timeline and storage; main photo becomes the next newest; last photo → viewer closes. | Web | P1 |
| G5 | What is it? (from a photo) | Suggestions → pick → "Plant type updated."; none → "Couldn't tell…"; search → Edit. | Web (stub) | P2 |
| G6 | Health check from detail | Health card → screen with whole + problem cards → Check (needs whole photo) → result → Done; error → retry; limit message; leaving before checking deletes the uploaded photos. | Web (stub) | P1 |
| G7 | Health card states | No check yet, pending, failed, latest result. | Web | P3 |

## H. Edit and delete

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| H1 | Edit | Change name / type (search, custom) / room → Save → detail updated; empty name → "Give it a name…"; save fails → "Couldn't save that…". | Web | P2 |
| H2 | Delete plant | Delete plant → confirm → home; plant, scans, every photo and the module gone (no storage objects left — `e2e/m2-security.mjs`). Cancel keeps it. | Web | P1 |

## I. Settings

| ID | Flow | Branches / edge cases | Where | P |
|---|---|---|---|---|
| I1 | Appearance | Light / Dark; applies instantly; survives restart. | Web | P3 |
| I2 | Units | Automatic / Metric / Imperial saved to the profile; skeleton while loading; error shown on failure. | Web | P3 |
| I3 | Plan | Subscription: Active / Free (testing) / "—" on failure. User can't change it themselves (DB grant). | Web | P1 (grant) |
| I4 | Account | Shows email; Sign out (B9). | Web | P2 |

## J. Cross-cutting checks (apply to every screen above)

| ID | Check | Where |
|---|---|---|
| J1 | Light and Dark | Web |
| J2 | Largest text size (no caps on font scaling): nothing cut off or overlapping | Web (zoom), Native |
| J3 | Small phone (iPhone SE), large phone, tablet widths | Web |
| J4 | Screen reader: every control has a role + label; errors announced | Web (axe), Native |
| J5 | Reduce Motion: shimmer static, no looping motion | Web |
| J6 | Slow / no network: skeletons, then "—" or error; never a blank screen | Web |
| J7 | Speed: time to first screen, time to content, no layout jumps | Web, Native |
| J8 | iOS vs Android differences (back button, header styles, keyboard) | Native |

---

Not covered by any flow on purpose: subscriptions/paywall (RevenueCat comes later), real module
Wi-Fi setup (M7), onboarding before sign-up (planned).
