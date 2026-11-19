# Plant Care: design system (Direction E)

_Status: approved by the owner 2026-11-19. This replaces the visual part of "Glazed Ceramic" (`docs/superpowers/specs/2026-11-17-app-ui-design.md` §2–3). Structural rules from that spec stay unless listed in [DESIGN_ROADMAP §3](DESIGN_ROADMAP.md#3-conflicts-with-approved-specs-and-code)._
_Reference renders: [direction-e.html](direction-e.html) (identity) and [flow-e.html](flow-e.html) (the type scale and every first-run screen)._

**The idea in one line:** ink on a neutral page, the plant photo as the colour, blue only for water, red only when a person must act. Plant names are set like a printed nursery tag.

## 1. Colour

All values live in `src/theme/colors.ts` and nowhere else; lint already enforces this. The existing token names are kept where the meaning is the same, so screens change less.

| Token (existing name → meaning) | Light | Dark | Used for |
|---|---|---|---|
| `background` → page | #F5F5F3 | #161616 | Every screen background |
| `surface` | #FFFFFF | #222221 | Fields, chips, sheets, list groups |
| `label` → ink | #1F1F1F | #F2F2F0 | All text, primary buttons, selected states |
| `secondaryLabel` | #66655F | #A3A29C | Meta lines, row labels, small print |
| `separator` | #E3E3E0 | #2E2E2C | Hairlines between rows |
| `waterFill` → **track** | #D9D8D4 | #3A3A38 | Empty part of tank and water lines, inactive progress |
| `water` | #5FAEE3 | #7CC0EE | **Only** the water line and the tank bar |
| `statusNow` → **red** | #D0213B | #FF5C70 | **Only** fault and tank: the sentence, its heading count and a nearly empty line |
| `tint` | = `label` | = `label` | Buttons are ink, not a brand colour |
| `onTint` | #FFFFFF | #161616 | Text on ink buttons |
| `skeleton` / `skeletonHighlight` | #ECEBE8 / #F5F5F3 | #262625 / #2E2E2C | Loading placeholders |

**Removed tokens:** `statusFine`, `statusSoon`, `statusQuiet`, `band`, `nowFill` and `soonFill`. There's no green "fine", no amber "soon" and no tinted banners. The moisture band in the History chart uses `track`.

**Contrast, calculated:**

| Pair | Light | Dark | Requirement |
|---|---|---|---|
| ink on page | 15.1 | 16.1 | 4.5 |
| secondary on page / surface | 5.4 / 5.9 | 7.1 / 6.2 | 4.5 |
| red text on page / surface | 4.9 / 5.3 | 6.1 / 5.3 | 4.5 |
| text on ink button | 16.5 | 16.1 | 4.5 |
| water fill against track | 1.7 | 5.8 | 3.0 for graphics |

The light-mode water line is below 3:1 on purpose: it is softer next to photos and the owner chose it. It is acceptable only because **every water line is paired with words that say the same thing** ("About 500 ml of 705 ml", "Water left for about 9 days", or the plant's status sentence). The rule for builders: never show a water line without its text.

**Colour rules:**
1. Nothing is ever drawn on a photo except frosted buttons and white text pills that name the room or state.
2. A screen with nothing wrong has no red on it.
3. Status is never colour alone: the sentence always says it.

## 2. Type

**Family:** Archivo, bundled as static fonts (SIL Open Font License). There are two widths:
- **Condensed** (Archivo Condensed ExtraBold, 75 % width) for plant names and screen titles only. This is the nursery-tag voice.
- **Normal** (Archivo Regular and SemiBold) for everything else.

| Style (`typography.ts` name) | Size / line | Width, weight | Tracking | Used for |
|---|---|---|---|---|
| `display` (new) | 40 / 40 | Condensed 800 | −0.01 em | Plant name on its page |
| `largeTitle` | 32 / 34 | Condensed 800 | −0.005 em | Screen titles ("Plants", "Name and place") |
| `title` | 21 / 24 | Condensed 800 | 0 | Plant names in lists |
| `headline` | 17 / 22 | Normal 600 | 0 | Status sentence, button labels |
| `body` | 17 / 24 | Normal 400 | 0 | Rows, paragraphs |
| `subheadline` | 15 / 20 | Normal 400 | 0 | Meta lines ("Calathea, living room"), secondary sentences |
| `footnote` | 13 / 18 | Normal 400 | +0.005 em | Tank labels, small print, captions |

`callout` (16) is dropped. Six sizes cover every screen.

**Rules:**
- Dynamic Type stays on: never `maxFontSizeMultiplier` or `allowFontScaling={false}` (CLAUDE.md).
- Latin names are in italic.
- Numbers in rows and tank labels use tabular figures.
- No all-caps, no letter-spaced eyebrow labels.
- At accessibility sizes, condensed names wrap rather than shrink.

**Needs approval:** Archivo is a new font asset. Loading it uses `expo-font`, which is already part of Expo. The font files themselves are a new asset (for example `@expo-google-fonts/archivo`, or the TTFs checked in). CLAUDE.md requires asking before adding a dependency.

## 3. Space, shape, size

| Token | Value |
|---|---|
| Screen side margin | 20 |
| Space scale | 4, 8, 12, 16, 20, 24, 32 |
| Gap between Home rows | 16 |
| Photo radius, list / card | 12 / 16 |
| Hero photo | Full width from the very top, radius 0, no hard edge. Its top dissolves into the page: a soft alpha mask, clear for the first 22 pt, eased to fully opaque by 164 pt. The status bar and Dynamic Island sit on page colour and the photo flows out from under them |
| Button | 52 high, radius 14 |
| Chip | 40 high, pill |
| Sheet top radius | 24 |
| Tap target minimum | 44 × 44 |
| Water line on Home | 4 high, radius 2, directly under the photo |
| Tank bar on the plant page | 10 high, radius 5 |

**No cards around list items.** Grouping comes from space and hairlines. Only photos, fields, chips and sheets have rounded corners, and each kind has its own radius.

## 4. Components

These map to `src/ui`. A component marked "new" doesn't exist yet.

| Component | Change |
|---|---|
| `Text` | Variants as §2, plus `display` |
| `Button` | Ink fill, white label; `plain` = ink text with no fill; `line` = surface with a hairline. A busy state shows `ActivityIndicator` inside the button only |
| `BottomBar` | Unchanged: the pinned primary action |
| `Row` | Label on the left in secondary, value on the right in ink, tabular figures; a navigation row has a chevron and an ink label |
| `InsetGroup` | Used for Settings only; plant screens use plain hairline rows |
| `WaterLine` (new, replaces `TankVessel` in lists) | Props: `level: number \| null`, `low: boolean`. `null` draws the dashed "no reading" line |
| `TankBar` (new) | The plant-page bar with the "About {n} ml" / "of 705 ml" labels; it always renders its labels |
| `PlantTile`, `PlantRow` | Photo + `WaterLine` + condensed name + one sentence |
| `HeroPhoto` (new) | Full-width photo whose top fades into the page through an eased alpha mask (0 → 22 pt clear, opaque by 164 pt; in React Native a masked view or a page-colour gradient overlay with the same stops), no visible edge; frosted back and more buttons (44 pt, blur 16) sit in the fade |
| `CaptureView` (new) | The camera frame today, a coverage ring later (§7) |
| `StepProgress` | Thin segments in ink on `track` |
| `Skeleton*`, `LoadingGroup`, `FadeIn` | Unchanged (loading rules); colours from §1 |
| `PotDrawing` | Kept only for the launch animation and the empty Home; not used as status |
| `StatusBanner` | Retired. Status is the plant page headline plus line (UX_ARCHITECTURE §6) |

## 5. Icons

`Icon` stays: SF Symbols on iOS, Material Symbols elsewhere. Icons appear only where a word would be clumsy: back, more, close, add, chevron, camera flip. Status never uses an icon on its own. No emoji.

## 6. Writing

- **Plain verbs, sentence case, no exclamation marks.**
- **Name the plant.** Write "Stripes", not "your plant", wherever the name is known.
- **No middle-dot strings.** Use a comma ("Calathea, living room") or two lines. This changes the M4 status copy ("Doing well · Next drink…").
- **Be approximate and honest.** Write "about 9 days" and "under 100 ml". When the value is unknown, show "—".
- **Buttons say what happens:** "Save Stripes", "Set up the module", "This is my plant". "Done" is used only to close a finished step.
- **Errors say what happened and what to do,** without apologising: "This code expired." / "New code".
- **Never promise watering we can't do.** A pause always says why it paused and how it resumes.

## 7. Motion and haptics

| Moment | Motion | Haptic |
|---|---|---|
| Launch (decided 2026-11-19) | Plain splash, then the pot draws (~0.7 s) and fades out as soon as the first screen is ready. The 0.5 s rest is dropped. A tap anywhere skips it, and it never blocks input for long. Runs on every cold start | none |
| Press | Instant highlight on touch-down (scale 0.97, 100 ms) | none |
| Push / pop | Native stack | none |
| Sheet (account) | Spring, damping 1.0, response 0.35; interruptible by drag | none |
| Step done (`StepDone`) | Existing `motion.duration.success` 200 ms, ease-out | success |
| Water line / tank bar change | Width animates over 600 ms ease-out on the native driver (transform scaleX) | none |
| Tank reaches full during setup | Bar fills, then "The tank is full." fades in (150 ms) | success |
| 3D scan coverage | Each tick fills as its angle is covered; no looping animation | light tick on each 1/4 |
| Loading | Shared shimmer only (loading rules), static under Reduce Motion | none |

- Springs are critically damped by default. Bounce is used only when a gesture carried momentum (a flicked sheet).
- Under Reduce Motion everything becomes a fade. `Animated` stays the tool (Reanimated can't load under Jest here).

## 8. Capture: photo now, 3D scan later

`CaptureView` is one screen with two modes behind the same route and the same output type ("a capture"):

| | Photo (now) | 3D scan (later) |
|---|---|---|
| Guide | Four white corner marks | Ring of 36 white ticks; covered angles are solid, the rest 35 % |
| Instruction | "Fit the whole plant in the frame" | "Walk slowly around the plant" plus progress in words ("About halfway round") |
| Shutter | White circle | Stop square while scanning |
| Fallback | "Photos" (library) | "Use a photo" |
| Output | JPEG ≤ 1600 px, quality 0.7, re-encoded (no EXIF/GPS) | Not yet specified; must meet the same privacy rule (no location data) |

The steps after capture (Result, Name and place, Health) take a capture and must not assume it is a single JPEG.

## 9. Dark mode

The light-mode rules hold: neutral page, ink becomes off-white, red and blue lighten (§1). Photos are never dimmed or tinted. Buttons invert: off-white fill with near-black text. Light remains the default (CLAUDE.md); Dark is chosen in Settings.
