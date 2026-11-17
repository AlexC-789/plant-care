# Milestone 2: plant library and identification — design

Date: 2026-11-17
Status: Approved 2026-11-17 (owner asked for explicit security measures: §8a)
Builds on: [Software design](2026-11-16-plant-care-design.md) §5.3, §6, §7 · [App UI design](2026-11-17-app-ui-design.md) (canvas boards *Home*, *Plant detail*, *Add a pot* step 1/1b) · [Loading rules](2026-11-17-loading-rules-design.md)

## 1. Intent
Owners can build their plant library: add a plant with photos, have Plant.id say what it is and
how healthy it looks, see all plants on the Plants home, open one, edit it, delete it. This is
step 1 of the canvas's six-step "Add a pot"; steps 2–6 (module, Wi-Fi, pot, stake, tank) arrive
with the device milestones and must slot in without rework.

## 2. Owner decisions (2026-11-17)
- Plant.id (Kindwise) is the identification provider, included in this milestone.
- Several photos per identification (accuracy). **Guided photos** now; a Face-ID-style **guided
  scan with an on-device "is this a plant?" check** is a later milestone (7b in the main spec),
  started once the owner has an Apple Developer account (it needs a development build).
- Photos are uploaded first, then identified by our server function (approach A below).
- Until the on-device check exists, wasted scans are limited by: identify only on an explicit tap,
  a daily per-user scan limit, and Plant.id's own "is this a plant" result.
- **Identification and health are separate.** A scan only identifies (cheapest call). Plant detail
  has a **"Check its health"** button that runs Plant.id's health assessment on demand.
  Owner change 2026-11-17: a Problem spot photo triggers an automatic health check on Continue (1 credit, shared limit). Later checks are on demand.
- **Our own houseplant database** for facts and search, not paid lookups: about 150 common
  houseplants, written fresh and checked against botanical/horticultural references, reviewed by
  the owner once. Plant.id's paid detail lookups are not used.
- The owner creates the Plant.id account; the key lives in `supabase/functions/.env` (git-ignored)
  locally and in Supabase secrets when hosted.

