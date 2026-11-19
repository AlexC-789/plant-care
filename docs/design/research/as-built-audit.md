# Plant Care app: as-built UX audit (2026-11-18)

Scope: `apps/mobile/src` on the current branch. Branch state: M4 (devices) is **in progress**: Home status line and the plant-detail banner/Module card are built; `plant/[id]/module.tsx` is a placeholder (returns `null`); uncommitted edits in `edit.tsx` (delete copy now says "and module"), `plant/[id]/index.tsx` and two tests. Paths are relative to `apps/mobile/src/` unless stated.

Route files: 15 (14 real screens + 1 placeholder), plus one non-route overlay (launch animation).

---

## 1. Screen inventory as built

### Auth group `(auth)` (signed out). Bare Stack, `headerShown:false` (`app/(auth)/_layout.tsx:8`); signed-in users redirect to `/` (`:7`).

#### 1.1 `/sign-in` (`app/(auth)/sign-in.tsx`, form `auth/AuthForm.tsx`)
- Purpose: email + password sign-in.
- Reached: no session (`(app)/_layout.tsx:51`); link from sign-up; link from `email-confirmed`; `router.replace` after sign-up with `email` + `notice` params (`sign-up.tsx:33`). Exit: success -> session listener redirects to `/` (`sign-in.tsx:29`); footer to sign-up.
- Primary: "Sign in" (prominent, `AuthForm.tsx:208`; keyboard submit `:174`). Secondary: "Resend confirmation email" (bordered; only after `email_not_confirmed`, `:135-136`, 60 s cooldown label `Resend in {n}s`); footer TextLink.
- States: pending = busy button; field errors under the group (statusNow footnote); form error with `error` icon, role alert (`:193-200`); notice text (`:201`). No forgot-password (not found in src).
- Copy:
  - `sign-in.tsx:13` "Sign in to Plant Care"; `:14` "Sign in"; `:32` "Don't have an account? Sign up"
  - `AuthForm.tsx:153-154` "Email"; `:166-167` "Password"; `:136` "Resend in {n}s" / "Resend confirmation email"
  - `sign-in.tsx:25` "Confirmation email sent to {address}."
  - `auth/emailConfirmation.ts:13` "We sent a confirmation link to {email}. Confirm your email, then sign in."; `:15` "Account created. Sign in to continue."
  - `auth/validation.ts:10` "Enter your email."; `:11` "Enter a valid email address."; `:13` "Password must be at least 8 characters."
  - `auth/authErrors.ts:4-9` "An account with this email already exists. Sign in instead." / "Email or password is incorrect." / "Confirm your email first. Check your inbox, then sign in." / "Too many emails sent. Wait a few minutes and try again."; `:17-18` "This email domain can't receive mail. Check the address." / "Use a permanent email address. Temporary inboxes can't be used."; `:21` "Can't reach the server. Check your connection and try again."; `:22` "Something went wrong. Please try again."

#### 1.2 `/sign-up` (`app/(auth)/sign-up.tsx`)
- Purpose: create account (same AuthForm; no confirm-password, no terms/privacy link).
- Exit: success -> `/sign-in` with notice `confirm-sent` (or `account-created` if the server returned a session, dropped locally, `:29-33`). Footer to sign-in.
- Copy: `:11` "Create your account"; `:12` "Create account"; `:36` "Already have an account? Sign in". Existing account maps to `user_already_exists` (`:23-25`).

#### 1.3 `/email-confirmed` (`app/email-confirmed.tsx`), public, outside both groups
- Purpose: web landing after Supabase verifies the email link; message only, never signs in. Reached from the email link (`auth/emailConfirmation.ts:2-3`). Exit: "Sign in" link.
- States: `confirmed` / `expired` from URL params (`:23-26`).
- Copy: `:10` "Email confirmed" / "Go back to the app and sign in."; `:12-13` "Link expired" / "This link has expired or was already used. Sign in and we'll send you a new one."; `:41` "Sign in".

### Signed-in group `(app)`

#### 1.4 `/` Plants (Home) (`app/(app)/index.tsx`)
- Purpose: list all plants grouped by device status.
- Reached: after sign-in; add/edit/delete flows end with `dismissTo('/')`. Exits: row -> `/plant/{id}` (`:86`); header `+` -> `/add/photo`; header person icon -> `/settings` sheet; empty button -> `/add/photo` (`:47`).
- Primary: add plant. Secondary: pull-to-refresh (`:101-102`), infinite scroll, 20/page (`:103-105`).
- Structure: `SectionList`; summary under title when plants exist (`:92-97`), `"{n} need you · {m} doing well"` (`:32-34`); section headers "Needs you" / "Doing well" shown only when at least one plant needs attention (`:70`). Rows = `plants/PlantRow.tsx`: 60 pt thumb or PotDrawing, serif name (`title3`), 8 px coloured status dot + one-sentence status; no chevron.
- States:
  - Loading: two `SkeletonRow` in `LoadingGroup` (`:56-60`).
  - Empty: PotDrawing + "No plants yet" (`:42`) + "Add your first pot and it'll look after its own watering from then on." (`:45`) + button "Add a pot" (`:47`).
  - Error, no cache: "Couldn't reach Plant Care. Check your connection and try again." (`:52`) + "Try again" (bordered, `:54`).
  - Success: rows `FadeIn`. No offline banner (not found).
