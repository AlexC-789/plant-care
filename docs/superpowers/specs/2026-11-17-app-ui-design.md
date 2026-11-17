# Plant Care iOS app: UI design

Date: 2026-11-17
Status: Draft for owner review
Canvas (high-fidelity screens): https://claude.ai/artifact/FVr5hjCEB2vj7uZ7gpcKUy (private until shared)
Builds on: [Software design](2026-11-16-plant-care-design.md), [Hardware v1](../../hardware/2026-11-16-saucer-and-stake-v1.md)

## 1. Brief and assumptions

- This is an iPhone-first companion for a décor-grade watering module: one module per pot, with a hidden saucer tank and a sensor stake.
- Jobs:
  - pair a module and link it to a plant
  - see all pots at a glance
  - plant detail
  - act: give a drink, set the moisture target, pause
  - alerts
  - empty, error and offline states throughout
- It's built in Expo/React Native but follows iOS conventions: native stack, large titles, inset grouped lists, sheets with detents, menus and SF Symbols.
- Remote actions take effect at the next check-in (up to about 1 h), and every action says so. The tank level is an estimate; only "needs refilling" (the float switch) is measured.
- This build is a demo and demand test, so charm and clarity come before breadth. Scanning, care reminders and away mode are out of this pass.

## 2. Direction: Glazed Ceramic, with a photo and one sentence

The module is a décor object that sits under a pot, so the app reads like the care card that comes with a good ceramic: warm paper, quiet ink and the owner's own plant photo as the hero. Every pot gets exactly one plain-English sentence that tells the whole story. Colour appears only when something needs a person, so "fine" stays quiet and a problem is visible at a glance. New York (the iOS system serif) is used only for plant names and the one large title per screen. The signature detail is the tank vessel with its water line, shown only on the detail and refill screens. A dashed line marks the estimate and a solid line marks the measured refill point.

Considered and set aside:
- **"Linen and Light"** (photo-first, sentence-only). Its photo and sentence rule were merged in.
- **"Botanical Plate"** (illustrated states). Dropped because of the custom-art cost, a less native feel and the risk of looking twee.

## 3. Tokens

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| background | #F4F1EB | #161412 | grouped background |
| surface | #FFFDF9 | #221F1B | rows, cards, sheets |
| label | #1D1B18 (16.9:1) | #F2EEE7 (14.2:1) | primary text, every status word |
| secondaryLabel | #5E5950 (6.8:1) | #B5AEA3 (7.5:1) | sentences when fine, meta |
| separator | #E3DDD3 | #3A352F | hairlines only |
| tint | #2E5B47 (7.7:1; white on it 7.8) | #8FC0A4 (#0F2419 on it 8.0) | buttons, links, toggles |
| statusFine | #4A7545 | #8DBB86 | leaf symbol only |
| statusSoon | #8F6210 | #E0B25A | symbol only; words in label |
| statusNow | #A3392B (6.5:1) | #EF8A78 (6.7:1) | symbol plus urgent banner headline; never on buttons |
| statusQuiet | #56606A | #A3AEB9 | offline, paused, stale |
| water | #3F6A82 | #86B2C9 | vessel line, drink marks |
| waterFill | #DCE7EC | #2A3A42 | vessel body (decor) |
| band | #668C60 (3.8:1 vs surface) | #6F9A69 | soil target band |
| nowFill | #F7E4DF | #3A221D | urgent banner background |
| soonFill | #F6ECD6 | #352A16 | heads-up banner background |

The contrast figures are WCAG ratios against `surface`, computed rather than eyeballed. System bars and sheets use system materials (Liquid Glass on iOS 26), so they're not painted.

### Type (Dynamic Type; nothing fixed)

| Style | Face | Default size / leading | Use |
|---|---|---|---|
| .largeTitle | New York Medium | 34/41 | "Plants" |
| custom title | New York Medium | 28/34 (relativeTo .title) | plant name on detail |
| .title3 | New York Medium | 20/25 | plant name in a row |
| .headline | SF Pro Semibold | 17/22 | banner titles, values |
| .body | SF Pro | 17/22 | rows, buttons |
| .callout | SF Pro | 16/21 | status sentence on detail |
| .subheadline | SF Pro | 15/20 | sentence in a row, meta |
| .footnote | SF Pro | 13/18 | explanations |
| .caption1 | SF Pro | 12/16 | chart axis only |

- In React Native, use `fontFamily: 'ui-serif'` on iOS (check this on a device early).
- Don't set `maxFontSizeMultiplier`.
- At AX sizes:
  - rows stack (photo, then name, then sentence), and the chevron is dropped
  - the soil bar becomes a 5-row list
  - the chart becomes a one-line summary

### Spacing, radii, targets

