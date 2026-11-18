# Milestone 2 — Plant Library and Identification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners add plants (guided photos → Plant.id identification), browse them on Plants, open detail with facts from our own houseplant database, check health on demand, edit and delete — with the security requirements of spec §8a.

**Architecture:** Postgres tables `species` (curated seed + Plant.id-origin), `plants`, `scans` with RLS; private storage bucket `plant-photos`. Three Deno Edge Functions (`identify-plant`, `check-health`, `search-plants`) share a `_shared/` module for auth, validation, limits, errors and the Plant.id client (injected `fetch`). The app uses TanStack Query for data, `expo-image-picker` / `expo-image-manipulator` for capture and resizing, `expo-image` for display.

**Tech Stack:** Supabase (Postgres, Storage, Edge Functions/Deno 2), pgTAP, Expo SDK 58 + Expo Router, TanStack Query 5, expo-image-picker, expo-image-manipulator, expo-image, jest-expo, Deno test.

**Spec:** `docs/superpowers/specs/2026-11-17-m2-plant-library-design.md` (with `2026-11-17-app-ui-design.md`, `2026-11-17-loading-rules-design.md`).

## Global Constraints
- All of `CLAUDE.md` (TDD, tokens only, loading rules, TanStack Query, no secrets in the app, Edge Functions zero runtime npm deps, migrations only).
- Copy is verbatim from the spec (§5) — e.g. `Which plant is this for?`, `Is it one of these?`, `None of these, search instead`, `Looking at your photo…`, `Couldn't tell from this photo. Try one with a whole leaf in view, or search.`, `You've reached the identification limit for now. Search for the plant type, or try again later.`, `Setup isn't finished · Add its module`, `Check its health`, `Delete {name}? Its photos are deleted too. This can't be undone.`
- Confidence words: ≥ 0.7 `Very likely`, ≥ 0.35 `Likely`, else `Possibly`; drop < 0.05; `isPlant` false when is_plant < 0.5. Never show percentages.
- Limits: 20 Plant.id calls (identify + health, statuses `ok`/`not_plant`) per user per rolling 24 h; search 120 per user per hour; Plant.id timeout 20 s; body ≤ 10 KB.
- Storage: bucket `plant-photos`, private, `file_size_limit` 3 MB, `allowed_mime_types` `["image/jpeg"]`, object path `{user_id}/{uuid}.jpg` matching `^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$`.
- Photos: longest side 1600 px, JPEG quality 0.7, re-encoded (EXIF dropped).
- Page size 20, newest first; signed URLs 1 h; `expo-image` `cacheKey` = storage path.
- `PLANT_ID_API_KEY` read only inside functions; `supabase/functions/.env` is git-ignored.

## Review Focus
1. **Uploaded photo still carrying EXIF GPS** (camera roll photo) → none in the stored JPEG. (Task 8)
2. **User passes another user's photo path or plant id to a function** → 403, nothing read, no credit spent. (Tasks 5–6)
3. **Plant deleted while it has scans** → all its storage objects gone (plant + scan photos). (Task 12)
4. **App killed between upload and Continue** → no crash on next open; orphans accepted (spec) but never shown. (Task 10)
5. **Very long names / emoji / RTL text in Name and Room** → stored within limits (name 1–60, room ≤ 40), rows wrap, no layout break. (Tasks 1, 9)

---

### Task 1: Tables, RLS and scan linking
**Files:** `supabase/migrations/20261117100000_plants.sql`, `supabase/tests/database/plants.test.sql`; regenerate `apps/mobile/src/lib/database.types.ts`.
**Produces:** tables `species`, `plants`, `scans` exactly as spec §6 (+ `scans.kind`, `scans.status`); `pg_trgm` index on `species` names; RPC none.
- [ ] Failing pgTAP: RLS enabled on all three; user A sees only own plants/scans; A can insert/update/delete own plants, cannot touch B's (0 rows / error); users can't insert/update/delete `species` or insert `scans`; A can set `scans.plant_id` on own scan when null and only to own plant, cannot change it again, cannot set it to B's plant, cannot update other `scans` columns; name length 1–60, room ≤ 40 enforced; deleting a plant cascades its scans; anon can read nothing.
- [ ] `npm run db:test` → FAIL; write migration (column grants + policies + `with check` subquery on plant ownership); → PASS; `npm run db:types`; commit `feat(db): plants, scans and species with RLS`.

### Task 2: Photo storage bucket and policies
**Files:** `supabase/migrations/20261117100100_plant_photos_bucket.sql`, `supabase/tests/database/storage.test.sql`.
- [ ] Failing pgTAP: bucket exists, private, 3 MB, jpeg only; as A insert/select/delete under `A/…` allowed; under `B/…` denied; path not matching the UUID pattern denied; anon denied.
- [ ] Implement policies on `storage.objects` (`bucket_id = 'plant-photos' and (storage.foldername(name))[1] = auth.uid()::text and name ~ pattern`); PASS; commit `feat(db): private plant-photos bucket`.