- Header copy (`(app)/_layout.tsx`): large serif title "Plants" (`:65`); a11y labels "Add a pot" (`:35`), "Settings" (`:17`).
- Status lines (`devices/status.ts`):
  - `:39` "Setup isn't finished · Add its module" (quiet)
  - `:44` "Watering stopped · Check the stake is in the soil" (now)
  - `:55` "Tank needs refilling" (now)
  - `:65` "Not heard from since {time}" + " · Its battery was low" (quiet; now if battery < 20 %)
  - `:70` "Waiting for its first check-in" (quiet)
  - `:73` "Soil is very wet · Watering is on hold" (soon)
  - `:78` "Battery is low · Charge it this week" (soon)
  - `:83` "Doing well · Still learning how fast it drinks" (fine)
  - Dot colour: now=statusNow, soon=statusSoon, quiet=statusQuiet, fine=statusFine (`PlantRow.tsx:10-15`). "Needs you" = every level except fine (`status.ts:86`).

#### 1.5 `/settings` (`app/(app)/settings.tsx`), modal sheet
- Purpose: appearance, units, plan, account. Reached: header person icon. Exit: "Done" (`navigation/CloseButton.tsx:12`).
- Sections (InsetGroup):
  - "Appearance" (`:34`): rows "Light", "Dark" with checkmark; applies instantly, stored on the phone.
  - "Units" (`:45`): "Automatic", "Metric", "Imperial"; footer "Automatic follows your phone's region."; skeleton rows while the profile loads (`:46-52`); saves on tap.
  - "Plan" (`:71`): "Subscription" = "Active" / "Free (testing)" / "—" (`:85`); skeleton while loading.
  - "Account" (`:92`): "Email" (value); "Sign out" (destructive, no confirmation, `:94-101`).
  - Error footnote from `useProfile` (role alert, `:104-108`).
- Not present: notifications, quiet hours, delete account, privacy/terms, version.

#### 1.6 Add flow (`app/(app)/add/*`), full-screen cover
Container `add/_layout.tsx`: one in-memory draft (`plants/addDraft.tsx`); header "Add a plant" on every step (`:19-22`), search "Plant type" (`:23`). `StepProgress` = 4 segments, a11y "Step n of 4". Primary action in `BottomBar`.

**1.6.1 `/add/photo` step 1 (`add/photo.tsx`)**
- Purpose: capture photos; whole plant required. Exit: Continue -> `/add/identify`; "Cancel" (TextLink, `:27`) deletes uploads then `router.back()`. Back/swipe disabled (`_layout:19`). Redirects to `/add/health` if a plant is already saved (`:23`).
- Copy: `:31` "Take a photo of your plant"; `:34` "Got it." (StepDone with photo); `:46` "Continue" (disabled until whole photo).
- Cards (`plants/CaptureCards.tsx:16-19`): "Whole plant" / "Step back so the whole plant and pot fit"; "One leaf" / "Fill the frame with one healthy leaf"; "Flower" / "If it's flowering"; "Problem spot" / "If something looks wrong" (last three optional).
- Card buttons (`CaptureCards.tsx:88-110`): "Take photo", "Choose from library" (bordered), "Remove" (plain destructive), "Skip" (plain), "Add photo" (after a skip).
- Errors: "Camera access is off. Allow it in Settings to take photos." / "Photo access is off. Allow it in Settings to choose photos." (`plants/pickPhoto.ts:6-7`) + "Open Settings" (`CaptureCards.tsx:122`); "Couldn't add that photo. Try again." (`:127`). Busy: spinner in "Take photo". Upload happens on pick.

**1.6.2 `/add/identify` step 2 (`add/identify.tsx`)**
- Purpose: choose plant type; never blocks Continue (`:105`). Exit: Continue -> `/add/where`; "Cancel" (`:60`) deletes uploads, `dismissTo('/')`; "I know it — search" -> `/add/search`.
- Copy: `:64` "What kind of plant is it?"; `:68` "Identify from my photo" (explicit, spends a credit; hidden once scanned); `:75` "I know it — search"; `:100` "Skip" (plain) -> `:99` "Not sure? You can set it later."; `:90` "It's a {type}." + scientific name; `:105` "Continue".
- Errors: `:12` "Couldn't tell from this photo. Try one with a whole leaf in view, or search."; `:14` "You've reached the identification limit for now. Search for the plant type, or try again later."
- Suggestions (`plants/Suggestions.tsx`): "Is it one of these?" (`:27`); up to 3 rows (common name; "{scientific} · Very likely|Likely|Possibly"; checkmark when applied); "None of these, search instead" (`:46`). A "Very likely" top pick is auto-applied (`identify.tsx:42`).

