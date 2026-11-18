# Milestone 3 — Photo Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every photo of a plant is kept on a timeline (strip on detail + full-screen swipe viewer); adding a photo is free; health check and "What is it?" run only on request.

**Architecture:** New owner-only table `plant_photos` (one row per photo) fed by a trigger on `plants.photo_path`, by `check-health` (with `scan_id`), and by a one-time backfill. The app reads it through TanStack Query; adding a photo = upload + update `photo_path`; the viewer is a paging `FlatList`.

**Tech Stack:** Supabase (Postgres, RLS, pgTAP, Deno Edge Functions), Expo SDK 58 + Expo Router, TanStack Query 5, expo-image, jest-expo + RNTL, Playwright (e2e script).

**Spec:** `docs/superpowers/specs/2026-11-18-m3-photo-timeline-design.md` (approved). Still binding: M2 design §6/§8a, `CLAUDE.md`.

## Global Constraints
- All of `CLAUDE.md` (TDD, tokens only, loading rules, TanStack Query, BottomBar for primary actions, Ponytail, migrations only + `npm run db:types`, RLS + pgTAP cross-user for every user table, column grants for server-controlled columns, zero npm deps in functions).
- `plant_photos`: `id uuid pk`, `user_id uuid not null default auth.uid() → auth.users on delete cascade`, `plant_id uuid not null → plants on delete cascade`, `path text not null` check `path ~ ('^' || user_id::text || '/[0-9a-f-]{36}\.jpg$')`, `taken_at timestamptz not null default now()`, `scan_id uuid null → scans on delete set null`, `unique (plant_id, path)`, index `(plant_id, taken_at desc)`.
- Users: select / insert / delete own rows only; insert grant on `plant_id, path, taken_at` only (never `user_id`, `scan_id`); no update; insert `with check` plant is the caller's.
- Main photo = `plants.photo_path` = newest; deleting the main photo promotes the next newest (none → null → pot drawing).
- Adding a photo is free; Plant.id only on an explicit tap (health 1 credit; What is it? 1 credit); 20/day limit unchanged.
- Copy (verbatim): "Timeline", "See all", "Add a photo", "Added to the timeline.", "Check its health", "Not now", "What is it?", "Delete photo", "Delete this photo? This can't be undone.", "Delete", "Cancel". Dates: `toLocaleDateString` (no library).
- Page size 20, newest first; signed URLs 1 h in one call per page; `expo-image` `cacheKey` = path.

## Review Focus
1. Deleting the main (or only) photo → plant shows the next newest (or the pot drawing); `plants.photo_path` never points at a deleted object. (Task 3)
2. Another user's plant id / path in an insert, or reading/deleting another user's rows → denied. (Task 1)
3. Double tap on "Add a photo" confirm / "Check its health" → one photo / one credit. (Task 4)
4. A plant with more than 20 photos → strip and viewer page in more; opening the viewer on a photo past the first page works. (Tasks 4, 5)
5. Health check from "Add a photo" at the daily limit → limit copy shown, the photo stays on the timeline. (Task 4)

---

### Task 1: `plant_photos` table, rules, trigger, backfill

**Files:** Create `supabase/migrations/20261118100000_plant_photos.sql`, `supabase/tests/database/plant_photos.test.sql`; regenerate `apps/mobile/src/lib/database.types.ts`.

**Interfaces — Produces:** table per Global Constraints; trigger `plants_photo_to_timeline` (security definer, `set search_path = ''`) on `plants` after insert or update of `photo_path` when new path is not null → `insert into public.plant_photos (user_id, plant_id, path) … on conflict do nothing`; backfill rows from `plants.photo_path` (taken_at = `plants.created_at`) and from `scans` with `plant_id` set (each of `photo_paths`, taken_at = `scans.created_at`, `scan_id` = scan id when `kind = 'health'`), `on conflict do nothing`.

