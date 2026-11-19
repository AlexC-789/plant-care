# Plant / gardening app research (Lazyweb)

Search id: f1929613-d726-45a0-88f6-cf9b35064eca. Images: a local scratch folder (plants screenshots, not kept)

## Coverage and honesty note
Lazyweb's plant coverage is thin. Only **PictureThis** and **PlantIn** have plant-specific screens.
Returned nothing for: Planta, Greg, Blossom, Seek/iNaturalist, Click & Grow, AeroGarden.
Not found at all: identification result / confidence UI, failed or poor-photo identification, photo timeline, device or tank-level UI for a plant product.
Two upstream timeouts hit multi-query calls (`mcp_upstream_timeout`), so I ran fewer, smaller queries.
Six screens were viewed as images. Two paywalls and the PictureThis onboarding flow (first step is a "Botanist in Your Pocket" welcome with a Continue button) were seen only as text descriptions, not images.
Everything below is limited to what was seen.

## References (viewed as images)
| # | App | Screen | result_ref | Local image |
|---|---|---|---|---|
| 1 | PictureThis | Home "For You" with Today's Care | screens:36ac231ba5c2f7ee1390929f | plants/picturethis-home.png |
| 2 | PictureThis | My Garden library | screens:9ece692fd852a53de1d22fd9 | plants/picturethis-library.png |
| 3 | PictureThis | Diagnose tab | screens:98bbc840adad450500f7772b | plants/picturethis-diagnose.png |
| 4 | PlantIn | Home with Spaces (dark, with prize wheel) | screens:b56b546c7c0413010557913e | plants/plantin-home.png |
| 5 | PlantIn | To do / My Plants segmented home + "Plant school" sheet | screens:dc161e1a30008fada0c8dc92 | plants/plantin-todo.png |
| 6 | PlantIn | Empty space | screens:749e50a428e882db73b02ddb | plants/plantin-empty.png |

Text-only (not viewed): PictureThis loading paywall after scan (screens:c1b5938d2038ced611423504), PlantIn paywall (screens:b4494f4528052201557506af), PictureThis home with free-trial banner (screens:fbc71bbcea3f7b1513d0c0e1), PictureThis "TOP1 accuracy" promo (screens:ab481f9528d74ee760e3b781), PictureThis More tab (screens:fddf58ce122fde3a6cea0bf7), PlantIn welcome (screens:cf6176be355dbb18016f7cf0), PictureThis onboarding-paywall flow (flow_canonical_id 2301).

## Per-reference analysis

### 1. PictureThis Home, "Today's Care"
- **Solves:** getting from app open to a core action (identify, diagnose, garden) and showing pending care.
- **Seen:** region picker, search pill, a beige "free 7-day Premium not claimed" banner with a red badge, three equal tiles (Identify / Diagnose / My Garden), then "Today's Care": a big "2 Tasks Pending" and two rows (Tea rose, Watering; Tea rose, Fertilizing), each with a snooze pill and a filled green action pill. Centre camera button bulges out of the tab bar.
- **Intuitive because:** the big count says how much there is to do at a glance, and each row has one tap to complete it. The camera is always one tap away.
- **Adapt:** a single big number summarising "what needs me" at the top; row = plant thumbnail + one-line state + one action.
- **Don't copy:** the upsell banner above the content, the region selector and search bar crowding the top, the identical-icon tiles. Two rows both named "Tea rose" shows schedule tasks pile up per plant. Tasks are schedule-driven, which is wrong for a sensor product.

### 2. PictureThis My Garden
- **Solves:** a plant list with a care status.
- **Seen:** "My Garden / Snap History" tabs, search, timer/heart/more icon buttons, a "Plant Finder" promo card above the first plant, then a card with photo, common name, italic Latin name and two green "Today" markers (water, fertilise) with an icon at the bottom right. Large empty area below.
- **Intuitive because:** common name first, Latin name secondary; a status strip on the card.
- **Adapt:** common name over Latin name; a status footer on each plant row.
- **Don't copy:** a promo card at the top of the user's own library. "Today" with only an icon is ambiguous (what is due?). A calendar-derived "Today" is not a moisture reading.

### 3. PictureThis Diagnose
- **Solves:** health check entry.
- **Seen:** hero illustration (leaf in a scan lens with problem icons), one big orange "Auto Diagnose" button, "Problems by Plant" horizontal photo cards.
- **Intuitive because:** one primary action with a single sentence; the user's own plants are the second step.
- **Adapt:** one dominant action per screen; plant photos as the entry to a per-plant problem list.
- **Don't copy:** a second accent colour (orange) alongside green; a stock illustration.

