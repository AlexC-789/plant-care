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

## Later milestones (P3; product spec §11, in order)

- **M4 Devices (simulated):** device-claim, device-sync, simulator, live status, water-left
  estimate, battery, "I refilled it"; hosted Supabase (README "Hosted project" steps). Depends on M3.
- **M5 Watering plans:** generator, plan display, watering preference; inside safety limits.
- **M6 Alerts & reminders:** push notifications, care reminders, away mode.
- **M7 Firmware:** ESP32-C3, same protocol and safety limits; pairing + calibration.
- **M7b Guided scan:** needs Apple Developer account + EAS dev build.
- **M8 Store readiness:** social sign-in, RevenueCat, privacy policy, account deletion, EAS builds.

## Housekeeping (P2, any time)

- Owner decisions in `docs/CURRENT_STATE.md` → "Open decisions".
- Device checks owed from M2 (handoff §2.4).
- Known minors: fix only when touching that code, test first.