**1.6.3 `/add/search` (`add/search.tsx` -> `plants/TypeSearch.tsx`)**
- Purpose: search plant type; pick sets species and goes back. Autofocus; 300 ms debounce.
- Copy: "Search plants" (placeholder + label, `TypeSearch.tsx:62-63`); "More plants" (`:41`); rows "{Common} — {Scientific}" with chevron; "Use “{term}” as the type" (`:49`, only when no results); "Couldn't search right now." (`:74`); "Couldn't add that plant. Try again." (`:79`). Loading = two SkeletonRows.

**1.6.4 `/add/where` step 3 (`add/where.tsx`)**
- Purpose: room + nickname; **Continue saves the plant** once. After save shows StepDone then auto-advances after 700 ms (`:11`, `:31`) with `replace('/add/health')`. Cancel hidden while saving/after saving (`:66`).
- Copy: `:78` "Where does it live?"; rows "Room" (placeholder "Optional", max 40), "Nickname" if a type is known else "Name" (placeholder = type or "Required", max 60) (`:92-95`); `:113` "Continue" (busy); success `:74` "{name} is in the {room}." / "{name} is saved."; error `:106` "Couldn't save your plant. Try again."

**1.6.5 `/add/health` step 4 (`add/health.tsx`)**
- Purpose: optional health check; plant exists so every exit keeps it. Back/swipe disabled; Android back = Done (`:51-55`). Header "Done" (TextLink) and BottomBar buttons.
- With a Problem-spot photo the check starts automatically (`:40-43`). Else:
  - Offer: `:86` "Want a quick health check for {name}?"; `:89` "We'll look at your photo for signs of pests, disease or stress. It takes a few seconds."; "Check its health now" / "Try again" (after failure) and "Skip for now" (plain) (`:109-110`).
  - Running: `:101` "Looking at your plant…" (live region).
  - Result: `HealthResult` (see 1.9) + BottomBar "Done" (`:113`).
  - Errors: `:15` "You've reached the health check limit for now. Try again later."; `:59` "Couldn't check right now."
- Done -> `dismissTo('/')` then `push('/plant/{id}')` (`:48-49`).

#### 1.7 `/plant/[id]` Plant detail (`app/(app)/plant/[id]/index.tsx`) (M4 part in progress)
- Purpose: hero photo, name/type/room, device banner, module readings, photo timeline, health card, species facts.
- Reached: Home row; end of add flow. Exits: header "…" menu; timeline -> viewer; "Check its health" -> `/plant/{id}/health`; banner "Add its module" -> `/plant/{id}/module` (placeholder).
- Header: transparent, empty title, "…" button (text glyph on a `surface` disc, a11y "More options", `:29-31`, `:70-75`).
- Menu (custom absolutely positioned card, not a native menu, `:95-115`): "Edit plant" (plain Button), "Remove module" (destructive; only with a module); confirm `:99` "Remove the module? Its history is deleted. The module forgets this account at its next check-in." + "Remove" / "Cancel".
- Layout order: hero (height min(1.25 x width, 460); photo / PotDrawing if none / skeleton colour while loading) -> serif title (plant name) -> subtitle "{type} · {room}" (italic scientific name when the type repeats the name, `:63-64`, `:125`) -> device area -> `TimelineStrip` -> `HealthCard` -> `AboutPlant` (only if species has facts).
- Device area (in progress): loading = two SkeletonRows; failed with no cache = `ModuleCard device={null}` (all "—"); else `StatusBanner` + `ModuleCard` (only with a module). Polls every 30 s (`:46`).
- Loading plant: skeleton title/subtitle/block (`:149-155`); plant missing/error: lone "—" title (`:157`), no message or action.
- `StatusBanner` (`devices/StatusBanner.tsx`): headlines (`:11-17`) "Setup isn't finished", "Watering stopped", "Tank needs refilling", "Module offline", "Battery is low". Bodies (`status.ts:46-47, 56, 66, 80`):
  - "Watering stopped. Check the stake is in the soil and the tube isn't kinked, then resume." / "Watering stopped. Check the stake is pushed into the soil; it resumes by itself."
  - "The tank needs refilling. Watering is paused until it's filled."
  - "Not heard from since {t}. It should keep watering on its last instructions."
  - "Battery is low. Charge it this week."
  - Setup: "Add its module to start watering automatically." + button "Add its module" (`:31-32`).
  - Fault `no_moisture_rise`: button "Resume watering" (`:36`), then "Resumes at the next check-in, by about {time}" (`:34`).
  - Background nowFill / soonFill / surface by level.
