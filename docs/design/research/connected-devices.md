# Smart-home / connected-device patterns for Plant Care

Scope note: Lazyweb's coverage of true IoT apps (thermostats, irrigation, leak sensors, Rachio, Oura, SmartThings) was thin. Queries returned few device-specific screens; many hits were unrelated (rate-app modal, retail). I viewed 10 screens. Seeing them was the basis for every claim below. Anything I did not see is listed under Open questions. Searches that returned nothing relevant: "leak sensor alert", "irrigation controller" (returned Google Home, iRobot, Plantin only), a dedicated water-tank-level screen, and a device-removal/reset flow for a physical device. Two batches timed out (mcp_upstream_timeout), so the "smart home camera offline troubleshooting" and "remove device from home confirmation" queries did not run.

Local images: a local scratch folder (devices screenshots, not kept) (called DIR below).

## References

| # | App | Screen | result_ref | Image |
|---|-----|--------|-----------|-------|
| 1 | iRobot | Product Health (consumables) | screens:9ede373eae59212b28c4c76d | DIR/irobot-1.png |
| 2 | Google Home | Home, offline device tile | screens:55aee115315aff9c7f6b92e7 | DIR/google-home-1.png |
| 3 | Plantin | Home, "1 plant (1 needs care)" | screens:b56b546c7c0413010557913e | DIR/plantin-1.png |
| 4 | Duo Mobile | Troubleshoot, "No issues found" | screens:372b8953fd0e72b7572aafe2 | DIR/duo-1.png |
| 5 | Nothing X | Pairing, "Scanning..." | flows:c7c21a5a22167050925cfeff (step 6) | DIR/nothing-x-6.png |
| 6 | Nothing X | My devices, empty state | flows:c7c21a5a22167050925cfeff (step 7) | DIR/nothing-x-7.png |
| 7 | Find My | Devices list with status lines | screens:24f5108e8661835339d05d3a | DIR/find-my-1.png |
| 8 | Dropbox | Manage devices, unlink confirm | screens:60ef53d0aa84927ee8a6686e | DIR/dropbox-1.png |
| 9 | Shuteye | In-progress tracking | screens:43b5955621039d5e500c3615 | DIR/shuteye-1.png |
| 10 | Fire TV | Enter 4-digit code from device | screens:97ff0041fb38fbc2eac41cd6 | DIR/fire-tv-1.png |

Not viewed as images (description only, so no visual claims): Crouton "pair kitchen scale" flow (flows:dcffc5240241d4662e561aaa, includes iOS Bluetooth permission step, then a connected-scale action on the recipe screen); Libby and PlugShare code entry (screens:8cbc8ef54e59c4ad0a2874ed, screens:27c6470e5ed937652e987837); Kahoot PIN + QR join (screens:68a8b3d18d7da0cc56fb471c).

## Per-reference analyses

### 1. iRobot, Product Health (irobot-1.png)
- Problem: consumables (filter, brushes) wear out silently.
- What I see: three white cards on a grey ground. Each has a name, a thin progress bar, and "~ 45 HRS LEFT", "~ 149 HRS LEFT", "~ 305 HRS LEFT". A footnote says the status is "based on cleaning time and replacement recommendations". A blue shop link sits below. Bars are green in all three and very short fills (the fill appears to show elapsed/used rather than remaining; it is ambiguous, which is a flaw).
- Why it works: a unit people think in (hours of use) plus a bar; the "~" signals an estimate honestly; the footnote explains the basis.
- Adapt: "about X days of water left" as the primary text for the tank, with a note that it is an estimate from recent use. Keep the "~".
- Do not copy: bar semantics unclear (does full mean good or used?). Also the shop upsell; the device screen should not sell. The all-green bars never say "fine" in words.

### 2. Google Home, offline tile (google-home-1.png)
- Problem: say a device is unreachable without alarm.
- What I see: dark home screen, one rounded tile: device icon, "Smth TV", the word "Offline" in grey, and a warning triangle at the right. The whole tile is dimmed. The bell has a small dot (an inbox exists). Bottom tabs: Favorites, Devices, Automations, Activity, Settings.
- Why it works: grey-out plus one word plus an icon; no red. State is readable at a glance across many tiles.
- Adapt: dimmed card for "Not heard from since 09:12" so it reads as stale, not as failure. Warning icon only when action is needed.
- Do not copy: "Offline" alone with no time. Nothing says since when or what to do. Plant Care's "since 09:12" wording is better. Also a five-tab bar is too much for a plant app.