### Task 3: Curated houseplant seed
**Files:** `supabase/migrations/20261117100200_species_seed.sql`, `supabase/tests/database/species_seed.test.sql`, `docs/species/curation.md` (method + per-reference counts).
- [ ] Failing pgTAP: ≥ 150 rows with `origin = 'curated'`; scientific names unique; each curated row has non-null `light`, `watering`, `moisture_category`, `description`, `checked_against`; `common_names` non-empty.
- [ ] Write ~150 entries (descriptions 2–3 sentences, written fresh); verify scientific names via GBIF species match API (`api.gbif.org/v1/species/match`, accepted names); check care facts against NC State Extension Plant Toolbox or RHS; record the reference in `checked_against`. List any entry that couldn't be checked in `curation.md`.
- [ ] PASS; commit `feat(db): curated houseplant species seed`.

### Task 4: Shared function module
**Files:** `supabase/functions/_shared/{http.ts,auth.ts,validate.ts,limits.ts,plantid.ts,deno.json}`, tests `supabase/functions/_shared/*_test.ts`; root `package.json` `fn:test` covers all functions.
**Produces:**
- `jsonError(status: number, message: string): Response`; `json(body: unknown, status?): Response`; `readJsonBody(req, maxBytes = 10_240): Promise<unknown>` (413 over limit, 400 invalid).
- `requireUser(req, deps): Promise<{ userId: string } | Response>` (verifies JWT via Supabase Auth `getUser`).
- `validatePhotoPaths(paths: unknown, userId: string, max: number): string[] | Response` (1..max, pattern, own prefix → 403 otherwise).
- `countRecentPlantIdCalls(db, userId): Promise<number>`; `PLANT_ID_DAILY_LIMIT = 20`; `searchAllowed(db, userId): Promise<boolean>` (120/h, counted in a `search_log` table added here via migration `…100300_search_log.sql`, service-role only, RLS on, no user access).
- `PlantIdClient` with `identify(images: string[]): Promise<IdentifyResult>`, `health(images: string[]): Promise<HealthResult>`, `nameSearch(q: string): Promise<NameHit[]>`; constructed with `{ apiKey, fetch, timeoutMs = 20000 }`; maps to `confidenceWord(p)` per Global Constraints.
- [ ] Failing Deno tests for each (body limit, path validation incl. `../`, other prefix, bad pattern; confidence mapping boundaries 0.7/0.35/0.05; timeout → `ProviderError`; requests never include the key in logs). Implement; PASS; commit `feat(fn): shared auth, validation, limits and Plant.id client`.

### Task 5: `identify-plant`
**Files:** `supabase/functions/identify-plant/{index.ts,index_test.ts,deno.json}`, `supabase/config.toml` (`verify_jwt = true`), recorded fixtures `supabase/functions/_shared/fixtures/*.json`.
**Consumes:** Task 4. **Produces:** `POST {photoPaths: string[1..3]}` → `{ scanId, isPlant, suggestions: {speciesId, commonName, scientificName, confidence}[] }`.
- [ ] Failing tests: unauthenticated 401; foreign/invalid path 403; unknown field 400; 21st counted call 429 with spec copy; error scans don't count; request sends all images, no health, details limited to free fields; not-a-plant → `isPlant:false`, `[]`, status `not_plant`; species matched by scientific name else inserted `origin='plantid'`, idempotent; provider timeout → 502 with spec copy, scan `error`; response/logs contain no key.
- [ ] Implement; PASS; commit `feat(fn): identify-plant`.

### Task 6: `check-health`
**Files:** `supabase/functions/check-health/*`, `_shared/health_notes.ts` (mapping ~15 issues → `{note, advice}`).
**Produces:** `POST {plantId, photoPaths: string[1..2]}` → `{ scanId, healthy: boolean|null, note: string, advice: string|null }`; scan `kind='health'`, `plant_id` set.
- [ ] Failing tests: plant not owned 403; limit shared with identify; healthy ≥ 0.8 → `It looks healthy in this photo.`; top issue ≥ 0.5 → mapped note; else `Couldn't tell from this photo. Try one with the leaves in view.`; timeout 502.
- [ ] Implement; PASS; commit `feat(fn): check-health`.

### Task 7: `search-plants`
**Files:** `supabase/functions/search-plants/*`.
**Produces:** `POST {query}` → `{ hits: {commonName, scientificName}[] }` (≤ 10); `POST {pick: scientificName}` → `{ speciesId }` (names-only `plantid` species, idempotent).
- [ ] Failing tests: query length 2–60 else 400; 121st call in an hour 429; hits clamped to 10; pick idempotent; no Plant.id call for pick (names only).
- [ ] Implement; PASS; commit `feat(fn): search-plants`.

