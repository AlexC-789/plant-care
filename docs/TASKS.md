# Tasks

_Last updated: 2026-11-18._ Open work only; finished work moves to `docs/CURRENT_STATE.md`.
Requirements come from the specs (`docs/superpowers/specs/`) and plans; this list never changes
them. Priority: P1 now, P2 next, P3 later.

## Optional setup (P3, owner)

T0 local setup is done (see `docs/CURRENT_STATE.md`). Left over, only when needed:
- Playwright for the e2e security script (handoff §5.5).
- Account-wide: disconnect unused connectors at claude.ai/customize/connectors (this repo already
  blocks them locally).

## M3 — Photo timeline + rescan (merged, PR #7)

1. **Owner:** revoke the Supabase access token and reset the hosted DB password (both were in a chat).
2. Deferred minors (fix when touching that code, test first):
   - Trigger tested only as superuser (run the `photo_path` update as user A too).
   - `backfill_plant_photos()` stays a security-definer function (execute revoked from clients).
   - A photo deleted while its health check runs comes back as a row without an object (shortcut in
     `check-health`); a direct REST delete on `plant_photos` skips the RPC's lock (own data only).
   - Viewer duplicates the identify step's `COULDNT` / `LIMIT` copy (`add/identify.tsx`).
   - "What is it?" guards double taps with `isPending` only (the strip uses refs).
   - A health check that fails after the user left the Health screen leaves orphan objects (shortcut).
   - Spec §5.1 note: main photo = newest *added*; health-check photos never replace the hero (owner to confirm).

## M4 — Devices, simulated (PR open from `m4-devices`)

1. **P1, owner:** hosted deploy done 2026-11-19 (PG 17; functions answer without `apikey`). Left:
   reset the hosted DB password (it was pasted in a chat); on the phone on mobile data add a module
   to a plant and run `node sim/sim.ts --claim <code>` (hosted by default) — proves the app's claim
   (`new_claim_code()` execute) and a real sync on hosted.
2. Notes for M7 firmware: chunk uploads to ≤ 200 readings per sync if `read_interval_s` < ~430 s;
   trusted monotonic clock (a forward jump frees the daily budget); persist state before pumping;
   `battery_low` hysteresis; sync at the next wake after applying a command; tank level sensor part
   and pump worst-case rate (4.0 ml/s compiled) chosen there; add a `pump_ml_per_s > 0` CHECK when
   calibration becomes writable.
3. Recovery path to document in the app later: a claim whose 200 never reached the module → code
   used, plant shows the module "waiting" → Remove module, make a new code.
4. Deferred minors (fix when touching that code, test first): Remove-module failure is silent;
   `fetchDevice` embeds all commands each poll; TankVessel fill overhangs 2 units; code
   normalisation accepts Unicode case folds / any whitespace; `firmware_version` allows control chars;
   sim polish (stray key wakes, missing `.env.local` stack trace; sim resume/next-wake-sync changes
   tested by hand only); StatusBanner's "by about" uses `now` from mount; TankVessel has no
   `aria-hidden` on web; no test for the `['plants']` invalidation on claim; no retention or rate limit on
   readings/sync (shortcuts until store readiness). Original product spec §5.9 still lists the old
   `refill`/`partial-topup` sim scenarios (M4 spec §9 supersedes).

## Direction E redesign (`docs/design/DESIGN_ROADMAP.md` §1, on PR #10)

- [x] Phase 1 Foundation: tokens, Archivo, Text, Button, Row, StepProgress (branch `design-e-foundation`).
- [x] Phase 2 Home + plant page (branch `design-e-home`, stacked on Phase 1 and M4).
- [ ] Phase 2 leftovers (need M5 data): Last drink row, "about {n} days", Today's limit line, Watering resumed /
  Back to normal, Pause watering. Also server-side Home counts and the offline line.
- [x] Phase 3 Add flow (branch `design-e-add`, PR depends on #14).
- [ ] Phase 3 follow-ups: **owner** push `20261119120000_plants_light.sql` to hosted before the app ships; check
  on a device: in-app camera on iOS/Android, `statusBarStyle: 'light'` over the camera, permission text;
  Edit plant has no light choice yet; alternatives have no thumbnails (Plant.id images not passed through);
  the web header still shows a back arrow on Health and the module offer (native hides it).
- [ ] Phase 2 visual fixes (QA visual check 2026-11-19, 11 items; from the `plant-care-ea` session): Home loading
  skeleton shaped like PlantRow; plant page Latin name variant/colour; needs-you status sentence `headline`;
  grid tiles reserve the water line slot; plant page hairline right margin; ⋯ menu edge, rows and destructive
  confirm; empty Home "Scan a plant" in BottomBar; no-photo placeholder; TankBar left label secondary; `+` disc 44;
  frosted buttons on web (check on device first).
- [ ] Phase 4 First run (Opus security review). Phases 5–7: History, Notifications, 3D scan.
- [ ] Owner: open decision 8 (mark `2026-11-17-app-ui-design.md` superseded; CLAUDE.md still points UI to it).

## Later milestones (P3; product spec §11, in order)

- **M5 Watering plans:** generator, plan display, watering preference; inside safety limits.
- **M6 Alerts & reminders:** push notifications, care reminders, away mode.
- **M7 Firmware:** ESP32-C3, same protocol and safety limits; pairing + calibration.
- **M7b Guided scan:** needs Apple Developer account + EAS dev build.
- **M8 Store readiness:** social sign-in, RevenueCat, privacy policy, account deletion, EAS builds.

## Housekeeping (P2, any time)

- Owner decisions in `docs/CURRENT_STATE.md` → "Open decisions".
- Device checks owed from M2 (handoff §2.4).
- Known minors: fix only when touching that code, test first.