### 3. Plantin, Home (plantin-1.png)
- Problem: summary of care state per group.
- What I see: a card "General", subtitle "1 plant (1 needs care)", three circular salmon/red-outlined action icons (watering, misting, feeding), a red badge "1" on the My Plants tab. Above it is a large "Win your prize! Spin the wheel" promo that takes the top of the screen.
- Why it works: the count in words ("1 needs care") plus a tab badge gives the attention number without opening anything.
- Adapt: the tab badge count and the "N need care" phrase for Home when more than one plant.
- Do not copy: the promo banner above the status. Status must come first. The row of icon-only action circles (meaning not legible without learning).

### 4. Duo Mobile, Troubleshoot (duo-1.png)
- Problem: reassure a user that nothing is wrong, and give a diagnostic path.
- What I see: a large check-badged icon, the title "Troubleshoot", the sentence "No issues found", then five rows each with a check badge and a plain statement ("Internet connection available", "Notifications enabled"). A "Share Debug Info" link and a line saying nothing is shared without explicit action.
- Why it works: one calm sentence first, evidence rows second. Each row is a statement of fact, not a label with a value.
- Adapt: a "Check this module" sheet for support: "Heard from it 09:12", "Probe in soil", "Tank sensor ok", "Battery 74%". Same sentence-then-rows structure. The privacy line is a nice trust detail if you add share-diagnostics.
- Do not copy: green checks everywhere on the main screen. That belongs on a diagnostics sheet only; the main plant screen should stay quiet when fine.

### 5. Nothing X, Scanning (nothing-x-6.png)
- Problem: "waiting for the device" state.
- What I see: black screen, large "Scanning..." heading, one instruction "Please ensure your device is in pairing mode", an abstract rotating-lines animation, a QR button bottom left, an info button bottom right, and "Don't have a device yet? Skip scanning".
- Why it works: one instruction, motion that says "working", an escape hatch, and an alternate path (QR) visible at once.
- Adapt: for the pairing-code screen: say what the user must do on the device ("Hold the button until the light blinks"), show a calm waiting state, and keep an info button for help. Respect Reduce Motion (your rules allow only the shimmer as looping motion, so use a static state or the shimmer).
- Do not copy: no timeout, failure or retry state is shown in this flow screen; I did not see one. Plant Care needs to design "code not accepted / not heard from the module within N minutes" itself.

### 6. Nothing X, My devices empty (nothing-x-7.png)
- What I see: title "My devices", a single large plus circle with "Add a new device", profile button top right.
- Adapt: the empty state of one clear action. For Plant Care this lives inside a plant ("Add a module to this plant"), not as a separate screen.
- Do not copy: a full-screen devices page, since the device is attached to one plant.

### 7. Find My, Devices list (find-my-1.png)
- Problem: many devices, each with a short status.
- What I see: a bottom sheet over a map. Each row: icon, name, a subtitle ("This iPhone", "Home • Now", "No location found • Online"), and a right-aligned status ("With You"). A plus button top right of the sheet.
- Why it works: every row has the same two-line grammar: where/when on the left, relationship on the right. "Now" is the freshness word. Stale state is a different sentence, not a different component.
- Adapt: a "since" grammar: "Now", "09:12", "Yesterday". One status sentence template for all plants.
- Do not copy: the map-first layout; irrelevant.

### 8. Dropbox, Manage devices and unlink (dropbox-1.png)
- Problem: remove a linked device safely.
- What I see: heading "17 devices linked"; each row has a name and "Last active in the last hour / about 2 weeks ago / about 3 years ago"; "This device" is marked. A system alert: "Are you sure you want to unlink this device?" with the consequence stated ("changes... won't be synced to unlinked devices, but your files won't be deleted") and Cancel (blue) / Confirm (red).
- Why it works: the dialog states what will and will not be lost; relative "last active" wording lets users judge which device is stale.
- Adapt: removal copy for a module: "This plant keeps its history and care schedule. The module stops watering and is unlinked." Last-seen in relative words in a list row.
- Do not copy: "Confirm" as the destructive label; name the action ("Remove module"). The three-dot handles with no visible labels.