- **Spacing:** a 4 pt grid (4, 8, 12, 16, 20, 24, 32, 44).
- **Margins:** 16 pt screen margin. Rows are at least 44 pt tall (Home rows 84 pt).
- **Radii:** thumbnails 14, cards and inset groups 22, buttons capsule.
- **Tap targets:** at least 44×44 pt; icon buttons are padded up to it.

### SF Symbols

| Symbol | Meaning |
|---|---|
| `leaf.fill` | fine |
| `exclamationmark.circle` | soon (outline) |
| `exclamationmark.circle.fill` | now |
| `wifi.slash` | not heard from |
| `pause.circle` | paused |
| `clock` | drink queued |
| `drop` | water, drinks |
| `battery.25percent` | battery low |

Toolbar symbols: `plus`, `person.crop.circle`, `ellipsis`.

Shape carries the meaning and colour only confirms it. No emoji anywhere.

### Motion and haptics

- **Default motion:** system transitions, and a spring with damping 1.0 / response 0.35. Nothing loops or pulses, and there are no spinners for remote actions.
- **Give a drink:** the button cross-fades into the queued row (200 ms ease-out with a 2 px blur bridge), with `impact(.light)`.
- **Refill confirmed:** the water line rises slowly with a critically damped spring (damping 1.0 / response 0.6, no overshoot) and `notification(.success)` fires on the same frame. Nothing in the app bounces.
- **Pickers:** `selection` haptic. Final setup step: `success`. Setup failure: `error`.
- **Remote status changes** cross-fade with no haptic.
- **Reduce Motion:** 150 ms opacity cross-fades. **Reduce Transparency:** bars go solid (automatic).

## 4. Screen flow

- **Root: one NavigationStack, no tab bar.**
  - Sign in → Plants (Home) → Plant detail (push) → History (push, via "See all")
  - Toolbar `person.crop.circle` → Settings (sheet)
  - Toolbar `+` → Add a pot (full-screen cover)
- **Plant detail**
  - Moisture target → sheet
  - I refilled it → sheet (medium detent)
  - Give a drink → inline queued row with Cancel
  - "…" menu (UIMenu):
    - Pause watering (1 day, 3 days, a week, until I resume)
    - Edit plant (sheet; Delete plant is here)
    - Module settings (push): battery, Wi-Fi / Change Wi-Fi, teach the stake again, move to another plant, remove module
