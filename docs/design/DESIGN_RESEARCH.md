# Plant Care design research

Date: 2026-11-18
Status: Research and directions, waiting for the owner to choose a direction. Nothing in here changes an approved spec yet.
Visual comparison: [directions.html](directions.html) (open locally in a browser; photos in `img/`).
Detailed findings:
- [research/plant-apps.md](research/plant-apps.md)
- [research/connected-devices.md](research/connected-devices.md)
- [research/wellness-onboarding.md](research/wellness-onboarding.md)
- [research/as-built-audit.md](research/as-built-audit.md)

## 1. What we already know (from the repo, not invented)

- **Product.** Plant Care is a companion app for a self-watering module: a saucer with a ~705 ml tank and pump, plus a stake with a soil probe, on Wi-Fi with a battery.
  - The cloud turns readings into soil %, water left and battery, and sends the module its watering instructions.
  - The app identifies plants (Plant.id), keeps a library with a photo timeline and health checks, and shows each plant's status.
- **Built (M1 to M3, merged).**
  - Sign-in, sign-up and email confirmation.
  - Plants home and plant detail.
  - A 4-step add flow (Photo, What is it, Where, Health).
  - Photo timeline, viewer and rescan.
  - Edit, and Settings (units, appearance, plan).
- **In progress (M4, paused).**
  - Module claim and sync, a simulator, and status on Home.
  - Plant-detail banner and module card, and the setup screens. The module screen is a blank placeholder today.
- **Still to come.**
  - M5: watering plans and their explanation.
  - M6: alerts, care reminders and away mode.
  - M7: firmware and real pairing.
  - M7b: guided scan.
  - M8: store readiness (social sign-in, subscription, account deletion).
- **Approved visual direction: "Glazed Ceramic"** (`docs/superpowers/specs/2026-11-17-app-ui-design.md`, applied by `2026-11-17-ui-foundation-design.md`).
  - Paper and ink, with the New York serif for titles only.
  - One status sentence per plant, and colour only when something needs a person.
  - A line-drawn pot and a tank vessel.
  - No tab bar, no alerts inbox, no stats dashboard.
  - Its tokens and components are in the code (`src/theme`, `src/ui`).
  - This research does not overturn it silently. It is direction A below, and B and C are real alternatives.

## 2. Research method and honesty notes

- **Tool.** Lazyweb MCP, verified working (health check plus a test search).
  - Four parallel threads: plant apps, connected devices, and wellness/onboarding (three agents), and the lead's own gap-filling round.
  - In each thread, screens were downloaded and looked at; descriptions alone were not used to judge visuals.
- **Coverage was thin.**
  - Plant category: Lazyweb has only PictureThis and PlantIn. There was nothing for Planta, Greg, Blossom, Seek, Click & Grow or AeroGarden.
  - No screens for identification confidence, failed identification, a plant photo timeline, tank level, pairing failure or device reset. Several searches timed out upstream.
- **What this means.** Where a decision below has no observed evidence it says so, and it rests on product reasoning instead.
- **What was looked at.**
  - About 26 screens were viewed as images.
  - Another ~35 were read from Lazyweb's descriptions only, marked "DESC" in the appendices.
  - All result references are listed in §7.
- **Saving the collection failed.** The Lazyweb search could not be finalised into a saved collection ("agentic_search_not_found"), so references are cited by their `result_ref` IDs.

## 3. Findings that shape the design