- [ ] **Step 1: Failing pgTAP** (`plant_photos.test.sql`): RLS on; A sees only own rows; A inserts a row for own plant (path under A/); A cannot insert for B's plant, with a path under B/, or set `scan_id`/`user_id` (42501); A cannot update; A deletes own row, cannot delete B's (0 rows); anon sees nothing; updating `plants.photo_path` inserts the row once (second update to the same path no duplicate); deleting a plant cascades its rows; backfill: a plant + a linked health scan seeded before the migration's backfill statement produce rows with the right `taken_at` and `scan_id` (seed then call the backfill as a function or re-run the insert-select in the test).
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Write the migration (follow `20261117100000_plants.sql` style: revoke all then column grants, `(select auth.uid())` in policies).
- [ ] **Step 4:** `npm run db:reset && npm run db:test` → PASS; `npm run db:types`.
- [ ] **Step 5:** Commit `feat(db): plant photo timeline table`.

### Task 2: `check-health` records its photos on the timeline

**Files:** Modify `supabase/functions/check-health/index.ts`; test `supabase/functions/check-health/index_test.ts`.

**Interfaces — Consumes:** `rest(deps, path, init)` from `_shared/db.ts`. **Produces:** after a successful (`ok`/`not_plant`) scan insert, one upsert `POST /rest/v1/plant_photos?on_conflict=plant_id,path` with `Prefer: resolution=merge-duplicates` of `{ user_id, plant_id, path, scan_id }` per checked path; HTTP response unchanged; error scans write no rows.

- [ ] **Step 1: Failing Deno tests:** ok check → upsert called with both paths and the new scan id; error (502) → no upsert; response keys unchanged.
- [ ] **Step 2:** `npm run fn:test` → FAIL.
- [ ] **Step 3:** Implement (one `rest` call; a failure of the upsert must not fail the check — log outcome only).
- [ ] **Step 4:** `npm run fn:test` → PASS.
- [ ] **Step 5:** Commit `feat(fn): health checks join the photo timeline`.

### Task 3: App data layer for the timeline

**Files:** Modify `apps/mobile/src/plants/api.ts`, `apps/mobile/src/plants/queries.ts`; test `apps/mobile/src/plants/__tests__/queries.test.tsx` (extend).

**Interfaces — Produces:**
- `type PlantPhoto = { id: string; path: string; taken_at: string; scan_id: string | null; health: HealthResult | null }` (health from the linked scan: select `id, path, taken_at, scan_id, scans(health)`).
- `fetchPlantPhotos(plantId: string, page: number): Promise<{ photos: PlantPhoto[]; photoUrls: Record<string, string> }>` (20/page, `taken_at desc, id desc`, signed in one call).
- `addPlantPhoto(plantId: string, photo: PreparedPhoto): Promise<string /* path */>` = `uploadPhoto` then update `plants.photo_path` (trigger adds the row).
- `deletePlantPhoto(plantId: string, photo: { id: string; path: string }): Promise<void>`: delete the row; if it was `plants.photo_path`, set `photo_path` to the next newest remaining path (or null); then `deletePhotos([path])` (shortcut-comment orphan on failure).
- `deletePlant` also gathers `plant_photos` paths (dedupe with plant + scan paths).
- Hooks: `usePlantPhotos(plantId)` infinite, key `['plant-photos', plantId]`; `useAddPlantPhoto()`, `useDeletePlantPhoto()` — on success invalidate `['plant-photos', plantId]`, `['plant', plantId]`, `['plants', userId]`.

- [ ] **Step 1: Failing tests:** fetch shape/order/range and one signing call; add = upload then `photo_path` update; delete non-main → row then object, no plant update; delete main → `photo_path` set to next newest; delete only photo → `photo_path` null; object deleted only after the row (Review Focus 1); deletePlant includes timeline paths.
- [ ] **Step 2:** `npx jest src/plants/__tests__/queries.test.tsx` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS; `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(mobile): timeline data layer`.

### Task 4: Timeline strip, Add a photo, Edit without photo controls