- **Add a pot**, in 6 named steps:
  1. Plant (photo, then Plant.id suggestions with a one-line health note, name, room; saved immediately)
  2. Module (wake it, then the iOS hotspot join alert)
  3. Wi-Fi (pick a network, password, connecting checklist, errors)
  4. Pot (measured width with a Stepper, 6 to 60 cm or ½ in steps; optional, editable later)
  5. Stake (dry reading, then wet reading, about 3 min, with a determinate ring)
  6. Tank (open the cap on the saucer's fill hole and pour until the water reaches the top of the hole)

  Then "All set" with the notification pre-prompt. A failure or interruption leaves a saved plant with a "Finish setup" row that resumes at the last completed step.
- **Push notifications** deep-link to the plant's detail.

Left out on purpose:
- tab bar
- alerts inbox (the sentence is the inbox)
- stats dashboard
- units setting (follows the locale)
- quiet hours (iOS Focus covers it)
- custom two-thumb moisture band

## 5. Status grammar (one sentence wins, top-down)

| # | Condition | Level | Home sentence | Push |
|---|---|---|---|---|
| 1 | fault no_moisture_rise | Now | Watering stopped · Check the stake is in the soil | active, 8:00 to 21:00 |
| 2 | float_low | Now | Tank needs refilling | active, 8:00 to 21:00 |
| 3 | soil dry and can't water (paused or tank) | Now | Soil is dry and watering is paused | time-sensitive (the only one) |
| 4 | 3 missed check-ins (if the last battery reading was low: Now, "…its battery was low, so it has probably stopped") | Quiet (in "Needs you") | Not heard from since 09:12 · It should keep watering on its own | active, 8:00 to 21:00 |
| 5 | soil above band | Soon | Soil is very wet · Watering is on hold | passive, daytime; Now after 3 days |
| 6 | forecast under 2 days of water | Soon | Water runs out in about 2 days | passive, daytime |
| 7 | battery < 20 % | Soon | Battery is low · Charge it this week | passive, daytime |
| 8 | paused | Quiet (in "Doing well") | Paused until Friday · Soil is fine | none |
| 9 | fine | Fine | Doing well · Next drink in about 2 days. Until there's enough history: "Doing well · Still learning how fast it drinks" | none |

- Status lines are dot-joined with no final period; banners and push bodies use full sentences.
- Modifiers append to the winning sentence rather than compete with it: "· Drink queued" and "· as of 09:12" for stale data.
- Home shows a summary line under the title ("3 need you · 3 doing well") and two sections. "Needs you" holds every row with an action for the owner (#1 to #7, plus "Setup isn't finished"). "Doing well" holds #8 and #9. The section headers are dropped when everything is fine.
- When the phone is offline, the cached list is shown under a grey banner and values are never blanked.
- If the float switch still reads low after "I refilled it": "Still reads low · Check the tank is pushed in all the way"

## 6. Actions and safety honesty

- **Give a drink** queues a single dose of `dose_ml` (≤ 40 ml) for the next check-in. It shows "Drink queued · arrives by about 14:20", which can be cancelled, then confirms with the real event ("Watered 30 ml at 14:12" or "Skipped, soil was already damp").
  - It is blocked, with the reason, when the tank needs refilling, today's 150 ml has been given, or watering has stopped.
  - It is allowed while watering is paused.
  - Queued drinks expire after 2 hours if the module hasn't checked in, and the app says so ("If it hasn't checked in by 16:00, we'll cancel this").
- **Moisture target:**
  - "Follow plant profile" is the recommended default.
  - "Choose myself" offers three choices: On the dry side, Lightly damp, Evenly moist.
  - There's no "wet" option and no free slider. The copy states the 150 ml/day cap.
- **I refilled it:** "To the top" is the default. "Only partly" offers ¼, ½ or ¾.
- **Pause:** the banner says "Starts at the next check-in, by about 14:20" until the module confirms, since it could still water before then. "Resume watering" undoes it.
- **Forecasts** ("next drink in about…", "lasts about…", "runs out in about…") appear only after 3 days of readings and at least 2 drinks. They are always rounded ("about 2 days", "about a week").
- **Plant.id** shows up to 3 suggestions, with confidence as words ("Very likely", "Possibly") and never %. Search is always available. On failure: "Couldn't tell from this photo."
- **Pot and saucer sizes are not standard.** Nothing in the app depends on a size table: the pot width is a measured number, and tank volume and fill-hole position come from per-device data when it exists.
- **Times** follow the device locale (12- or 24-hour). Mockups use 24-hour.
- **Notifications:** "Turn on" fires the system prompt if permission was never asked, and opens Settings if it was denied.

## 7. Plant photo prompts (for demo mockups and App Store shots)

The owner's own photo is the main visual moment, so mockups should use real-looking photos rather than drawn stand-ins. Run these with any image model and keep one style across the set.

**Shared style (append to every subject):** natural-light interior photograph, a houseplant in a matte glazed ceramic pot standing on a pale oak windowsill, soft morning window light from the left, warm off-white plaster wall behind with plenty of empty space above the plant, gentle shadow under the pot, true-to-life colour, shallow depth of field, 50 mm lens, eye level, no people, no text, no logos, no props, 4:3.

| Plant | Subject line |
|---|---|
| Fern | a full Boston fern with arching fronds in a cream glazed pot |
| Monstera | a young monstera with three split leaves in a terracotta-red glazed pot |
| Pothos | a golden pothos trailing over the rim of a white glazed pot |
| Snake plant | an upright snake plant with yellow-edged leaves in a charcoal matte pot |
| Calathea | a calathea with striped oval leaves in a rust glazed pot |
| Olive tree | a small potted olive tree with silvery leaves in a sand-coloured pot |

**Placement:**
- Detail hero (390×280 pt): keep the pot in the lower half so the nav buttons sit on calm wall.
- Home rows (60 pt square): crop to the leaves, not the pot.
- Dark mode uses the same photos, unchanged.

Until real photos exist, the canvas keeps the drawn stand-ins.

## 8. Decisions and open questions

Decided with the owner (2026-11-17):
- Tank filling is through a small capped hole on the saucer. "Full" means water up to the top of the hole.
- Pot and saucer sizes are undecided and not standard. The pot width is measured and optional.
- Plant.id identification is in onboarding for the demo.
- "Plant Care" stays as the placeholder name and icon.
- Subscription: probably limits the number of pots plus some extras. Not designed yet.

Still open:
1. **New device commands** `water_once` (Give a drink) and `pause_until` (Pause watering). Neither is in the spec's v1 command set. Both arrive at the next check-in and stay inside the firmware safety limits. Proposal: add them to the simulator first.
2. **Forecast threshold:** 3 days of readings and 2 drinks is the proposed default. Tune it with simulator data.
3. **Fill-hole check on the prototype:** does the water visibly reach the hole when the tank is full? If not, "full" needs another cue (for example a marked jug).
4. **Subscription:** the free pot count, what else is gated, and what a lapsed plan does. Constraint: existing pots never stop watering or alerting when a plan lapses. Gate only through `useEntitlement()`; the natural moment is tapping "+" at the limit.