- `ModuleCard` (`devices/ModuleCard.tsx`): InsetGroup "Module": "Water" (TankVessel + "Needs refilling" / "About {n} ml left" rounded to 50 / "—"), "Soil" ("Dry · 28 %", "Damp · 41 %", "Very wet · 70 %", "—"), "Battery" ("{n} %" + " · Charging"), "Checked in" (time / weekday / short date).
- `TimelineStrip` (`plants/TimelineStrip.tsx`): "Timeline" + "See all" (`:81-94`); horizontal 72 pt thumbs with short date and a health dot (`statusFine` healthy, `statusNow` unhealthy, `statusQuiet` unsure, `:108`); a11y "Photo from {date}"; skeleton thumbs; failed with no cache = "Timeline" + "—"; "Add a photo" (bordered) -> inline "Take photo" / "Choose from library" / "Cancel" -> inline "Added to the timeline." with "Check its health" / "Not now" (`:133-135`); permission and failure copy as 1.6.1.
- `HealthCard` (`plants/HealthCard.tsx`): "Health"; "Looking at your plant…" while pending; else "Checked {locale date}" + note + advice, or "Not checked yet."; bordered "Check its health"; failure "Couldn't check right now. Try again." or the limit line.
- `AboutPlant` (`plants/AboutPlant.tsx`): "About this plant"; Light fact ("Bright, indirect light", "Medium light", "Low light", "Direct sun"), Watering fact, 3-line description with "More" / "Less".

#### 1.8 `/plant/[id]/edit` (`plant/[id]/edit.tsx`), modal sheet (uncommitted copy edit)
- Purpose: name, type, room; delete plant. Title "Edit plant", back hidden; header "Done" **saves** then `router.back()` (`:82`, `:49`); no Cancel (swipe-dismiss on iOS).
- Rows: "Name" (placeholder "Name"), "Plant type" (value or "Choose", chevron; opens `TypeSearch` inline replacing the form, `:67-76, 98`), "Room" (placeholder "Optional").
- Copy: `:113` "Give it a name (up to 60 characters)."; `:118` "Couldn't save that. Try again."; `:124` (working copy) "Delete {name}? Its photos and module are removed too. This can't be undone." (committed: "Its photos are deleted too."); "Delete plant" (plain destructive) -> inline "Delete" / "Cancel". Delete success -> `dismissTo('/')`.
- Loading: two SkeletonRows (`:143-146`). Unknown id: skeleton forever (no error state).

#### 1.9 `/plant/[id]/health` (`plant/[id]/health.tsx`), pushed (default options)
- Purpose: on-demand health check with fresh photos. Title "Check its health" (`:70`).
- Cards "Whole plant" (required) and "Problem spot" (optional) (`:12-24`); BottomBar "Check" (disabled until whole photo; busy) -> "Looking at your plant…" (`:79`) -> `HealthResult` + BottomBar "Done" (`:92`). Errors: limit line (`:26`); "Couldn't check right now. Try again." (`:59`). Leaving before a check deletes the uploads (`:37-43`).
- `HealthResult` (`plants/HealthResult.tsx`): "Checked photo"; status line with icon: "Looks healthy" (statusFine, `healthy`), "Needs attention" (statusSoon, `error`), "Not sure" (statusQuiet, `unsure`) (`:9-11`); note as serif `title3`; card "What to do" with `care` icon + advice (`:34`).

#### 1.10 `/plant/[id]/photos` Photo viewer (`plant/[id]/photos.tsx`), full-screen cover
- Purpose: swipe the timeline (newest first, paged), see date + health result, identify, delete. Title "Photos"; "Done" (CloseButton); back hidden (`_layout:92`).
- Body: full-bleed paging `FlatList` (`contain`); info scroller (date "d MMM yyyy", `HealthText`, message, suggestions); BottomBar.
- Actions: "What is it?" (bordered; spends a credit) -> `Suggestions` (tap sets type; "Plant type updated.", `:98`; "None of these, search instead" -> `/plant/{id}/edit`); "Delete photo" (plain) -> inline "Delete this photo? This can't be undone." + "Delete" (bordered destructive) / "Cancel" (`:151-155`). Deleting the last photo closes the viewer.
- Errors: same `COULDNT` / `LIMIT` copy as the add flow (`:14-15`). Loading: one 400 pt skeleton (`:55`). Failed with no data: lone "—" (`:46`). No photos: **blank view** (`:60`).

#### 1.11 `/plant/[id]/module` (`plant/[id]/module.tsx`): placeholder (in progress)
- File reads "Placeholder so typed routes resolve; Task 10 builds the real screen." and returns `null` (blank screen). The Setup banner "Add its module" routes here. The tank step (`plant/[id]/tank`, M4 spec §8.1) does not exist.

#### 1.12 Launch overlay (not a route; `launch/LaunchAnimation.tsx`)
Plain paper native splash, then the PotDrawing draws in (~700 ms), rests `REST_MS` 500, fades out 250 ms (`LAUNCH_DURATION_MS` 1200; reduced motion 300 / 150 ms), once per run (`launch/useLaunchGate.ts`).

