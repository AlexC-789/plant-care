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
- **Refill confirmed:** the water line rises with a spring (damping 0.85 / response 0.6) and `notification(.success)` fires on the same frame. This is the only bounce in the app.
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
  1. Plant (photo, name, type, room; saved immediately)
  2. Module (wake it, then the iOS hotspot join alert)
  3. Wi-Fi (pick a network, password, connecting checklist, errors)
  4. Pot (width options come from the module model)
  5. Stake (dry reading, then wet reading, about 3 min, with a determinate ring)
  6. Tank (fill to the line)

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
| 1 | fault no_moisture_rise | Now | Watering stopped. Check the stake is in the soil. | active, 8:00 to 21:00 |
| 2 | float_low | Now | Tank needs refilling. | active, 8:00 to 21:00 |
| 3 | soil dry and can't water (paused or tank) | Now | Soil is dry and watering is paused. | time-sensitive (the only one) |
| 4 | 3 missed check-ins (if the last battery reading was low: Now, "…its battery was low, so it has probably stopped") | Quiet (in "Needs you") | Not heard from since 09:12. It should keep watering on its own. | active, 8:00 to 21:00 |
| 5 | soil above band | Soon | Soil is very wet, so watering is on hold. | passive, daytime; Now after 3 days |
| 6 | forecast under 2 days of water | Soon | Water runs out in about 2 days. | passive, daytime |
| 7 | battery < 20 % | Soon | Battery is low. Charge it this week. | passive, daytime |
| 8 | paused | Quiet (in "Doing well") | Paused until Friday. Soil is fine. | none |
| 9 | fine | Fine | Doing well. Next drink in about 2 days. If the forecast is unsure: "Doing well. Watered this morning." | none |

- Modifiers append to the winning sentence rather than compete with it: "· Drink queued" and "· as of 09:12" for stale data.
- Home shows a summary line under the title ("3 need you · 3 doing well") and two sections. "Needs you" holds every row with an action for the owner (#1 to #7, plus "Setup isn't finished"). "Doing well" holds #8 and #9. The section headers are dropped when everything is fine.
- When the phone is offline, the cached list is shown under a grey banner and values are never blanked.
- If the float switch still reads low after "I refilled it": "Still reads low. Check the tank is pushed in all the way."

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
- **Times** follow the device locale (12- or 24-hour). Mockups use 24-hour.
- **Notifications:** "Turn on" fires the system prompt if permission was never asked, and opens Settings if it was denied.

## 7. Open questions for the owner

1. **Give a drink and pause need new device commands** (`water_once`, `pause_until`). The spec's v1 command set defers "Water now" and doesn't include pause. Are they OK for this milestone, and should the simulator support them first?
2. **Tank filling on the real hardware.** The design shows a fill spout on the stake and a fill-line window on the saucer, which are placeholders. Is there a fill port or window, or do users lift the pot?
3. **Module sizes.** Which saucer models exist, which pot-width ranges does each fit, and does the app learn the model from the device at pairing (needed for step 4 and the tank volume)?
4. **Subscription moment, the biggest gap for a demand test.** Where does the paywall sit, what's free, and what does a lapsed subscription look like for a device that's still watering? My recommendation: place it after "All set" on the first pot, and keep watering and alerts free forever (safety), so only extras are gated through `useEntitlement()`.
5. **Forecasts.** "Next drink in about 2 days" and "runs out in about 2 days" need a confidence rule. What should the minimum history be before we show them?
6. **Plant.id in onboarding.** Is identifying the type from the setup photo in scope for the demo, given that each call costs money?
7. **Product name and app icon.** The design uses "Plant Care" as a placeholder.