### 9. Shuteye, in-progress (shuteye-1.png)
- What I see: a low-battery warning is mentioned by the description, but the image shows only "Tracking...", time, alarm, ambient noise 62dB in orange, a Quit button. I did not see a battery warning on screen, so I cannot assess it. Weak reference; included only for honesty.

### 10. Fire TV, code entry (fire-tv-1.png)
- What I see: a modal: "Enter the 4-digit code displayed on your Fire TV." Four large boxes, two filled (5, 7), a Cancel button, numeric keypad up.
- Why it works: one instruction, a number-only keypad, large single-digit boxes show progress, a Cancel.
- Adapt: pair-by-code screen: big boxes, numeric keypad, say where the code is ("shown on the module sticker / in the box"), always a Cancel.
- Do not copy: no inline error state is visible here; design "That code didn't work. Check the digits and try again" ourselves. Do not auto-submit without a visible state while it checks.

## Comparisons

1. Status as a sentence vs icon vs gauge. Google Home: icon plus one word (Offline). Find My: two-line text grammar. Duo: sentence then evidence. iRobot: bar plus hours. Best fit for Plant Care: the sentence is primary ("Doing well", "Tank low", "Not heard from since 09:12", "Watering stopped: check the stake is in the soil"); the sentence carries the cause and the action, which neither an icon nor a gauge can. Add an icon only to tint problem states, and keep gauges for secondary detail.
2. Tank level: percentage vs ml vs vessel picture vs time left. I found no tank screen in Lazyweb, so nothing here is evidenced for tanks. The nearest evidence is iRobot: time-left with "~" beats a bare bar. For a 705 ml tank, "about 9 days of water left" answers the real question; ml and a vessel drawing can sit on the detail screen. The vessel picture is not evidenced by anything I saw.
3. Alerts inbox vs inline banner. Google Home has a bell with a dot (inbox) but also shows the problem on the tile itself. Plantin uses a tab badge plus an inline "needs care" count. For a mostly invisible device: inline banner on the plant card and plant screen, one push notification per problem, no inbox. An inbox adds a place to look when everything should be fine.
4. Separate Devices tab vs devices inside the plant. Google Home, Find My and Nothing X all have a devices list because the device is the primary object. In Plant Care the plant is the primary object and the device is an attribute. Put the module in the plant screen (a card, "Add a module" when none). Use a global list only if the user has many modules, which I have no evidence of needing; the Home summary ("N need care") covers the multi-plant case.
5. Calm "all fine" state. Duo shows "No issues found" only on a diagnostics screen; Google Home dims rather than reddens. Both support: say nothing prominent when fine, and make problems the only things with colour.

## Open questions
- Pairing failure and timeout states: not found in Lazyweb. What happens after 60 s with no module heard? Needs design (and a way to look for a published example elsewhere).
- Device removal when the module is offline: Dropbox shows the confirm text only; I saw nothing on hardware reset/factory reset instructions.
- Battery presentation (percent vs "lasts about N weeks") and a low-battery in-app counterpart: no usable screen found.
- Tank-empty state with a vessel illustration: none found.
- Whether a "check-in every 1-6 h" cadence should show a grace window before "Not heard from" appears. Not answered by any reference; a product decision.
- Push notification wording for the four states: none observed.

## All result_refs
screens:9ede373eae59212b28c4c76d
screens:55aee115315aff9c7f6b92e7
screens:b56b546c7c0413010557913e
screens:372b8953fd0e72b7572aafe2
flows:c7c21a5a22167050925cfeff
screens:24f5108e8661835339d05d3a
screens:60ef53d0aa84927ee8a6686e
screens:43b5955621039d5e500c3615
screens:97ff0041fb38fbc2eac41cd6
flows:dcffc5240241d4662e561aaa
screens:8cbc8ef54e59c4ad0a2874ed
screens:27c6470e5ed937652e987837
screens:68a8b3d18d7da0cc56fb471c