---

## 2. Navigation structure as built

- **Root** (`app/_layout.tsx`): `QueryClientProvider` > `ThemeProvider` (React Navigation theme from tokens, `:58-69`) > `ShimmerProvider` > `AuthProvider` > `<Slot/>` + launch overlay. Groups redirect on session.
- **No tab bar.** One Stack for signed-in screens (matches UI spec §4).
- **`(auth)`**: bare Stack, no headers. Sign-in <-> sign-up use `replace`.
- **`(app)` Stack** (`(app)/_layout.tsx:54-104`), screenOptions: header bg = `background`, no shadow, tint = `tint`, title colour = `label`.
  - `index`: title "Plants", `headerLargeTitle` (iOS only), serif; Android serif 28 pt title in the bar (`:73-76`). `headerRight` = `+` then person-circle, each 44 x 44.
  - `add`: `fullScreenModal`, `headerShown:false`, own inner Stack. Inner: photo, identify, where, health, search; titles "Add a plant" (search "Plant type"); photo and health have back hidden and swipe-back off; Cancel / Done are TextLinks in `headerRight`.
  - `plant/[id]` index, `plant/[id]/health`, `plant/[id]/module`: **not declared**, default push. Detail sets `headerTransparent`, empty title, "…" in `headerRight`; health sets title in-screen; module has none.
  - `plant/[id]/edit`: `modal`, title "Edit plant", back hidden, "Done" set in-screen.
  - `plant/[id]/photos`: `fullScreenModal`, title "Photos", back hidden, `headerRight: CloseButton` ("Done").
  - `settings`: `modal`, title "Settings", back hidden, `headerRight: CloseButton`. `unstable_settings.anchor = 'index'` keeps a settings deep link over Plants (`:10`).
- **Menus**: only the plant-detail "…" (custom popover). No native UIMenu/ActionSheet; no system alerts (all destructive confirms are inline blocks).
- **Detent sheets**: none (modal presentation only).
- **Deep links**: scheme `mobile` (`app.json:8`); `/email-confirmed` is the only route meant to be opened externally.
- Add flow exits: Cancel (steps 1-3) / Done (step 4) end on Home; step 4 then pushes the new plant's detail (`add/health.tsx:48-49`).

---

## 3. Design system as built

### 3.1 Colour tokens (`theme/colors.ts`, the only place colour values live)
| Token | Light | Dark |
|---|---|---|
| background | #F4F1EB | #161412 |
| surface | #FFFDF9 | #221F1B |
| label | #1D1B18 | #F2EEE7 |
| secondaryLabel | #5E5950 | #B5AEA3 |
| separator | #E3DDD3 | #3A352F |
| tint | #2E5B47 | #8FC0A4 |
| onTint | #FFFFFF | #0F2419 |
| statusFine | #4A7545 | #8DBB86 |
| statusSoon | #8F6210 | #E0B25A |
| statusNow | #A3392B | #EF8A78 |
| statusQuiet | #56606A | #A3AEB9 |
| water | #3F6A82 | #86B2C9 |
| waterFill | #DCE7EC | #2A3A42 |
| band | #668C60 | #6F9A69 |
| nowFill | #F7E4DF | #3A221D |
| soonFill | #F6ECD6 | #352A16 |
| skeleton | #ECE7DE | #2A2622 |
| skeletonHighlight | #F6F3ED | #35302A |

- Theme = user choice Light (default) / Dark in Settings; never the phone's (`theme/index.ts:20-23`, `theme/appearance.ts`); AsyncStorage key `plant-care.appearance`, read before first frame (400 ms timeout, falls back to light); also sets the native scheme.
- `band` is unused so far (no soil-band UI); `water` only in TankVessel.

### 3.2 Type (`theme/typography.ts`)
Serif = `ui-serif` (iOS), `serif` (Android), web stack `ui-serif, "New York", "Iowan Old Style", Georgia, serif`.
| Style | Face | Size/leading | Weight |
|---|---|---|---|
| largeTitle | serif | 34/41 | 500 |
| title | serif | 28/34 | 500 |
| title3 | serif | 20/25 | 500 |
| headline | system | 17/22 | 600 |
| body | system | 17/22 | 400 |
| callout | system | 16/21 | 400 |
| subheadline | system | 15/20 | 400 |
| footnote | system | 13/18 | 400 |
| caption1 | system | 12/16 | 400 |

Font scaling is never capped. `useIsAccessibilitySize()` = fontScale > 1.4 (`theme/index.ts:26-28`); only `Row` reacts (stacks value under label, drops chevron).

### 3.3 Spacing and radii (`theme/spacing.ts`)
`space`: xs 4, s 8, m 12, l 16, xl 20, xxl 24, xxxl 32, touch 44. `radius`: thumb 14, group 22, capsule 999.