### 4. PlantIn Home with Spaces
- **Solves:** grouping plants by place and showing which need care.
- **Seen:** moon phase, date, weather, a row of seven small care-type icons in the header, a purple "Spin the wheel / Win your prize" promo with a glow, then a "General" space card: "1 plant (1 needs care)" with three red-outlined round action buttons (water, mist, fertilise). A "Create space" dashed-style button below.
- **Intuitive because:** the red outline marks the plants that need care; "(1 needs care)" gives the status in words; spaces map to rooms.
- **Adapt:** grouping by room; status expressed as words; red used only for attention.
- **Don't copy:** the gamified prize wheel, moon phase, and header icon row. This is the clearest example of promo and decoration displacing care information.

### 5. PlantIn To do / My Plants, plus "Plant school" sheet
- **Solves:** separating "what to do" from "what I have".
- **Seen:** Local weather row, a two-segment control (To do / My Plants), a dismissible "Moon calendar has moved" notice, then a sheet with a cartoon plant on books and a "Go to lessons" button covering the home screen.
- **Intuitive because:** the segmented control means the user chooses a mental model.
- **Adapt:** the segmented control idea if both a collection view and an attention view are needed.
- **Don't copy:** a feature-announcement sheet over the main screen; stacked notices before the task list.

### 6. PlantIn empty space
- **Solves:** first-run empty state.
- **Seen:** an orange "Free Premium Available" gradient banner, a large cartoon of a startled boy holding a pot, "This space is empty / Add a plant to get a care plan!", a full-width green "Add first plant" button.
- **Intuitive because:** the copy states the benefit of adding a plant (a care plan) and the CTA is a plain verb.
- **Adapt:** the benefit line and a single clear button, adjusted to "Add your first plant / pair a module".
- **Don't copy:** the premium banner in an empty state, and the cartoon.

## Comparisons

**Today/tasks home vs collection home.** PictureThis puts a task list on a "For You" tab with the plant library on a separate tab. PlantIn defaults to the collection ("Spaces") and offers To do vs My Plants as a switch. In both, the task list is generated from a schedule, and the home is shared with search, promos and discovery. For a sensor-driven self-watering product, a **collection-first home with per-plant status** fits better: the device waters on its own, so the user's question is "is everything fine?" rather than "what must I do?". Show a task list only for actual human tasks (refill tank, charge). I have no evidence on which converts or retains better.

**Schedule-driven vs sensor-driven.** Every care screen seen is schedule-driven (the "Today" markers and "Watering" task rows are calendar-based). Nothing seen shows a live reading. This is a gap Plant Care can own: show the moisture reading and last/next watering as a fact, not a chore.

**Confidence display (percentage vs word vs ranked options).** Not found in Lazyweb for plant apps; I cannot compare these from evidence. The only related result was a Google Lens onboarding screen (text description only).

**Action affordance.** PictureThis uses a filled pill (done) next to an outlined pill (snooze); PlantIn uses round outlined icon buttons (red when due). Both rely on icons alone without a label, which is hard to read.

**Paywall placement (text only).** PictureThis shows a paywall loading state ("Your order is being created") right after a scan, per its description; its onboarding flow ends in a paywall; free-trial banners sit at the top of the home screen in both apps. The effect on UX: the first thing on the home and empty states is an upsell, pushing real content down.

## Identity clichés to avoid
- Dark UI with mint/emerald green accent and a bulging circular camera button (both apps seen).
- Orange or purple gradient promo banners and a glowing gamified wheel.
- Leaf, sprout and scan-frame-flower logos; stock cartoon illustrations (boy with pot, plant on books).
- Card stacks of promos before user content; badge counts and red dots on promo items.
- Ambiguous icon-only status buttons; moon/weather widgets as decoration.
- Upsell banners in empty and first-run states.

Ways to stand apart (suggestions, not evidence): light paper background, status in plain words, one accent used for state, no promos in the user's data, a real photo of the user's own plant as the main image, and the tank/moisture drawing as the signature element.

## Open questions
- Which apps beyond PictureThis and PlantIn exist in Lazyweb? Try a company filter for Planta, Greg, Blossom, Seek with different spellings, or desktop capture.
- How do apps show identification results (single best match, ranked options, confidence)? No evidence yet.
- How do apps handle an unidentifiable photo? No evidence yet.
- Photo timeline UIs: none found; consider non-plant references (growth tracking, baby, fitness progress photos).
- Device-status UI for tank/battery: none found in the plant category; look at smart-home references (Google Home add-device was the only hit and was not viewed).
- Onboarding flow images for PictureThis (flow 2301) not viewed.

## All result_refs
screens:36ac231ba5c2f7ee1390929f, screens:9ece692fd852a53de1d22fd9, screens:98bbc840adad450500f7772b, screens:b56b546c7c0413010557913e, screens:dc161e1a30008fada0c8dc92, screens:749e50a428e882db73b02ddb, screens:c1b5938d2038ced611423504, screens:b4494f4528052201557506af, screens:fbc71bbcea3f7b1513d0c0e1, screens:ab481f9528d74ee760e3b781, screens:fddf58ce122fde3a6cea0bf7, screens:cf6176be355dbb18016f7cf0, screens:eae81635bfb3bd938ee5293f, screens:0cc9a003744a112e7d38009d; flow_canonical_id 2301
