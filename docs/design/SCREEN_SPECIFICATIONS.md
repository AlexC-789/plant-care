# Plant Care: screen specifications

_Status: approved by the owner 2026-11-19. Visuals: [flow-e.html](flow-e.html), screens 1–12. Tokens and components: [DESIGN_SYSTEM](DESIGN_SYSTEM.md). Flow and status rules: [UX_ARCHITECTURE](UX_ARCHITECTURE.md)._

**Conventions:**
- Copy in quotes is final unless marked _(draft)_. `{name}` is the plant's name.
- **Primary** is the `BottomBar` button.
- Every screen follows the loading rules: the layout renders at once, placeholders are `Skeleton` in `LoadingGroup`, and arriving content uses `FadeIn`. A failed load with no cache shows "—".
- **Accessibility applies to every screen:** headings are marked as headers, every control has a label, targets are at least 44 pt, and status is in words.

---

## 1. Welcome (new)

**Layout:**
1. Photo of a plant in a pot, edge to edge, top 58 % of the screen, with no text on it.
2. Large title: "Plants that water themselves".
3. Subhead: "Scan a plant to see what it is and how it's doing. Add a Plant Care module and it takes care of the watering."

**Primary:** "Scan a plant". It starts a guest session, then opens Capture.

**Secondary (plain):** "I already have an account". It opens Sign in.

**States:**
- Guest session fails (offline): the button shows "You're offline. Connect to scan a plant." and stays enabled to retry.

**Notes:** Shown only when there is no session. Sign out returns here.

## 2. Capture (change: `add/photo`)

**Layout:**
- Full-screen camera, with the status bar over it.
- Frosted ✕ (close) top left and ? (tips) top right.
- Four white corner marks.
- Instruction above the shutter: "Fit the whole plant in the frame".
- "Photos" bottom left, which opens the library.
- Shutter in the centre.

**Tips sheet (?):** _(draft)_
- "Stand back so the whole plant fits, pot included."
- "Daylight works best."
- "One plant per photo."

**States:**
- Camera denied: "Plant Care needs the camera to see your plant." with "Open Settings" and "Choose a photo instead".
- Processing: the shutter becomes a busy button.

**3D mode (later):** see DESIGN_SYSTEM §8. The instruction becomes "Walk slowly around the plant", the fallback becomes "Use a photo", and progress is in words.

**Output:** a capture. The photo is re-encoded with `preparePhoto` (≤ 1600 px, JPEG 0.7, no EXIF or GPS).

**Camera permission:** asked when the person taps "Scan a plant", never at launch. The system prompt carries the reason: "Plant Care uses the camera to see your plant and identify it."

## 3. Result (change: `add/identify`)

**Layout:**
1. The captured photo, edge to edge, 360 pt high, with a frosted back button.
2. Footnote with confidence in words: "Very likely" when ≥ 0.8, "Probably" at 0.5–0.8, "Might be" below 0.5.
3. Display: the common name ("Peacock plant").
4. Subhead in italic: the Latin name.
5. Body, one care line from `species` _(draft per species)_: "Likes steady moisture and indirect light. Its leaves curl when it's thirsty."

**Primary:** "This is my plant".

**Secondary (plain):** "It's something else". It opens the alternatives (up to 3, each with a thumbnail, name and confidence word) and "Search by name".

**States:**
- Below 0.5: the alternatives are shown straight away under the main result.
- No match or error: "Couldn't tell what this is." with "Try another photo" and "Search by name".
- Guest limit reached: "Create an account to identify more plants." opens the account sheet.
- Server limit reached for an account: "You've identified 20 plants today. Try again tomorrow, or search by name."

## 4. Name and place (change: `add/where`)

**Layout:**
- Progress segments 2 of 3.
- Large title "Name and place".
- **Name** field, prefilled with the common name and selected for typing.
- **Room** chips: the person's existing rooms first, then "Living room", "Bedroom", "Kitchen", "Hall", "Other…". "Other…" opens a text field.
- **Light where it stands:** three choices.
  - "Bright", near a sunny window
  - "Medium", a few steps away (default)
  - "Low", far from windows

**Primary:** "Save {name}".

**Validation:** the name is required, 1–40 characters. Error: "Give it a name."

**Notes:**
- Light is stored as product spec §8 describes.
- If the light column doesn't exist yet, that's a backend task (roadmap).

## 5. Keep {name}: account sheet (new)

**Presentation:** sheet over the dimmed screen, with the saved plant's photo visible above it.

**Copy:**
- Large title: "Keep {name}".
- Subhead: "Create an account so {name}, its photos and its module stay with you if you change or lose your phone."