**Files:** Create `apps/mobile/src/plants/TimelineStrip.tsx`; modify `apps/mobile/src/app/(app)/plant/[id]/index.tsx`, `apps/mobile/src/app/(app)/plant/[id]/edit.tsx`; tests `apps/mobile/src/plants/__tests__/PlantDetail.test.tsx`, `EditPlant.test.tsx`.

**Interfaces — Consumes:** Task 3 hooks; `useCheckHealth` (`{ plantId, photoPaths }`), `useHealthCheckStatus`; `preparePhoto`; image picker as in `CaptureCards` (reuse its permission + picker handling — extract the smallest shared helper if needed, no duplication). **Produces:** route push `/plant/{id}/photos?start={index}` (Task 5 builds it; temporary `as Href` + shortcut).

- [ ] **Step 1: Failing tests:** strip hidden with no photos (only "Add a photo"); thumbnails newest first with date and a status dot when `health` exists; "See all" → viewer start 0; tap 3rd → start 2; loads next page at end; "Add a photo" → take/choose → "Added to the timeline." + "Check its health" / "Not now"; Check calls `checkHealth(plantId, [newPath])` once even on double tap (Review Focus 3), detail HealthCard shows "Looking at your plant…"; limit error shows the limit copy and the photo stays (Review Focus 5); Edit has no photo controls (no "Take photo"/"Remove photo").
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implement (horizontal `FlatList`, 72 pt thumbnails, `LoadingGroup` skeletons, `expo-image` cacheKey path; remove Edit's photo section and its unsaved-upload cleanup).
- [ ] **Step 4:** → PASS (`npm test` --forceExit ok, typecheck, lint).
- [ ] **Step 5:** Commit `feat(mobile): timeline strip and add a photo`.

### Task 5: Photo viewer

**Files:** Create `apps/mobile/src/app/(app)/plant/[id]/photos.tsx`; register in `apps/mobile/src/app/(app)/_layout.tsx` (full-screen modal, Close); test `apps/mobile/src/plants/__tests__/PhotoViewer.test.tsx`.

**Interfaces — Consumes:** `usePlantPhotos`, `useDeletePlantPhoto`, `useIdentify`, `Suggestions`, `useUpdatePlant`, scan link (`scans.plant_id` update as in `api.createPlant`), `HealthResult` status/note pieces (reuse, don't duplicate).

- [ ] **Step 1: Failing tests:** opens at `start` (incl. an index on page 2 — fetches pages until reached; Review Focus 4); shows date and, for a checked photo, status + note (+ advice); swipe changes the shown date; "Delete photo" → confirm copy → `deletePlantPhoto`; deleting the last photo closes the viewer; "What is it?" → identify with `[path]` → suggestions → tap sets the plant type (`updatePlant species_id`) and links the scan; failure/limit copy as in the add flow.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implement (`FlatList horizontal pagingEnabled`, `getItemLayout` width = window width, `initialScrollIndex`), remove the Task 4 `as Href` cast.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(mobile): photo viewer`.

### Task 6: e2e, docs, verification

**Files:** Modify `apps/mobile/e2e/m2-security.mjs` (delete proof also seeds/creates a timeline photo and asserts no objects remain), `CLAUDE.md` (one line: timeline = `plant_photos`, owner-only, fed by trigger on `plants.photo_path`, `check-health`, backfill; photos managed on the timeline, not in Edit).

- [ ] **Step 1:** Extend the e2e delete proof; run it (web app :8081 + local Supabase) → all PASS.
- [ ] **Step 2:** `npm test` (--forceExit ok), `npm run typecheck`, `npm run lint`, `npm run db:test`, `npm run fn:test` → all pass.
- [ ] **Step 3:** Web screenshots (phone size, light + dark): detail with strip, add-a-photo success + offer, viewer (plain photo and checked photo), delete confirm → `/tmp/claude-0/-home-user-plant-care/06e2532b-fe64-530e-8207-bfb9aa93d5e3/scratchpad/m3-screens/`; look at them and fix anything broken.
- [ ] **Step 4:** Commit `test(e2e): timeline photos are removed with their plant; docs`.