### 3.4 Motion (`theme/motion.ts` plus per-component constants)
- `motion`: easeOut = bezier(0.23, 1, 0.32, 1); `duration` success 200 ms, progress 250 ms; `stagger` 60 ms.
- `StepProgress`: fill scaleX 250 ms (native driver). `StepDone`: opacity + scale 0.95 to 1, 200 ms, staggered 0 / 60 / 120 ms.
- `FadeIn`: 150 ms opacity, JS driver (`ui/FadeIn.tsx:6,27`).
- Shimmer: 1600 ms period, one shared loop, only while a skeleton is mounted (`ui/ShimmerProvider.tsx:6`); skeletons appear after 300 ms (`ui/Skeleton.tsx:9`).
- Launch: draw ~700 ms, rest 500 ms, fade 250 ms.
- Reduce Motion (`theme/useReduceMotion.ts`): StepProgress, StepDone, FadeIn instant; shimmer static; launch fades.
- Haptics: none implemented (no expo-haptics use found). Screen transitions are native stack defaults.

### 3.5 `src/ui` components (`ui/index.ts`)
- **Text**: `variant` (any type style, default body), `color` (any ColorToken, default label).
- **Button**: `label`, `onPress`, `variant` prominent (default; tint fill, onTint headline) | bordered (tint 2 x hairline border, headline) | plain (no chrome, body text), `disabled`, `busy` (ActivityIndicator before label), `destructive` (statusNow text; has no effect on prominent). Capsule, min 44 pt, opacity 0.6 pressed/disabled. Label doubles as a11y label.
- **TextLink**: `label` + `href` (+`replace`) or `onPress`; subheadline tint, 44 pt target (smaller type than Button plain).
- **InsetGroup**: `header?`, `footer?` strings; radius-22 surface, hairline separators inset 16.
- **Row**: `label`, `value?`, `accessory` chevron | checkmark | none, `onPress?`, `destructive?`, `children?` (custom trailing, e.g. TextInput), `testID`.
- **BottomBar**: pinned container, background colour, padding 16 + bottom safe inset, gap 8.
- **StepProgress**: `step` 1-4, `total` (4); role progressbar "Step n of total"; done + current segments statusFine, rest separator.
- **StepDone**: `title`, `children?`; 64 pt statusFine circle with `checkmark`, serif title centred; announces title on iOS.
- **Icon**: `name`, `size` (22), `color` token; `expo-symbols` `SymbolView` (SF Symbols iOS, Material Symbols Android/web); hidden from screen readers.
- **PotDrawing**: `width` (160; viewBox 160 x 140). Hairline 1.5 stroke in `secondaryLabel`: saucer with capped fill hole, pot with rim, stake with plant-label head, three leaves; `POT_PATHS` shared with the launch animation; a11y label "Drawing of a pot standing on the watering saucer, with the sensor stake in the soil". The app's only illustration.
- **Skeleton / SkeletonText / SkeletonRow / LoadingGroup / useDelayedVisible**: `Skeleton {width, height, radius}`; `SkeletonText {variant, width}`; `SkeletonRow {withValue}`; `LoadingGroup` = 300 ms delay + single "Loading" a11y label.
- **ShimmerProvider** (root), **FadeIn** (`style`, `testID`).
- Outside `ui/`: `navigation/CloseButton.tsx` ("Done", plain Button); `devices/TankVessel.tsx` (react-native-svg: waterFill body, `water` level line, `secondaryLabel` outline, decorative, width 28 default); each feature card (`HealthCard`, `AboutPlant`, `StatusBanner`, `CaptureCards`, `Suggestions`, `PlantRow`) hand-rolls a radius-22 surface card, there is no shared Card.

### 3.6 Icon set and mapping (`ui/Icon.tsx:7-19`)
| Name | iOS SF Symbol | Android/web Material | Used for |
|---|---|---|---|
| account | person.crop.circle | account_circle | Settings button |
| checkmark | checkmark | check | selected rows, StepDone, Suggestions |
| chevronRight | chevron.right | chevron_right | Row chevron |
| plus | plus | add | Add button |
| light | sun.max | light_mode | AboutPlant Light |
| water | drop | water_drop | AboutPlant Watering |
| healthy | checkmark.circle.fill | check_circle | health "Looks healthy" |
| unsure | questionmark.circle.fill | help | health "Not sure" |
| care | leaf | eco | "What to do" |
| camera | camera | photo_camera | defined, unused in screens reviewed |
| error | exclamationmark.circle.fill | error | form error, health "Needs attention" |

No `ellipsis` (detail menu uses the "…" character), no `wifi.slash`, `pause.circle`, `clock`, `battery.25percent`, `leaf.fill` (UI spec §3 list).

---

## 4. Gaps and inconsistencies