**Plant.id costs (Kindwise FAQ, checked 2026-11-17):** 1 credit per successful identification
(any number of photos); +1 if health is added to the same request (we don't); detail endpoints 0.5
(we don't use them); name search free; €0.01–0.05 per credit by volume; 100 free credits on sign-up;
photos best at 1–2 MP, never above 2 MP.

## 3. Goals / non-goals / anti-goals
**Goals:** add/list/view/edit/delete plants with photos; identification with up to 3 suggestions;
an on-demand health check with a one-line result; plant-type search over our own database;
"About this plant" facts; everything under the
loading rules and in Light and Dark.

**Non-goals (this milestone):** module pairing and every device status (milestones 4+); rescan and
photo timeline (milestone 3); guided scan (7b); care reminders, away mode (milestone 6);
sharing plants; editing species facts.

**Anti-goals:**
- One user seeing another's plants or photos (database rules + storage rules, both tested).
- Plant.id key in the app, or the app calling Plant.id directly.
- Losing a plant because identification failed (the plant saves without it).
- Runaway Plant.id spend (limit + explicit tap).
- Showing a percentage or a confident-sounding guess Plant.id isn't sure about.

## 4. Approaches
**Photo → identification**
- **A. Upload, then identify (chosen):** the phone shrinks photos and uploads them to the user's
  private storage folder; `identify-plant` reads them there and calls Plant.id. Uploads once;
  retries are free of re-uploads; the first photo becomes the plant photo.
- B. Send photos to the function (rejected): photos travel twice; retry re-uploads.

**Capture**
- **Guided photos, up to 4 (chosen now):** whole plant (required), leaf close-up (recommended),
  flower and problem spot (optional). Works in Expo Go.
- Guided scan + on-device check: later (7b).

## 5. User flows

### 5.1 Plants home (canvas *Home*)
- Large serif title "Plants"; toolbar `person.crop.circle` (Settings) and **`plus` (Add a pot)**.
- Summary line under the title once there are plants: "{n} need you" — in M2 every plant is
  "Setup isn't finished", so the summary reads e.g. "2 need you".
- One section "Needs you" containing rows: 60 pt photo (rounded 14; no photo → small pot drawing on
  `surface`), serif name (`title3`), status line `Setup isn't finished · Add its module` with the
  `statusQuiet` symbol. The section header is dropped when every row is in it (design rule).
- Sorted newest first. Paged: 20 per page, more loaded as you scroll (virtualised list).
- Loading: 2 skeleton rows (canvas). Error with nothing cached: "Couldn't reach Plant Care. Your
  pots keep watering on their own. Check your connection and try again." + "Try again" (canvas
  copy; the second sentence stays because it's true for the product, though no pot exists yet
  in M2 — builder may drop it while there are no modules).
- Empty: pot drawing, "No plants yet", "Add your first pot and it'll look after its own watering
  from then on." and an **Add a pot** button (canvas). The "next build" note goes.
- Pull to refresh. Tapping a row pushes Plant detail.

### 5.2 Add a pot — step 1 "Your plant" (canvas 1 / 1b)
Full-screen cover, title "Plant · 1 of 6", Cancel top-right.
1. Heading "Which plant is this for?". Fields: **Add photo**, **Name**, **Plant type** (opens a
   searchable list), **Room** (optional free text). Hint: "Not sure what it is? Add a photo and
   we'll suggest a type. The type sets how damp the soil should stay." Primary button **Continue**.
2. **Add photo** opens the guided capture (5.3). When photos come back, the screen shows them and
   an **Identify** button (the explicit tap that spends a credit).
3. Identify → "Looking at your photo…" over the first photo (usually 2–5 s) → **1b "Is it one of
   these?"**: up to 3 suggestions (common name, scientific name, confidence word), top one
   preselected only if "Very likely", "None of these, search instead", primary button
   "Use {common name}". (No health line here: health is checked separately, 5.7.)
4. Choosing a suggestion fills Plant type; Name is prefilled with the common name only if empty.
5. **Continue** saves the plant immediately (with or without photo/type; Name required) and, since
   steps 2–6 don't exist yet, closes the cover and opens the new plant's detail.
   Owner change 2026-11-17: a Problem spot photo triggers an automatic health check on Continue (1 credit, shared limit). Later checks are on demand. The check runs in the
   background (whole + problem photo); the detail shows "Looking at your plant…" until it finishes.
- Failure or "not a plant": "Couldn't tell from this photo. Try one with a whole leaf in view, or
  search." Search is always available. The photos stay attached to the plant either way.
- Limit reached: "You've reached the identification limit for now. Search for the plant type, or
  try again later." (rolling 24 h window, so no "tomorrow").
- Cancel before Continue: nothing is saved; uploaded photos are deleted.

### 5.3 Guided capture
- Four cards in order: **Whole plant** ("Step back so the whole plant and pot fit"), **One leaf**
  ("Fill the frame with one healthy leaf"; Skip), **Flower** ("If it's flowering"; Skip),
  **Problem spot** ("If something looks wrong"; Skip). Identify sends whole, leaf and flower only;
  the problem photo is for the health check.
- Each card: **Take photo** (system camera via `expo-image-picker` launchCamera) or **Choose from
  library**. Thumbnails can be retaken or removed. At least the whole-plant photo is needed to
  identify.
- Camera / photo permissions requested when first used, with a one-line reason; denied → a row
  with "Open Settings".

### 5.4 Plant type search
Pushed list with a search field, debounced 300 ms. Searches **our `species` table first**
(names and common names, instant, cached on the phone). If fewer than 3 local matches, it also
asks Plant.id's name search (free) and shows those below a "More plants" header. Results read
"Common name — Scientific name". Picking a local result links it (facts included); picking a
Plant.id-only result stores a species with names only (no facts, no paid lookup). If nothing
matches: "Use “{typed text}” as the type" (custom type, no facts).

### 5.5 Plant detail (canvas *Plant detail*, M2 subset)
- Hero photo 390×280 under the translucent nav bar (pot drawing on `surface` when no photo); title
  name (serif `title`), subtitle "{type} · {room}".
- **Setup banner** (soon style): "Setup isn't finished" / "The module steps arrive in the next
  build." (no button in M2, so nothing does nothing).
- **Health**: the result of the latest health check, if any ("Checked {date}: It looks healthy."),
  and a **"Check its health"** button (bordered).
- **About this plant**: description (3 lines, "More" expands), light, watering — from the species
  record. Hidden for custom types.
- "…" menu → **Edit plant**.
- Loading: skeletons for the title block and About; the photo area shows `skeleton` colour.

### 5.7 Check its health
"Check its health" → guided capture with two cards: **Whole plant** (required) and **Problem spot**
(optional, "If something looks wrong") → **Check** button (explicit tap) → "Looking at your
plant…" → one-line result: healthy ("It looks healthy in this photo.") or the top issue in plain
words ("Some leaves look yellow. Often too much water.") with one line of what to do; unsure →
"Couldn't tell from this photo. Try one with the leaves in view." Results are stored as a scan of
kind `health` linked to the plant. Shares the identification limit.
Owner change 2026-11-17: a Problem spot photo triggers an automatic health check on Continue (1 credit, shared limit). Later checks are on demand.

### 5.6 Edit plant
Sheet with Done: photo (replace via guided capture without identifying, or remove), Name, Plant
type (search), Room. **Delete plant** at the bottom (destructive) → confirmation "Delete {name}?
Its photos are deleted too. This can't be undone." Delete removes the row, its photos and scans.

## 6. Data
New migration. All user tables: RLS owner-only, pgTAP tests incl. cross-user.
- `species` — shared reference data: `id uuid pk`, `scientific_name text unique not null`,
  `common_names text[]`, `description text null`, `light text null` (`bright_indirect` |
  `medium` | `low` | `direct`), `watering text null` (short plain-language line),
  `moisture_category text null` (`dry` | `moderate` | `moist`, used by milestone 5's plans),
  `origin text` (`curated` | `plantid`), `checked_against text null` (reference used),
  `plantid_name text null`, `updated_at`. Readable by `authenticated`; written only by migrations
  (curated seed) and the service role. Search uses a trigram/ILIKE index on names.
- **Curated seed:** ~150 common houseplants in a seed migration. Descriptions written fresh (no
  copied text); names checked against Plants of the World Online / GBIF; care facts against RHS,
  Missouri Botanical Garden or NC State Extension; `checked_against` records which. Owner reviews
  the list once. Entries can be corrected later by a migration, no app update.
- `plants` — `id uuid pk`, `user_id`, `name text not null` (1–60 chars), `species_id uuid null →
  species`, `custom_type text null`, `room text null` (≤ 40), `photo_path text null`,
  `setup_step smallint not null default 1` (1 = plant saved; device steps later),
  `created_at`, `updated_at`. Owner can select/insert/update/delete own rows.
- `scans` — `id uuid pk`, `user_id`, `plant_id uuid null → plants on delete cascade`,
  `kind text` (`identify` | `health`), `photo_paths text[]`,
  `status text` (`ok` | `not_plant` | `error`), `is_plant numeric`,
  `suggestions jsonb`, `health jsonb`, `created_at`. Owner can select own rows; inserts only by
  the function (service role). **Linking (builder's call):** identify runs before the plant
  exists, so the scan is saved with `plant_id` null and its id is returned; on Continue the app
  sets `plant_id`. The owner may update only that column, only while it is null, and only to a
  plant they own (column grant + RLS check, pgTAP-tested). The plant's health note comes from its
  latest linked `ok` scan of kind `health`.
- Spec §6 columns for later milestones (`watering_preference`, `low_water_alert_ml`, light) are
  added when used.

**Photos (builder's call):** the first photo becomes `plants.photo_path`; the leaf and
flower photos are kept only as part of their scan (`scans.photo_paths`) and are deleted on
Continue if never identified (the problem photo lives on as its health scan). Deleting a plant deletes its photo and all its scans' photos.
Uploads orphaned by a killed app before Continue/Cancel are accepted for now (a cleanup job is
noted for store readiness).

**Storage:** private bucket `plant-photos`; objects at `{user_id}/{uuid}.jpg`; storage policies
allow a user to read/write/delete only under their own `user_id/` prefix (tested).

## 7. Server functions (Edge Functions, zero runtime npm deps, Plant.id key in secrets)
- **`identify-plant`** (user JWT required): body `{ photoPaths: string[] (1–3), plantId?: uuid }`.
  - Rejects paths outside the caller's folder (403).
  - Limit (builder's call): 20 identifications per user per rolling 24 h, counting only scans
    that reached Plant.id successfully (`ok` and `not_plant`, which spend credits); provider
    errors don't count → 429 with the limit message.
  - Downloads the photos (service role), calls Plant.id v3 identification with all images and
    **no health assessment**; requests only the free in-response details (common names,
    description, watering, best light).
  - Stores a `scans` row (`kind = identify`); matches each suggestion to our `species` by
    scientific name, and inserts a `plantid`-origin species (with the free details) when missing.
  - Returns `{ isPlant: boolean, suggestions: [{ speciesId, commonName, scientificName,
    confidence: 'very_likely' | 'likely' | 'possibly' }] (≤ 3), health: { healthy: boolean,
    note: string } | null }`.
  - Confidence words: ≥ 0.7 very likely, ≥ 0.35 likely, otherwise possibly; suggestions below
    0.05 dropped. `isPlant` false when Plant.id's is_plant probability < 0.5 → no suggestions.
  - Timeout 20 s / provider error → 502 "Couldn't identify right now. Try again." No credit
    logic on our side beyond the limit; the scan row is still written with the error.
- **`check-health`** (user JWT): `{ plantId, photoPaths (1–2) }` → same ownership and limit rules →
  Plant.id health assessment → stores a `kind = health` scan → `{ healthy: boolean | null,
  note: string, advice: string | null }`. Healthy probability ≥ 0.8 → healthy; else top issue
  ≥ 0.5 → plain-words note from a small mapping table (builder writes it, ~15 common issues);
  otherwise "Couldn't tell from this photo…".
- **`search-plants`** (user JWT): `{ query }` (≥ 2 chars) → Plant.id name search (free) → up to 10
  `{ commonName, scientificName }`. Only called when local search has < 3 matches. Picking one
  inserts a names-only `plantid` species via the same function (`{ pick: scientificName }`).
- Hook for later: `identify-plant` stays the single provider boundary, so swapping providers is
  backend-only.

## 8. App structure
- Routes: `(app)/index` (library), `(app)/plant/[id]` (detail), `(app)/plant/[id]/edit` (sheet),
  `(app)/add/plant` (cover), `(app)/add/search` (type search), `(app)/add/capture` (guided capture).
- Data via TanStack Query: `['plants', userId]` infinite query (20/page, `created_at desc`);
  `['plant', id]`; `['species', id]`. Mutations update the cache; delete removes from it.
- Photos: `expo-image-manipulator` → longest side 1600 px (≤ 2 MP, Kindwise's recommended 1–2 MP
  range), JPEG 0.7 before upload. Display via
  `expo-image` with signed URLs (1 h), `cacheKey` = storage path so a new signed URL doesn't
  re-download; list requests sign the page's paths in one call.
- New deps: `expo-image-picker`, `expo-image-manipulator`, `expo-image` (via `npx expo install`).

## 8a. Security (owner, 2026-11-17)
Each item is a requirement with a test.
1. **Data isolation:** RLS on `plants` and `scans` (owner-only); `species` read-only to users;
   `scans` insert only by service role; owner may set `scans.plant_id` once, only to an own plant.
   pgTAP cross-user tests for every table and every operation.
2. **Photo storage:** private bucket; policies limit read/write/delete to `{auth.uid()}/…`;
   bucket `file_size_limit` 3 MB and `allowed_mime_types` `image/jpeg`; object names are server-
   checked UUIDs (`^[0-9a-f-]{36}\.jpg$`), so no path tricks (`..`, other users' folders).
3. **Location privacy:** photos are re-encoded on the phone before upload, which drops EXIF
   metadata (GPS location, device). A test checks the uploaded JPEG carries no EXIF GPS block.
4. **Server functions:** require a valid user JWT (`verify_jwt` on); validate every input
   (types, counts 1–3 / 1–2, path format and owner prefix, `plantId` owned by caller, query
   length 2–60); reject unknown fields; uniform error bodies with no stack traces, keys or
   provider messages; request body ≤ 10 KB (photos travel via storage, not the body).
5. **Abuse and cost:** per-user limit (20 Plant.id calls / rolling 24 h) for identify and health;
   search limited to 120 requests / user / hour; Plant.id calls time out at 20 s.
6. **Secrets:** `PLANT_ID_API_KEY` only in function secrets (`supabase/functions/.env` locally,
   git-ignored; Supabase secrets hosted). The app never holds it; no secret appears in logs.
7. **Signed URLs:** photos shown via signed URLs valid 1 h, generated per request for the caller's
   own paths only (under RLS-protected rows).
8. **Deletion:** deleting a plant deletes its row, its scans and every stored photo (plant photo and
   scan photos); a test checks no objects remain.
9. **Logging:** functions log request id, user id and outcome only — never photos, keys, or
   provider payloads.
10. **Review:** a dedicated security review of the branch before the pull request, findings fixed
    with tests.

## 9. Testing
- pgTAP: plants/scans RLS incl. cross-user; species read-only for users; storage policies (own
  prefix only); constraints (name length, room length).
- Function tests (Deno, injected fetch, recorded sample responses): path ownership 403; limit 429
  at the 21st counted scan (errors not counted); identification request shape (all images, no
  health, free details only); confidence mapping; is_plant false → no suggestions; species match
  by scientific name, insert when missing, idempotent; health mapping and "unsure" path; provider
  timeout → 502; search proxies and clamps.
- Seed: pgTAP checks ≥ 150 curated species, unique scientific names, every curated entry has
  light, watering and moisture category.
- App: library (skeletons, empty state, paging, error with/without cache), add flow (identify only
  on tap, suggestion preselect rule, name prefill rule, save without type, cancel cleans up,
  limit message), guided capture (skip rules, at least one photo), search, detail (setup banner,
  About hidden for custom type), edit + delete confirmation.
- Browser screenshots light/dark; on-phone check by the owner (camera works in Expo Go).

## 10. Left to the builder
Exact component breakdown, list row/section components, debounce helper, how the Plant.id
response is parsed (within the mapping rules), image cache details, whether search lives in one
function or two.