| # | Finding | Evidence (viewed unless marked) | What Plant Care does with it |
|---|---|---|---|
| 1 | Category apps are schedule-driven: "Today's Care: Tea rose, Watering". None shows a live reading. | PictureThis home, PlantIn To do | Report facts, not chores. The device waters; the app says how the plant is and asks for a person only when it needs one. |
| 2 | The category look is dark UI, a mint accent, a bulging camera button, leaf logos, promo banners above user content, a prize wheel, and icon-only action buttons. | PictureThis home/library, PlantIn home/empty | Use a light paper look with words on every action. No promos inside the user's plants or in empty states. |
| 3 | A count in words reads at a glance: "1 plant (1 needs care)". | PlantIn home | Keep the summary line "2 need you · 2 doing well". |
| 4 | Status that names cause and time beats a bare word. Google Home's dimmed "Offline" tile says nothing about since when. | Google Home, Find My, Duo | Keep one sentence per plant with the cause and, when stale, the time: "Not heard from since 09:12". |
| 5 | "All fine" stays quiet. Detail and evidence live one level down, on a diagnostics sheet. | Duo "No issues found", Google Home dimming | Fine states use secondary ink and no colour. Module readings sit on the plant page, not on Home. |
| 6 | A calm, empty state is one declarative sentence with a dimmer second line. Stock clip-art reads as a template. | Ro "Zero tasks. You're all set.", Workday | Empty and all-fine states use the line-drawn pot plus one sentence. No cartoon illustrations. |
| 7 | Consumables read best as time left, with "~". | iRobot "~45 HRS LEFT" | Lead water with days: "About 500 ml · about 9 days". |
| 8 | A single vessel with one big number makes volume tangible. | Waterllama (onboarding glass) | The tank vessel stays the signature drawing (detail and refill only). |
| 9 | A curve with a marked "now" makes a cycle readable without a chart UI. | Tide Guide home | Soil history is drawn as one curve over the target band with a "now" dot, behind History on the plant page. |
| 10 | Pairing works with one instruction, large code boxes, a visible waiting state and a way out. Codes that expire say so and offer a new one. | Fire TV code entry, Nothing X scanning, Couple Joy invite code (DESC), Flo expired code (DESC) | Module setup shows the code grouped, "Waiting for the module…", the expiry time, and "New code" plus Cancel. |
| 11 | Removing a device states what is kept, what is lost, and when it was last active. | Dropbox unlink | "Remove the module? Its history is deleted. The module forgets this account at its next check-in." |
| 12 | Identification answered with a large photo, the name, a short description and one confirming action. | Merlin "This is my bird" | The identify result becomes a confirm screen: "This is my plant" as the primary action, with alternatives and search below. |
| 13 | Notification priming with real example alerts and a visible Skip works better than abstract benefits. | Pool primer | Ask after the first module is paired, showing the real alerts ("Tank needs refilling"). Never ask at launch. |
| 14 | Streaks and gamified counters reward the wrong thing when a device does the work. | Locket, Finch (DESC) | No streaks, points or badges. Progress is shown in photos, not scores. |
| 15 | Timelines work as a dot or strip summary plus a dated list for browsing. | Locket calendar, Couple Joy memories | Keep the photo strip on the plant page. Add a dated log that mixes photos and device events (watered, refilled, fault). |
| 16 | Distinctive, human-designed interfaces get their character from tone and size hierarchy, specific copy, and product-specific drawings, not gradients or glass. | Ro, Couple Joy, Headspace (own characters) | Identity comes from the serif plus ink hierarchy, the pot and vessel drawings, the owner's photos, and plain specific copy. |

No usable evidence was found for: confidence wording on identification results, failed-photo screens, tank-empty states, battery as "lasts N weeks", and push wording for device states. These are designed from first principles and the existing spec (UI spec §5 and §6).

## 4. Three directions

All three directions use the same plants and copy; see [directions.html](directions.html).

### A · Care Card: the approved Glazed Ceramic, refined
- **What it is.**
  - It reads like the care card that comes with a good ceramic pot: paper and ink, the owner's photo as hero, and one sentence per plant.
  - Native iOS grammar: a large serif title, inset grouped rows, no tab bar.
  - Shape and word carry status, and colour only confirms it.
  - The tank vessel and the soil strip with its band are the only drawings that show data.
- **For.**
  - Already approved and built, so design effort goes to flows, states and copy, not restyling.
  - The best large-text behaviour of the three.
  - "Quiet when fine" matches a device that mostly works on its own (findings 1, 4, 5).
  - Furthest from the category clichés (finding 2).
- **Against.**
  - Restraint can look like a Settings screen, and the identity relies on photos, serif and copy discipline.
  - Less memorable in store screenshots.

### B · Field Journal
- **What it is.**
  - A gardener's notebook: numbered entries, specimen plates, italic Latin names, and prose status.
  - The plant page reads as today's entry, followed by a dated log.
  - Rules instead of cards, with an editorial serif (Newsreader) throughout.
- **For.**
  - The most recognisable direction; nothing in the category looks like it.
  - Fits the long-term value of history and photos (findings 15 and 16).
- **Against.**
  - Prose is slower to scan, and urgent states compete with typography.
  - Risk of looking twee.
  - Needs a bundled font, custom list components and replacement tokens.
  - Two-column entries break sooner at large text sizes.

### C · Instrument
- **What it is.**
  - A calm instrument panel: soil, water and battery as tabular figures with meters on every Home row.
  - A 7-day moisture curve leads the plant page.
  - Neutral greys, one water-blue accent, sans-serif only.
- **For.**
  - Honest and glanceable for people who like data, with the strongest hardware-product feel (findings 7 and 9).
- **Against.**
  - It's the generic smart-home dashboard the brief warns about, and the UI spec already rejected a stats dashboard.
  - Numbers on Home invite worry while the device is coping ("is 38 % bad?").
  - Plants without a module look broken, and the plant becomes secondary to the gadget.

### Recommendation

Choose **A, Care Card**, taking two things from the others:
- **From B:** the italic Latin name on the plant page, and one dated log that mixes photos and device events.
- **From C:** the moisture curve over the target band, on the plant page only, behind "History". Home never shows raw numbers.

