# Milestone 3: photo timeline and rescan — design

Date: 2026-11-18
Status: Approved by owner 2026-11-18
Builds on: product spec `2026-11-16-plant-care-design.md` §7 (plant detail: "photo timeline from past
scans, rescan button"), §8 ★ Photo timeline ("each rescan is saved so you can see the plant grow and how
its health changed"), §11 milestone 3. M2 design `2026-11-17-m2-plant-library-design.md` (§6 data, §8a
security — all still binding) and `2026-11-18-add-plant-steps-design.md`.

## 1. Intent
Owners can see their plant grow: every photo of a plant is kept on a timeline, newest first, with any health
result attached. Adding a photo is free and instant; Plant.id is only used when the owner asks (health check,
or "What is it?" to fix the type).

## 2. Owner decisions (2026-11-18)
- **Adding a photo is free** (option a): just a photo; health check / re-identify only on request.
- **Tapping a timeline photo opens a full-screen viewer** you swipe through, with date and health note.
- **Storage: a new `plant_photos` list** (approach 1), not "just a photo" scans.

## 3. Goals / non-goals / anti-goals
**Goals:** timeline strip on plant detail; full-screen swipe viewer; "Add a photo" (free) with an optional
health check offer; delete a photo; "What is it?" on a photo to re-identify and change the type; existing
plants get a timeline from their M2 photos.

**Non-goals:** comparison/side-by-side views, time-lapse, notes on photos, sharing, photo editing, reminders
to take photos (milestone 6), device data on the timeline (milestone 4+).

**Anti-goals:** a photo disappearing without the owner deleting it; one user seeing another's photos;
spending a Plant.id credit without a tap; a dangling photo (row or plant pointing at a deleted object).

## 4. Approaches
1. **`plant_photos` table (chosen).** One row per photo; the timeline is a plain query; scans stay
   server-written only (§8a.1 intact).
2. Reuse `scans` with a `photo` kind — would let the app insert scans, weakening §8a.1, and mixes free
   photos with Plant.id results. Rejected.
3. Derive from Storage folders — can't map photos to plants. Rejected.

## 5. User flows
### 5.1 Plant detail
```
[hero = the plant's main photo = its newest photo]
Moth orchid
Phalaenopsis · Living room
Timeline                                        See all ›
 [18 Nov] [02 Nov •] [15 Oct] [01 Oct •] …     (• = had a health check; newest first; horizontal)
 [Add a photo]
Health card · About card (unchanged)
```
- Implementation note (2026-11-18, for owner confirmation): the main photo is the newest photo *added*
  (add flow, Add a photo, or promotion after a delete). Photos taken for a health check from the Health
  screen join the timeline but don't replace the hero, so a problem-spot close-up never becomes it.
- Strip: horizontal `FlatList` of 72 pt thumbnails (radius token) with a short date under each; a small
  status dot (status token) on photos with a health result. Tap → viewer at that photo; "See all ›" →
  viewer at the newest. Empty (no photos) → strip hidden, only "Add a photo".
- Loading: skeleton thumbnails in `LoadingGroup`; signed URLs for the visible page in one call; `expo-image`
  `cacheKey` = path. Paged 20.

### 5.2 Add a photo (free)
"Add a photo" → camera / library (same picker and permissions as the add flow) → photo prepared + uploaded
(re-encoded, no GPS) → it becomes the plant's main photo and the newest timeline entry → a small success
line ("Added to the timeline.") with **Check its health** (1 credit, uses this photo) / **Not now**.
Check goes through the existing health flow with this photo (no second capture).

### 5.3 Viewer (`plant/[id]/photos`)
Full-screen, horizontal paging through the plant's photos (newest first), starting at the tapped one.
Under each photo: date ("18 Nov 2026"), and if it had a health check the status line + note (+ advice).
Actions (bottom): **What is it?** and **Delete photo**.
- **What is it?** → identify with this one photo (1 credit) → the existing suggestions list → tapping one
  sets the plant's type (and links that identify scan to the plant). Same limit/failure copy as the add flow.
- **Delete photo** → inline confirmation "Delete this photo? This can't be undone." → removes the stored
  file and the entry; if it was the main photo, the next newest becomes the main photo (none → pot drawing).
  Deleting a health-check photo keeps the check's result (latest health on detail still works).
- Close (top) returns to detail. Reduce Motion: no paging animation beyond the platform's.

### 5.4 Edit plant
Photo controls are removed from Edit (photos are managed on the timeline, so nothing is replaced silently).
Edit keeps name, type, room, delete plant.

## 6. Data and security
- **`plant_photos`**: `id uuid pk`, `user_id uuid not null default auth.uid() → auth.users on delete cascade`,
  `plant_id uuid not null → plants on delete cascade`, `path text not null` with check
  `path ~ ('^' || user_id::text || '/[0-9a-f-]{36}\.jpg$')`, `taken_at timestamptz not null default now()`,
  `scan_id uuid null → scans on delete set null`, `unique (plant_id, path)`, index `(plant_id, taken_at desc)`.
- **RLS:** owner-only select / insert / delete; insert `with check` that `plant_id` is the caller's plant
  and `scan_id` (if set) is the caller's scan; no update by users (column grants: insert of plant_id, path,
  taken_at only — not scan_id, user_id). pgTAP incl. cross-user for every operation.
- **Main photo:** `plants.photo_path` stays (the hero/list use it). A trigger on `plants` insert/update of
  `photo_path` inserts the matching `plant_photos` row (`on conflict do nothing`), so "Add a photo" is one
  update of `photo_path` and the add flow needs no change.
- **Health checks:** `check-health` additionally upserts a `plant_photos` row per checked photo with
  `scan_id` (service role; on conflict set scan_id). The function stays the only writer of `scan_id`.
- **Backfill (migration):** rows from `plants.photo_path` (taken_at = plant created_at) and from scans with
  `plant_id` set (each photo path, taken_at = scan created_at, scan_id for health scans), one row per
  path (earliest health scan wins); an existing row only gains a scan_id it lacks (implementation, 2026-11-18).
- **Deleting a plant:** rows cascade; `deletePlant` also gathers `plant_photos` paths so every stored object
  goes (§8a.8). The e2e "no objects remain" proof is extended to cover timeline photos.
- Storage, limits (20 Plant.id/day), signed URLs (1 h) unchanged.

## 7. Testing
pgTAP: table, RLS, column grants, cross-user, path check, trigger, backfill. Functions: check-health upserts
rows with scan_id. App: strip (empty, loading, dots, paging), add a photo (success + offer, check uses that
photo), viewer (start index, date/health, delete incl. main-photo fallback, What is it? sets type), Edit has no
photo controls, deletePlant gathers timeline paths. e2e: delete proof covers timeline photos. Screenshots
light/dark; owner phone check.

## 8. Left to the builder
Component boundaries, exact thumbnail/date formatting within tokens, how the viewer pages (FlatList
`pagingEnabled`), copy polish within the tone above.