**Buttons:** until M8, a single ink button "Continue with email". In M8, "Continue with Apple" (ink) and "Continue with Google" (line) are added above it, and email becomes a line button.

**Link under the button:** "I already have an account". It opens Sign in; after signing in, the plant being saved is added to that account (the photo is re-uploaded from the phone).

**Footnote:** "By continuing you agree to the Terms and Privacy Policy." Both are links.

**Email path:**
- Sign-up form: email, password with at least 8 characters, show/hide.
- Email confirmation stays on: "Check your inbox. We sent a link to {email}."
- Resend has a 60 s cooldown, as built.
- The guest becomes this account, keeping the same user id.

**"Not now"** (plain button under the link, decided 2026-11-19): neutral wording, never loss-framed. The plant stays on this phone as a guest and the flow continues to Health. Setting up a module later opens this sheet first, with the subhead "Create an account to connect a module to {name}."

**Close (✕ or swipe down):** returns to Name and place. Nothing is lost.

**No marketing opt-in on this sheet.**

## 6. Health (change: `add/health`)

**Layout:** progress 3 of 3; the photo (radius 16); large title; body; footnote.

| Result | Title | Body |
|---|---|---|
| Healthy, no cause | "{name} looks healthy" | "No signs of pests or disease in this photo." |
| Issue found (≥ 0.2) | "{name} may have {issue}" | One-line cause and what to do _(from check-health)_ |
| Unclear | "Hard to tell from this photo" | "Try again in daylight, close enough to see the leaves." |
| Error | "Couldn't check {name}'s health." | "Try again" button |

**Footnote:** "Checked from your photo. Take another any time from {name}'s page."

**Primary:** "Done".

## 7. Module offer (new)

**Layout:**
- Large title: "Does {name} have a module?"
- Body: "The Plant Care module sits in the saucer, reads the soil and waters from its own tank. Setting one up takes about two minutes."
- Rows under "You'll need": "The module and its stake", "Water for the tank", "Your Wi-Fi password".

**Primary:** "Set up the module".

**Secondary (plain):** "Not now". It goes to Home, and the plant shows "No module" under Doing well.

## 8. Connect the module (exists, M4: `plant/[id]/module`)

**Layout:**
- Progress 1 of 2.
- Large title "Connect the module".
- Body: "Hold the button on the module until the light blinks, join its Wi-Fi, then type this code:" _(draft until the firmware setup is final)_
- The code in condensed display type, in groups of 4.
- Footnote: "Code works until {time}".
- Row: "Waiting for the module…".

**Secondary (plain):** "It isn't connecting". It opens a checklist sheet:
- "The light is blinking."
- "Your phone is on the module's Wi-Fi."
- "Your home Wi-Fi is 2.4 GHz."
- "Get a new code."

**States, as built:**
- "Couldn't make a code. Try again." / "Try again"
- "This code expired." / "New code"
- On claim, it moves to Fill the tank.

**Dev note:** the simulator line ("on your computer run `node sim/sim.ts --claim {code}`") stays in development builds only.

## 9. Fill the tank (exists, M4: `plant/[id]/tank`)

**Layout:**
- Progress 2 of 2.
- Large title "Fill the tank".
- Body: "Open the cap on the saucer and pour until the water reaches the top of the hole."
- `TankBar`, filling live from readings.
- Once full: headline "The tank is full." and subhead "{name} gets its first drink when the soil starts to dry."

**Primary:** "Done". It's enabled once the tank reads full. Before that, the plain button "I'll fill it later" goes to Home, and the plant shows the tank status.

**There's no "I filled it" button,** because the module senses the water.

## 10. Notifications priming (new, M6)

**Shown:** once, after the first module setup, and only if permission hasn't been decided yet.

**Layout:**
- Large title: "Hear about it when {name} needs you".
- Body: "Only when you have to do something. Nothing about watering that went fine."
- Two example notifications, using the real texts (UX_ARCHITECTURE §7).

**Primary:** "Allow notifications". It shows the system prompt.

**Secondary (plain):** "Not now". The question isn't asked again; Settings shows a "Notifications are off" row with "Turn on". "Not now" never triggers the system prompt; only "Allow notifications" does.

## 11. Plants (Home) (change: `(app)/index`)

**Header:** large title "Plants"; ink round "+" button (label "Add a plant") on the right; a Settings button (person icon) to its left.

**Section "{n} need you"** ("1 needs you" for one):
- Headline in red if any member is fault or tank, otherwise in ink.
- Rows: 96 × 112 photo with its `WaterLine` under it, then the condensed name, the subhead "{species common name}, {room}" and the status sentence (red for fault and tank). A plant with no module has no `WaterLine`.
- Ordered by the status order (UX_ARCHITECTURE §6).

