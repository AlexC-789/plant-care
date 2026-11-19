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