### Task 8: App data layer and photo pipeline
**Files:** `apps/mobile/src/plants/{api.ts,queries.ts,photos.ts}`, tests `src/plants/__tests__/*`; `npx expo install expo-image-picker expo-image-manipulator expo-image`.
**Produces:**
- `preparePhoto(uri: string): Promise<{ uri: string; width: number; height: number }>` (≤ 1600 px, JPEG 0.7).
- `uploadPhoto(userId, prepared): Promise<string /* path */>`; `deletePhotos(paths: string[]): Promise<void>`; `signPhotoUrls(paths): Promise<Record<string,string>>`.
- Queries: `usePlants()` (infinite, 20/page, `{plants, photoUrls}` per page), `usePlant(id)`, `useSpecies(id)`, `useSpeciesSearch(q)` (local ILIKE/trigram first; `search-plants` when < 3), `useLatestHealth(plantId)`.
- Mutations: `useCreatePlant()` (`{name, room?, speciesId?, customType?, photoPath?, scanId?}` → links scan), `useUpdatePlant()`, `useDeletePlant()` (row + all photo paths of plant and scans), `useIdentify()`, `useCheckHealth()`; cache updates per spec §8.
- [ ] Failing tests: `preparePhoto` calls manipulator with `resize longest 1600` and `compress 0.7, format jpeg`; an EXIF-GPS fixture JPEG run through the real re-encode path in a Node test has no `GPS` IFD (use `exifr`-free byte scan for `0x8825`); delete gathers plant + scan photo paths; create links `scans.plant_id`; search falls back only when local < 3. Implement; PASS; commit `feat(mobile): plants data layer and photo pipeline`.

### Task 9: Plants home
**Files:** `src/app/(app)/index.tsx`, `src/plants/PlantRow.tsx`, `src/app/(app)/_layout.tsx` (`+` button), tests.
- [ ] Failing tests: skeleton rows while loading (after 300 ms); empty state copy + `Add a pot` button opens add flow; rows show name, status line; long/emoji/RTL names wrap; next page loads on end reached; error with no cache shows spec copy + `Try again`; `+` opens add flow.
- [ ] Implement with `FlatList`, `expo-image` (60 pt, radius 14, PotDrawing fallback); commit `feat(mobile): plants home`.

### Task 10: Add a pot — step 1, guided capture, identify, search
**Files:** `src/app/(app)/add/{plant.tsx,capture.tsx,search.tsx}`, `src/plants/{CaptureCards.tsx,Suggestions.tsx}`, tests.
- [ ] Failing tests: identify only after tapping `Identify`; whole-plant photo required, others skippable; suggestions show words not %; top preselected only if very likely; name prefilled only when empty; Continue saves without type/photo (name required); Cancel deletes uploaded photos; limit message; not-a-plant/failure copy; search: local results, `More plants` fallback, custom type row; permission denied row with `Open Settings`.
- [ ] Implement (full-screen cover, `Plant · 1 of 6`, Cancel top-right); commit `feat(mobile): add a pot step 1 with identification`.

### Task 11: Plant detail and Check its health
**Files:** `src/app/(app)/plant/[id].tsx`, `src/plants/{AboutPlant.tsx,HealthCard.tsx}`, `src/app/(app)/plant/health.tsx`, tests.
- [ ] Failing tests: hero photo / drawing fallback; title + `{type} · {room}`; setup banner copy; About hidden for custom type, `More` expands; health card shows latest result with date; `Check its health` → capture (whole plant required, problem spot optional) → `Check` → result; skeletons while loading.
- [ ] Implement; commit `feat(mobile): plant detail and health check`.

### Task 12: Edit and delete
**Files:** `src/app/(app)/plant/[id]/edit.tsx`, tests; pgTAP/integration check for storage cleanup.
- [ ] Failing tests: edit name/room/type saves; replace photo uploads new + deletes old; remove photo; delete asks the spec confirmation, then removes row and all photos (assert `deletePhotos` called with plant + scan paths); navigates to Plants.
- [ ] Implement; commit `feat(mobile): edit and delete plants`.

### Task 13: Docs, verification, security review
- [ ] README: Plant.id key setup (`supabase/functions/.env`), restart; CLAUDE.md: plants/scans/species rules, functions list, security rules (§8a).
- [ ] Full checks (`npm test`, `typecheck`, `lint`, `db:test`, `fn:test`); browser screenshots (Plants empty/list/loading, add flow with fixture-backed function via a local mock key, detail, edit) in light/dark.
- [ ] Run the `security-review` skill on the branch; fix Critical/Important findings test-first; commit; push.