The product's best day is a day the owner doesn't need it. A says that most clearly, and it builds on approved, working code. B is the fallback if the owner wants a stronger editorial identity and accepts the cost and the large-text risk.

## 5. Conflicts and inconsistencies found (to settle in the design package)

From [research/as-built-audit.md](research/as-built-audit.md) and the specs:

1. **Naming.**
   - "Add a pot" (the `+` button and the empty state) versus "Add a plant" (the flow header).
   - "Module", "device", "pot" and "plant" are used interchangeably.
   - Proposal: the person adds a **plant**. The hardware is the **module** in all user copy. "Pot" appears only for the physical pot.
2. **Add flow.**
   - The UI spec has 6 steps with module setup inside. The built flow has 4 plant steps, and the module is added later from the plant page (M4 design).
   - Proposal: keep the module separate. Many plants have no module, and pairing is a different moment.
   - The UI spec §4 needs amending.
3. **Status dot.**
   - Home rows show an 8 px coloured dot. UI spec §3 says shape carries meaning: a leaf for fine, an exclamation for needs-you, wifi-slash for silent.
   - Colour-only status fails for colour-blind users.
4. **Units in Settings.**
   - UI spec §4 lists "units setting" as left out, but the foundation spec (owner decision) keeps Automatic, Metric or Imperial.
   - The owner decision wins; the UI spec needs a note.
5. **Health colours.**
   - The timeline dot uses `statusNow` for unhealthy, while the result card uses `statusSoon` and an exclamation mark.
   - These need one rule.
6. **Missing states.**
   - Plant-detail load error shows a bare "—".
   - The photo viewer with zero photos is blank.
   - Edit with an unknown id shows a skeleton forever.
   - The health card shows "Not checked yet." while loading.
   - There is no offline banner.
   - Sign out has no confirmation, and there is no forgot-password flow.
7. **Spec features with no screen yet.** These are designed in the package and built in their milestones:
   - from the UI spec: "I refilled it", Give a drink, Pause, Moisture target, History, Module settings
   - plan explanation (M5)
   - care reminders and away mode (M6)
   - account deletion (M8)
8. **Refill.**
   - UI spec §6 has an "I refilled it" sheet. The M4 owner decision added a real tank level sensor and dropped "I refilled it" (the float switch stays as a cut-off).
   - The design follows the M4 decision: refills are detected, not declared.
9. **Give a drink and Pause.** The owner deferred these to M5 (M4 decision); they are designed but marked M5.

## 6. Questions only the owner can answer

1. **Direction.** A (recommended), B or C?
2. **Account before or after the first scan.**
   - Identification uses a per-user Plant.id quota and owner-only data, so it needs an account.
   - Proposal: keep sign-up first, but put one screen before it that says what the app does, showing the pot drawing and three plain lines.
3. **Notification priming.** After the first plant is saved, or only after the first module is paired? Proposal: after pairing, since that's when alerts matter.
4. **Plants without a module.**
   - Today they sit in "Needs you" as "Setup isn't finished".
   - Proposal: a plant may simply be tracked without a module. It then goes to "Doing well" with "No module · Photos and health only", and setting one up is offered on its page rather than nagged about.
   - This changes the M4 status table.

## 6b. Owner feedback and the Planta comparison (2026-11-18)

**Owner's verdict:** "the ceramic design still has a bit of an AI look". Planta (App Store id1410126781; 4.8 from 115K ratings, Editors' Choice) is the competitor to learn from.

Full comparison and the revised direction: [planta-compare.html](planta-compare.html). It uses Planta's 7 App Store screenshots, linked from Apple's CDN and not copied into the repo.

**Why Care Card reads as AI-made.**
- Beige paper, muted brown-grey ink, light serif titles and identical cream rows are today's default "tasteful" generated palette. It has no committed colour, no type weight and no colour blocks that carry meaning.
- Planta commits to one hue (sage and forest green), uses a heavy grotesk, and puts solid care cards (navy for water, mustard for fertiliser) and big photos with pills on its screens, with one big answer per screen.

**What we take from Planta.**
- A committed brand colour and heavy type.
- A plant page made of a photo with pills, a row of state cards, and Now / About / History.
- A camera-first identify step with the answer shown over the photo.
- Rooms you pick from (existing rooms first) plus light as three choices.
- Reminders shown as cards for the jobs the module can't do (M6).

**What we leave.**
- Planta's green.
- The community feed, experts, the "Dr" hub, reviews and laurels.
- Watering as a checkbox chore. Planta tells you to water; Plant Care waters.

**New direction D, in two colour options:**
- **D1 Clay:** burnt clay ink on a pale clay tint.
- **D2 Water:** deep water blue on a pale blue-grey.