**Section "{m} doing well":**
- A two-column grid: photo (radius 12) with its `WaterLine`, the condensed name, and a one-line status in secondary.
- A single column at accessibility sizes.

**When nobody needs you:** the "need you" section is omitted. The first heading is "All {m} doing well".

**Empty (signed in, no plants):**
- `PotDrawing`.
- Large title: "No plants yet".
- Body: "Scan a plant to add it."
- Primary: "Scan a plant".

**Paging:** a virtualised list (FlatList), fetched page by page. The counts come from the server, not from loaded pages (this fixes a known issue).

**After adding a plant:** Home opens with the new plant already in the cache (written with `setQueryData` on save), so there is no skeleton or empty state.

**Offline:** the line "Offline. Showing what was last loaded." under the title.

## 12. Plant page (change: `plant/[id]/index`)

**Top to bottom:**
1. **Hero photo,** full width, about 290 pt high from the top of the screen. Its top dissolves softly into the page (no edge), so the status bar and Dynamic Island float on page colour and the photo flows out from under them. Frosted back and more (⋯) buttons. White pills on the photo bottom left: room and, when it applies, the red state. In dark mode the pills use the surface colour.
2. **Name** in display type.
3. **Subhead:** "_{Latin}_, {room}".
4. **Headline + line** from the status table (UX_ARCHITECTURE §6).
5. **Tank bar** with "About {n} ml" on the left and "of 705 ml" on the right. Omitted when there's no module. Dashed with "No current reading" when offline. When the tank is low the left label reads "Nearly empty".
6. **Rows:**
   - "Soil": "{Dry/Damp/Very wet}, {n} %"
   - "Last drink": "{ml} ml at {time}" or "{ml} ml yesterday"
   - "Battery": "{n} %"
   - **No module:** the rows are replaced by "Set up a module ›" and "Check its health ›".
7. **Navigation row:** "Photos and watering history ›".

**Why it isn't watering now.** One subhead line under the tank bar, shown only when the person might expect a drink:
- "Not watering now: the soil is still damp."
- "Today's limit is reached (150 ml). It drinks again tomorrow."
- "Watering is paused until the tank is refilled."

**How watering works ›** is a row above the history row. It opens a sheet in plain words:
- "{name} gets at most 40 ml at a time and 150 ml a day."
- "It never pumps when the tank is low."
- "If two drinks don't make the soil wetter, it stops and asks you to check the stake."

**Resume watering** (fault `no_moisture_rise`, M5). The plant page shows the primary "Resume watering". Tapping it goes through these states:
1. "Sending…"
2. "Waiting for the module…" (until its next check-in)
3. "Watering resumed", once the module confirms.

The plant then leaves Needs you by itself, and the headline reads "Back to normal" until the next status change.

**More (⋯) menu:**
- "Edit"
- "Check its health"
- "Pause watering" (M5)
- "Remove module"
- "Delete {name}" (destructive; confirm with "Delete {name} and all its photos?" / "Delete" / "Cancel")

## 13. Photos and watering history (change: `plant/[id]/photos` → `history`)

**Top:** a 7-day moisture curve:
- Ink line, `track` band for the target range, a "now" dot.
- The y-axis in words: "Dry", "Damp", "Very wet".
- Accessible summary: "Soil moisture over 7 days, now Damp, 41 %."

**Below:** a dated log, newest first, with a section per day ("Today", "Yesterday", "Mon 16 Nov"). Entries:
- photo thumbnails
- "Watered itself, 30 ml"
- "Tank refilled"
- "Watering stopped" / "Resumed"
- health results

Virtualised and paged. Tapping a photo opens the viewer (exists, M3).

## 14–20. Existing screens, restyle only

| Screen | Changes |
|---|---|
| Photo viewer | Ink on black, frosted buttons; copy unchanged |
| Health check (plant) | Uses `CaptureView`, then the Health result layout from screen 6 |
| Edit | Name, room chips, light choices, species ("Change species" opens search); no photo controls (as built) |
| Settings | Groups: Account (email, "Sign out", "Delete account"), Appearance (Light / Dark), Notifications. Guests see "Keep your plants" (opens the account sheet) at the top; Home shows the same quiet row under the title for guests |
| Sign in | Large title "Welcome back"; email, password; "Forgot password?"; Apple / Google buttons when enabled |
| Sign up (email) | Reached only from the account sheet |
| Email confirmed | Large title "Email confirmed"; body "You can go back to Plant Care now." |
