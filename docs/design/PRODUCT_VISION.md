# Plant Care: product vision

_Status: approved by the owner 2026-11-19._
_Product authority stays `docs/superpowers/specs/2026-11-16-plant-care-design.md`; this file says what the experience is for and how it should feel._
_Companion documents: [DESIGN_RESEARCH](DESIGN_RESEARCH.md), [UX_ARCHITECTURE](UX_ARCHITECTURE.md), [DESIGN_SYSTEM](DESIGN_SYSTEM.md), [SCREEN_SPECIFICATIONS](SCREEN_SPECIFICATIONS.md), [DESIGN_ROADMAP](DESIGN_ROADMAP.md)._

## 1. What it is

Plant Care is the app for a self-watering pot module. It has three parts:
- a saucer with a 705 ml tank and a pump;
- a stake with a soil-moisture probe;
- a small Wi-Fi controller.

The app identifies the plant, keeps a photo record of it, and shows how the module is doing. The backend plans the watering and the module carries it out.

**The one-line promise:** _Plant Care waters. You look after the plant._

Every plant app on the market is a reminder app. Planta, the strongest competitor, shows "Regular watering in 12 days" with a checkbox. Plant Care measures instead of reminding: "Water left for about 9 days." Nothing for the user to tick off.

## 2. Who it is for

| Person | What they want | What would make them leave |
|---|---|---|
| Busy owner with 2–10 houseplants | Not to kill plants while away or forgetful | Chores, nagging, setup that fails |
| New owner who just bought a plant | To know what it is and that it's OK | Jargon, a sign-up wall before seeing anything |
| Someone who received a module as a gift | To get it working in a few minutes | Unclear pairing, no sign of progress |

The app is used in **glances**: open it, see whether anything needs you, close it. Long sessions happen in only three places: adding a plant, setting up a module and looking back through photos.

## 3. Experience principles

1. **Facts, not chores.** Each plant gets one sentence about its state and when that state is next likely to change. The app never shows a to-do list for watering.
2. **Quiet when fine.** A plant that's fine shows no colour beyond its photo and its blue water line. Red appears only when a person has to act.
3. **The photo is the colour.** The page is neutral, ink on off-white, and nothing is drawn on the photos.
4. **Water is blue and nothing else is.** The tank level is the product's signature. It is the only place blue appears.
5. **Honest numbers.** Amounts are approximate ("about 500 ml", "about 9 days"). If a value isn't known it shows "—", never a guess. A module that hasn't checked in shows a dashed line, never a stale level.
6. **Value before commitment.** The first thing a new person does is scan a plant and get an answer. The account is asked for only when there is something to keep (Model A, [UX_ARCHITECTURE §3](UX_ARCHITECTURE.md#3-first-run-model-a)).
7. **Safety is not negotiable.** The watering limits are fixed in firmware and in `_shared/watering.ts`:
   - at most 40 ml per dose;
   - at most 150 ml per 24 h;
   - never pump when the float switch reads low;
   - stop after 2 doses with no rise in moisture.

   The UI explains a pause; it never offers a way round one.

## 4. Non-goals

These are deliberate. Each is something a competitor does that we choose not to:
- Community feeds, an expert chat, an "AI doctor" hub, reviews or awards inside the app.
- Streaks, badges, points or any game mechanics.
- Dashboards, charts on Home, or numbers on every plant. The moisture curve lives behind History on one plant.
- Watering reminders with checkboxes. Only jobs the module can't do (repotting, fertilising, rotating) may become reminders later (M6).
- Green branding. Planta, PictureThis and PlantIn already own it.

## 5. What success looks like

| Moment | Measure | Target (proposed) |
|---|---|---|
| First value | Install → first identification shown | under 60 s |
| Commitment | People who see a result and then create an account | above 50 % |
| Hardware | Module setups that start and reach "The tank is full." | above 90 % |
| Trust | Plants with a module that report "needs you" and get resolved within 24 h | above 80 % |
| Calm | Notifications per plant per week, excluding real problems | 0 |

None of these are tracked yet. Analytics is not in any milestone, so this is an open decision ([DESIGN_ROADMAP §4](DESIGN_ROADMAP.md#4-open-decisions)).

## 6. Future direction that shapes today's design

- **3D scan instead of a photo.** Adding a plant will later use a 3D scan (owner, 2026-11-19). The add flow therefore has a single **capture** step that produces "a capture". Today that's a photo; later it's a scan. Nothing after that step depends on which.
- **Subscription.** Paid features are gated only through `useEntitlement()`. Which features are paid has not been decided. The design keeps every safety message free.