Both use Schibsted Grotesk, white cards, clay-red alerts and a deep-blue water card. Direction A is withdrawn as the recommendation; D replaces it, pending the owner's colour choice.

**Follow-up (same day):** the owner said the photos clash with the tinted page. D now uses a neutral off-white page (#F5F5F3, no hue), keeps brand colour to titles, buttons, the selected tab and the water card, and runs the plant-page photo edge to edge. See the "D, neutral page" section of planta-compare.html.

**Second follow-up (same day):** "now the colors fight a bit". Up to four solid colours shared a screen (brand, clay alert, navy water card, dark-grey offline pill). The current proposal, "D, one colour", is ink on off-white with no brand hue. Clay red is used only for "needs you"; water blue appears only as a thin level bar; offline is an outlined pill. See the `#mono` section of planta-compare.html.

**Direction E (same day), via the frontend-design skill:** [direction-e.html](direction-e.html). Same neutral page and photos-first rule. Alert red moves from clay (#B5452A, a known AI accent) to raspberry #D0213B; water is #1F74D1. Plant names are set in Archivo extra-condensed heavy (a nursery-tag voice), everything else in Archivo normal width. The signature element is a slim tank gauge inside every plant photo, with an empty track when there is no current reading. No middle-dot strings, no identical cards; only photos are rounded. Owner then said the blue and red inside the photos looked bad: nothing is drawn on photos now, the tank level is a thin line under each photo. Owner asked for blue so it reads as water: fill #5FAEE3, red only when low. Owner approved Direction E ("ok that works"). Apple-design review pass applied: 44 pt targets, frosted photo buttons, size-specific tracking, tabular figures, identical row order on every plant page, dashed line for "no reading", a "Photos and watering history" row, and copy saying how paused watering resumes.

## 7. References

Screens are cited as Lazyweb `result_ref` IDs. The full analysis of each is in the appendices.
- **Viewed by the lead:**
  - Merlin `screens:908546c82653031a8a2f15e9`
  - Waterllama `screens:faf49d696fd25d96b3c1464e`
  - Tide Guide `screens:bfa279a13936591ab1550013`
  - PictureThis home `screens:36ac231ba5c2f7ee1390929f`
  - PlantIn home `screens:b56b546c7c0413010557913e`
  - Ro `screens:8da98e6f9f020f526f830cb7` (see the wellness appendix)
- **Descriptions only:**
  - Flo expired code `screens:1fbad74435ba9196d65773d1`
  - Couple Joy code `screens:872206128e2ea8b7977fdc61`
  - iScanner capture guidance `screens:efaec5ca6f668c9eb7ccf602`
- **Plant apps:** 14 refs, listed at the end of [research/plant-apps.md](research/plant-apps.md).
- **Connected devices:** 13 refs, listed at the end of [research/connected-devices.md](research/connected-devices.md).
- **Wellness and onboarding:** 29 refs, listed at the end of [research/wellness-onboarding.md](research/wellness-onboarding.md).
- **Screenshot files.** The downloaded screenshots stay in the session scratchpad and are not copied into the repo, because they are third-party app screens. Lazyweb serves them by ref.

## 6c. First run without sign-up first (2026-11-19)

Owner: the flow should not start with sign-up, and adding a plant will later be a 3D scan rather than a photo. Owner also found the type sizes uneven. Mockups: [flow-e.html](flow-e.html).

- **Type scale:** six sizes matched to iOS Dynamic Type, all in Archivo:
  - Display 40, Large title 32 and Title 21, in condensed width 75 % for names and titles only.
  - Headline 17 semibold, Body 17, Subhead 15 and Footnote 13.
- **Evidence from Lazyweb.** Every one asks when there is something to lose:
  - Duolingo asks for a profile after the first lesson, "Don't lose your progress" (`screens:05704a8529064e26032c3f68`).
  - Cal AI puts "Save your progress" at the end of onboarding (`screens:09e5e4bb90d854ff5304044f`).
  - Atoms has a guest account and asks later (`screens:1fae8878be5995bbfe14420c`).
- **Three models:**
  - **A, recommended:** scan first, and ask for an account at "Save {name}".
  - **B:** stay a guest until a module is paired.
  - **C:** start from the module; kept as a second way in from Welcome.
- **3D scan:** capture is one step that outputs a "capture". The photo and 3D versions share the screen and its place in the flow; the 3D version swaps the frame for a coverage ring. "Use a photo" stays as the fallback.
- **Backend impact (owner decision needed):**
  - Supabase anonymous sign-in for the first scan.
  - A small guest identify limit plus a captcha.
  - Apple/Google sign-in setup; on iOS, Apple is required if Google is offered.
  - The order changes: the health check moves after the account.