### 4.1 Built vs specs
1. **Add flow is 4 steps, not 6.** UI spec §4 lists Plant, Module, Wi-Fi, Pot, Stake, Tank + "All set"; built = Photo, What is it?, Where, Health (`add/_layout.tsx:19-23`, `ui/StepProgress.tsx:7`). Follows the owner-approved add-plant-steps spec. Module pairing hangs off plant detail (`devices/StatusBanner.tsx:32`) per M4 spec §8.1, not the add flow. No "Finish setup" resume row (UI spec §4).
2. **"Add a pot" vs "Add a plant".** Header button label "Add a pot" (`(app)/_layout.tsx:35`) and empty-state button "Add a pot" (`index.tsx:47`) open a flow titled "Add a plant" (`add/_layout.tsx:19-22`). Empty copy says "your first pot" (`index.tsx:45`) while the rest says plant ("No plants yet", "Plants", "Edit plant", "Delete plant"). M2 spec §5.2 allows the interim title; terms are not reconciled.
3. **Tab bar: none, as specced.** Settings as sheet and Add as full-screen cover: as specced.
4. **Plant detail is a subset.** Missing vs UI spec §4/§6: Moisture target sheet, "I refilled it" sheet, "Give a drink" queued row, Pause watering, Module settings screen, History ("See all"), 7/30-day chart, forecast text, "Next drink in about 2 days". Plan display (M5) absent. Only banner + Module card + Timeline + Health + About exist.
5. **"…" menu is not a native menu.** Spec: UIMenu with Pause watering, Edit plant, Module settings (`app-ui-design.md:123-126`). Built: hand-positioned popover (`plant/[id]/index.tsx:95-115`, absolute `top: insets.top + 44`, `right: 16`), "…" text character (`:29-31`) not an `ellipsis` symbol; no outside-tap dismiss or backdrop found.
6. **Status grammar partly built.** UI §5 rows 3 (soil dry and can't water), 6 (water runs out), 8 (paused), the forecast variant of 9, "Drink queued" / "as of {time}" modifiers and "Still reads low" refill text are absent from `devices/status.ts`. Spec says shape carries meaning; Home rows show only an 8 px coloured dot (`plants/PlantRow.tsx:50,78`): colour-only, no leaf / exclamation / wifi.slash shape.
7. **Units setting exists though UI spec §4 lists "units setting" as left out** (`settings.tsx:45`); main spec §7-8 lists units. Specs conflict; build follows the main spec. Nothing displays units yet (ml everywhere, `status.ts:35`).
8. **Settings thinner than main spec §7:** no notifications, quiet hours, delete account; "Free (testing)" placeholder (`settings.tsx:85`).
9. **Edit sheet:** spec confirm "Delete {name}? Its photos are deleted too."; working copy adds "and module" (in progress). No Cancel in Edit.
10. **Offline banner** (UI §5: grey banner, cached values kept): not found. Error with no cache shows text; with cache silent.
11. **Home error copy** drops the spec's "Your pots keep watering on their own." (`index.tsx:52`); allowed by M2 §5.1.
12. **Section headers:** UI §5 drops them when everything is fine; built also shows a lone "Needs you" when every plant needs attention (`index.tsx:70`); M2 §5.1 says drop when every row is in "Needs you". Specs and code disagree.
13. **Add-plant-steps §4 Rules** names the no-type case "Name it"; built row label "Name", placeholder "Required" (`add/where.tsx:92-95`).
14. **Haptics and spring motion** (UI §3) not implemented.
15. **Entitlement:** `profile/useEntitlement.ts` exists; nothing is gated, no paywall or limit UI.

### 4.2 Copy tone and terminology
- plant / pot / module / device: see 4.1 #2. Within one journey: "Add a pot" (button), "Add a plant" (title), "Add its module" (banner), "Edit plant", "Remove module". Hardware words (stake, tube, tank, saucer) appear in status copy (`status.ts:44,46`) with no in-app explanation.
- Health check labels: "Check its health" (`HealthCard.tsx:41`, `TimelineStrip.tsx:134`), "Check its health now" (`add/health.tsx:109`), "Check" (`plant/[id]/health.tsx:95`), screen title "Check its health".
- Failure copy varies: "Couldn't check right now." (`add/health.tsx:59`) vs "Couldn't check right now. Try again." (`HealthCard.tsx:44`, `plant/[id]/health.tsx:59`); "Couldn't search right now." (no retry hint) vs "Couldn't add that photo. Try again." vs "Couldn't save your plant. Try again." vs "Couldn't save that. Try again.".
- "Done" in three forms: header TextLink subheadline (`add/health.tsx:77`), header plain Button body (Edit `edit.tsx:82`, Settings and Photos via `CloseButton`), BottomBar prominent (`add/health.tsx:113`, `plant/[id]/health.tsx:92`); add step 4 shows header "Done" and BottomBar "Done" together. "Cancel" in the add flow is a TextLink; elsewhere plain Button.
- Health colour semantics split: `HealthResult` maps unhealthy to `statusSoon` + `error` icon (`HealthResult.tsx:10`); `TimelineStrip` dot uses `statusNow` (`:108`); the spec reserves `exclamationmark.circle.fill` and statusNow for urgent "now".
- Dates: Health card "Checked {toLocaleDateString()}" (`HealthCard.tsx:31`), strip "18 Nov" short, viewer "18 Nov 2026" (`photos.tsx:132`), device times "09:12" / weekday / short date (`status.ts:19-24`).
- Voice: first-person plural ("We'll look at your photo...", "we'll send you a new one") mixed with impersonal prompts; the device and plant are both "it" ("Its battery was low", "Add its module").
- Em dash as label separator ("I know it — search", "{Common} — {Scientific}") and as the failed-load placeholder "—". Sentence case throughout; no emoji.

### 4.3 States the specs require but the code lacks
- Plant not found / failed: lone "—" title (`plant/[id]/index.tsx:157`); Edit shows a skeleton forever (`edit.tsx:136-148`).
- Viewer with zero photos is a blank view (`photos.tsx:60`), against loading rule 2.
- Module screen is blank (`module.tsx:3`).
- Sign out has no confirmation (`settings.tsx:94-101`).
- HealthCard shows "Not checked yet." while its query is loading (no skeleton or "—", `plant/[id]/index.tsx:145`).
- "—" failure placeholder is inconsistent: bare "—" (title, viewer), "—" beside a header (timeline), or a sentence (Home).
- No pull-to-refresh on plant detail.
- AX-size layouts: only `Row` restacks; PlantRow, banners, TimelineStrip do not (UI §3 asks rows to stack at AX sizes).

### 4.4 Dead ends and awkward exits
1. "Add its module" -> blank screen (`module.tsx`); the only path to pair a module (M4 in progress).
2. Tank-low and fault banners have no "I refilled it"; only `no_moisture_rise` gets an action ("Resume watering", `StatusBanner.tsx:35-36`); `sensor_out_of_range` and offline banners have none.
3. Detail error (`index.tsx:157`) and viewer error (`photos.tsx:46`) are text-less "—" screens.
4. Add step 1 has no back (Cancel discards); step 4 traps back (Android back = Done). By design.
5. Add step 3 success auto-advances after 700 ms (`where.tsx:31`); the plant is already saved, no undo.
6. Edit modal: "Done" saves, no Cancel; the inline type picker replaces the form and its Done header button (`edit.tsx:67-76`) so only a pick or system gesture exits it.
7. Sign-in has no "Forgot password"; sign-up has no terms/privacy link or confirm-password.
8. Settings has no delete account or notifications.
9. Viewer "None of these, search instead" pushes the Edit modal over a full-screen cover (`photos.tsx:144`).

---

## 5. Specced but not built yet (main spec §7-§11, UI spec §4-§6)

- **M4 Devices (simulated), in progress:**
  - Built: device data layer (`devices/api.ts`, `queries.ts`), Home status lines, detail banner + Module card, Resume watering, Remove module.
  - Not built: Module setup screen (claim code, "Waiting for the module…", "This code expired." + "New code") at `plant/[id]/module`; Tank step `plant/[id]/tank` ("Fill the tank...", StepDone "The tank is full."); "I refilled it" sheet (M4 spec §8.1; main spec §11.4).
- **M4/M5 items from the UI spec:** Give a drink (queued row, Cancel, blocked reasons), Pause watering menu, Module settings screen (battery, Wi-Fi, re-teach stake, move, remove), Moisture target sheet, History + 7/30-day chart, forecast statuses ("Next drink in about 2 days", "Water runs out in about 2 days"), "All set" notification pre-prompt.
- **M5 Watering plans:** plan generator, plan + explanation on detail, per-plant watering preference (drier / default / wetter), per-plant moisture band (`band` token unused today), all inside safety limits.
- **M6 Alerts and reminders:** push (tank low, runs out in ~2 days, battery low, offline after 3 missed syncs, fault, new health issue), deep link to detail, care reminders (fertilize, rotate, repot), away mode, quiet hours, notification preferences.
- **M7 Firmware:** ESP32-C3, SoftAP/BLE pairing, Wi-Fi setup, soil and pump calibration; maps to UI-spec add steps 2-6 (Module, Wi-Fi, Pot width stepper, Stake, Tank) and the "Finish setup" row.
- **M7b Guided scan:** motion-guided ring camera, ML Kit on-device plant check; needs Apple Developer account + EAS dev build; guided photo cards stay as fallback.
- **M8 Store readiness:** social sign-in, RevenueCat paywall (`useEntitlement()` gating, free pot count, "+" at the limit), privacy policy, account deletion, EAS builds, TestFlight / Play testing.
- **Cross-cutting, unscheduled:** offline banner, haptics and spring motion, notification / quiet-hours / units display in Settings.
