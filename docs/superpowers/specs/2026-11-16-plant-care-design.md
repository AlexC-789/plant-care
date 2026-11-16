# Plant Care System — Software Design

Date: 2026-11-16
Status: Approved 2026-11-16
Working name: "Plant Care" (product name TBD)
Hardware reference: [Saucer & Stake Design v1](../../hardware/2026-11-16-saucer-and-stake-v1.md)

## 1. Intent

A connected self-watering product made of two parts:

- **The device** ("saucer & stake"): a Ø200 mm saucer under the pot holding a
  ~705 ml tank, a pump and the electronics, plus a plant-label-shaped stake in
  the soil with the moisture probe and drip outlet. It waters the plant
  automatically. Battery powered (LiPo, USB-C charging), ESP32-C3, Wi-Fi.
- **The app** (iOS + Android): a user signs in, scans a plant with the camera to
  identify its species and health, and keeps a library of their plants, each
  showing its status and the water left in its tank. The system combines
  the plant's type and health with the device's sensor data to build a
  watering plan, which the device carries out.

The business model is a subscription. The owner is building the app, backend,
and the hardware/firmware themselves, solo. This document covers the software
(app, backend, device firmware behaviour, simulator). Mechanical/electrical
design lives in the hardware document.

## 2. Goals, non-goals, anti-goals

### Goals for v1 (owner's own testing)
- The owner can install the app on their own phone, sign in, scan plants, see
  plants in a library, and see status, estimated water left, and battery per
  device.
- Status is visible **from anywhere**, not only on the home network.
- Watering plans are generated from species + health + sensor data and are
  executed by the device (simulated at first, then the real prototype).
- The app and backend are developed and fully usable against a **simulated
  device** before the hardware works.
- The architecture leaves a clean path to store release and paid subscriptions
  without a rewrite.

### Later (designed for, not built in v1)
- App Store and Google Play release.
- Paid subscriptions (via RevenueCat).
- Production hardening: privacy policy, account deletion (store requirement),
  monitoring, rate limits.
- Over-the-air firmware updates (flash layout prepared in v1, see 5.7).

### Non-goals for v1
- Real billing or a paywall.
- Sharing plants/devices between multiple users or households.
- Bluetooth for status or control (rejected: status must work away from home).
- Fast remote commands. The device sleeps between syncs, so a command takes
  effect at the next sync (up to the sync interval, ~1 hour by default).
- Training our own plant-recognition model.
- Offline-first app. The app needs connectivity to show data.

### Anti-goals (failure even if it "works")
- **The plant dies because the cloud or Wi-Fi is down.** The device keeps
  watering using its last plan and local sensors.
- **Over-watering or flooding.** Firmware hard limits always win over any plan.
- **Running the pump dry.** The device never pumps when the float switch says low.
- **Draining the battery so the plant goes unwatered.** Power use is designed
  for weeks between charges, and low battery is warned about early.
- **Secrets in the app.** The plant-recognition API key and service keys never
  ship in the mobile app.
- **One user seeing another user's plants or devices.**

## 3. Constraints

- Solo developer; keep the number of moving parts and services small.
- Both iOS and Android from one codebase.
- Hardware (from the hardware doc): ESP32-C3 SuperMini, LiPo 103450 with
  TP4056-type USB-C charger, peristaltic pump via logic-level MOSFET,
  capacitive soil probe v1.2 (GPIO-powered only while reading), reed float
  switch tripping at ~100 ml left, tank ~705 ml.
- **Water level is estimated, not continuously measured**: water left = full
  volume − pumped volume since last refill; the float switch only says
  "low (≤ ~100 ml)" or "not low".
- Hardware prototype is not functioning yet; app work must not wait on it.
- Plant identification relies on a third-party API (cost per call).
- Device talks to the cloud over the user's home 2.4 GHz Wi-Fi.

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Expo (React Native, TypeScript) + Supabase** | One codebase; quick on-phone testing; EAS handles store builds. Supabase gives auth, Postgres, storage, server functions in one place; relational data fits plants/devices/readings history; not locked in (plain Postgres). | **Chosen** by the owner. |
| B. Flutter + Firebase | Equally capable UI; Firestore document model is awkward for time-series readings and relational queries; Dart ecosystem smaller. | Rejected. |
| C. Native Swift + Kotlin | Best platform fit, but two apps for a solo builder. | Rejected. |

Device ↔ cloud transport: **HTTPS, device-initiated** (the device wakes,
syncs, sleeps) chosen over MQTT. A battery device that deep-sleeps can't hold
a persistent connection anyway, and HTTPS is simplest on the ESP32 and with
Supabase.

## 5. Architecture

```
 ┌──────────────┐  HTTPS (user JWT)  ┌───────────────────────────────┐
 │ Mobile app   │ ─────────────────▶ │ Supabase (hosted)             │
 │ Expo / RN    │ ◀───────────────── │  • Auth (email + Apple/Google)│
 └──────────────┘   realtime/REST    │  • Postgres (+ RLS)           │
                                     │  • Storage (plant photos)     │
 ┌──────────────┐  HTTPS (device key)│  • Edge Functions:            │
 │ Device       │ ─────────────────▶ │     device-claim, device-sync │
 │ ESP32-C3 fw  │ ◀── plan ───────── │     scan-plant ──▶ Plant.id   │
 └──────────────┘                    │     plan-generator            │
 ┌──────────────┐  same protocol     │  • Scheduled jobs (alerts)    │
 │ Simulator    │ ─────────────────▶ └───────────────────────────────┘
 │ (Node script)│
 └──────────────┘
```

### 5.1 Mobile app (Expo, TypeScript)
- Expo Router for navigation; Supabase JS client for auth and data.
- Supabase Realtime (or refresh on focus) so status updates without manual
  reload.
- Camera via `expo-camera` / `expo-image-picker`.
- Push notifications via Expo Notifications.
- Development on the owner's phone with an Expo development build.

### 5.2 Backend (Supabase)
- **Auth:** email/password for v1 testing. Sign in with Apple and Google added
  before store release (Apple requires Sign in with Apple if other social
  logins are offered).
- **Row Level Security** on every user-owned table: users can read/write only
  rows they own.
- **Edge Functions** hold all secrets (Plant.id key, service role key).
- **Local development:** Supabase CLI runs the backend locally in Docker;
  schema lives in versioned SQL migrations in the repo.
- **Hosted project:** a hosted Supabase project (free tier) is used from
  milestone 4 onward so the phone and devices reach it from anywhere; the same
  migrations deploy to it.

### 5.3 Plant recognition (Plant.id by Kindwise)
- The `scan-plant` function receives a photo (uploaded to Storage by the app),
  calls Plant.id identification + health assessment, stores the result, and
  returns: top species suggestions with confidence, common names, care details
  the API provides, health status and any detected issues with descriptions.
- If top confidence is low, the app shows the suggestions and lets the user
  pick or retake. The user can always correct the species manually.
- Species info is cached in a `species` table so facts/details don't require
  repeat API calls.

### 5.4 Device duty cycle (battery)
- **Wake every 15 min** (default): power the soil probe from a GPIO, read
  moisture, battery voltage and float switch; decide whether to water (5.6);
  store the reading in RTC memory; deep-sleep. No Wi-Fi.
- **Sync every 60 min** (default, server-adjustable): connect Wi-Fi, upload
  buffered readings and events, receive plan/config/commands, sleep.
- **Sync immediately** on important events: float switch went low, refill
  detected, fault flagged, battery below the low threshold.
- Buffer holds at least 24 h of readings so a Wi-Fi outage loses nothing.
- Numbers are defaults to tune against measured battery life on the prototype.

### 5.5 Device protocol (shared by simulator and real firmware)

`POST /functions/v1/device-sync`, authenticated with
`Authorization: Bearer <device secret>` (secret issued at pairing; server
stores only its hash).

Request (device → cloud):
```json
{
  "firmware_version": "0.1.0",
  "readings": [
    { "ts": "2026-11-16T21:00:00Z",
      "soil_raw": 1830, "soil_pct": 41.2,
      "float_low": false, "water_left_ml_est": 512,
      "battery_mv": 3920, "charging": false }
  ],
  "events": [
    { "ts": "2026-11-16T20:45:00Z", "type": "watered", "ml": 40, "runtime_ms": 13200 },
    { "ts": "2026-11-16T20:10:00Z", "type": "refill_detected" },
    { "ts": "2026-11-16T19:00:00Z", "type": "fault", "code": "no_moisture_rise" }
  ]
}
```
Event types: `watered`, `refill_detected`, `tank_low`, `fault`
(`no_moisture_rise`, `sensor_out_of_range`), `battery_low`, `boot`.

Response (cloud → device):
```json
{
  "plan": { "version": 7, "moisture_min_pct": 35, "moisture_max_pct": 55,
            "dose_ml": 30, "max_ml_per_day": 120, "min_minutes_between_doses": 60 },
  "config": { "read_interval_s": 900, "sync_interval_s": 3600,
              "soil_air_raw": 2900, "soil_wet_raw": 1200,
              "pump_ml_per_s": 3.0, "tank_full_ml": 705 },
  "commands": [ { "id": "c1", "type": "set_water_left", "ml": 705 } ]
}
```
- `readings`/`events` are arrays so an offline device uploads its buffer.
- Device acknowledges commands by id on the next sync.

### 5.6 Watering logic and safety (firmware; simulator mirrors it exactly)
The plan is a **moisture band plus caps**, not a clock schedule:
- If `soil_pct < moisture_min_pct`, float not low, and caps allow: run the pump
  for `dose_ml / (pump_ml_per_s × voltage_correction)` seconds.
- Wait at least `min_minutes_between_doses` before another dose so the water
  soaks in.
- Soil % is computed from the per-pot calibration span
  (`soil_air_raw` → 0 %, `soil_wet_raw` → 100 %).

**Hard limits compiled into firmware (a plan can't exceed them):**
- Dose ≤ 40 ml; ≤ 150 ml per rolling 24 h.
- Never pump while the float switch reads low.
- After 2 doses with no moisture rise: stop watering, raise
  `fault: no_moisture_rise` (stake out of soil, tube kinked/blocked, pump
  failure), and wait for the user to clear it in the app.
- No plan ever received → conservative built-in default plan.
- No sync for a long time → keep the last plan.

**Water-left estimate:** `water_left = tank_full_ml − Σ pumped since last
refill`. Reset to full when the float switch goes low → not low (refill
detected). Because a partial top-up while not low isn't detectable, the app
offers **"I refilled it"**, which sends `set_water_left` (full by default).
The app always labels the level as an estimate ("≈ 510 ml") and shows the
float switch's "low" state as authoritative.

### 5.7 Remote commands and firmware updates
- v1 commands: `unpair` (wipe secret + Wi-Fi, return to setup mode),
  `set_water_left`, `clear_fault`, `recalibrate_soil`. All apply at next sync.
- "Water now" deferred.
- Over-the-air firmware updates not built in v1, but the firmware uses an
  OTA-capable partition layout from day one.

### 5.8 Device setup: pairing + calibration
1. In the app, "Add device". The backend creates a one-time **claim code**.
2. Unconfigured device (or long-press of a setup button) opens its own Wi-Fi
   hotspot (SoftAP).
3. User joins that hotspot; the app sends home Wi-Fi credentials + claim code.
4. Device joins home Wi-Fi, calls `device-claim`, receives `device_id` and secret.
5. App asks which plant it's for.
6. **Soil calibration** (guided in the app, per pot):
   a. "Hold the stake in the air" → app requests an air reading.
   b. "Push the stake into the soil and water the plant thoroughly by hand" →
      after a few minutes, app requests the wet reading.
   During setup the device stays awake and syncs every ~10 s so this is quick.
7. **Pump rate**: default `pump_ml_per_s` from the pump's spec; optional
   "calibrate pump" step (run 20 s into a measuring cup, enter ml).
8. "Fill the tank" → water left set to full.

Fallback for app UX: if joining the device hotspot proves painful on iOS, the
alternative is Espressif's BLE provisioning used **for setup only** (status
stays over Wi-Fi/cloud). Decide during milestone 7.

The simulator skips 2–3 (run with a claim code) and fakes calibration readings.

### 5.9 Device simulator
A Node/TypeScript program that behaves like a device: claims itself, wakes and
syncs on the same schedule (accelerated time supported, e.g. 1 h = 10 s),
models soil drying and wetting, tank draining, battery discharge/charging and
the float switch, and runs **the same watering logic as 5.6** (shared module
the firmware port follows). Scenarios via flags: `drought`, `tank-empty`,
`refill`, `partial-topup`, `offline-6h`, `stake-out-of-soil`, `battery-low`.
Several virtual devices at once. Physical parameters (tank size, pump rate,
float trip point) are configurable so they match the real hardware.

### 5.10 Watering plan generator
Pure, unit-tested function in the backend. Inputs:
- species care profile → moisture category (dry / moderate / moist);
- latest health assessment (over-watering / root-rot signs → drier;
  dehydration signs → wetter, within limits);
- recent sensor history (how fast moisture drops, temperature if available);
- user's watering preference (drier / default / wetter).

Output: a new plan version (always within firmware limits) plus a plain-
language explanation shown in the app ("Pothos likes moderate moisture; last
scan looked healthy; you chose 'default'"). v1 is rules-based.

## 6. Data model (Postgres)

| Table | Key columns |
|---|---|
| `profiles` | user_id, display_name, units, notification prefs, quiet hours, `subscription_status` (v1: manual) |
| `plants` | id, user_id, nickname, species_id, photo_path, room, watering_preference, low_water_alert_ml, created_at, archived |
| `species` | id, scientific_name, common_names, care profile (moisture category, light, etc.), description, source payload |
| `scans` | id, user_id, plant_id (nullable until assigned), photo_path, suggestions json, health json, created_at |
| `devices` | id, user_id, plant_id, name, secret_hash, firmware_version, last_seen_at, soil_air_raw, soil_wet_raw, pump_ml_per_s, tank_full_ml, fault_code, claim fields |
| `readings` | device_id, ts, soil_raw, soil_pct, float_low, water_left_ml_est, battery_mv, charging |
| `device_events` | device_id, ts, type, ml, code, payload |
| `device_commands` | id, device_id, type, payload, created_at, acked_at |
| `watering_plans` | id, device_id, version, parameters, explanation, created_at, active |
| `care_reminders` | id, plant_id, kind (fertilize / rotate / repot / custom), interval_days, next_due |

One device waters one plant; a plant has at most one device. A plant can exist
without a device (scanned/tracked only).

## 7. App screens (v1)

1. **Sign in / sign up.**
2. **Library (home):** the user's plants. Each card: photo, nickname, species,
   health badge, moisture status, water-left bar ("≈ 510 ml · ~9 days"),
   battery icon when low, warning badge for faults or offline.
3. **Plant detail:** photo, health summary from latest scan, current moisture,
   water left + "days of water left" (from recent use), "I refilled it"
   button, battery, 7/30-day moisture chart with watering marks, current plan
   with its explanation, **Facts & details** (species info), care reminders,
   photo timeline from past scans, rescan button, personalization.
4. **Scan flow:** camera → upload → results (species suggestions, health) →
   "Add as new plant" or "Update existing plant".
5. **Add device:** pairing + calibration (5.8) → pick plant.
6. **Device settings:** name, recalibrate soil, calibrate pump, clear fault,
   remove device.
7. **Settings:** profile, units, notifications, quiet hours, subscription
   status (placeholder), sign out, delete account.

**Notifications (v1):** tank low (float switch) and "water runs out in ~2
days" forecast; battery low (default < 20 %); device offline (3 missed syncs);
fault (`no_moisture_rise`: "check the stake is in the soil and the tube
isn't kinked"); new health issue on rescan; care reminders due.

## 8. Personalization (all approved by owner; ★ = added in design review)
- Nickname, photo, room for each plant.
- Watering preference per plant: drier / default / wetter.
- Notification preferences and low-water alert level.
- Units (metric / imperial).
- ★ **Away mode**: enter travel dates; the app says whether the tank will last
  and suggests topping up before leaving.
- ★ **Care reminders** for what the device can't do: fertilize, rotate for
  light, repot; suggested intervals per species, editable.
- ★ **Photo timeline**: each rescan is saved so you can see the plant grow and
  how its health changed.
- ★ **Quiet hours** for notifications.
- ★ **Light conditions per plant** (bright / medium / low), used in facts and
  later to refine the plan.

## 9. Subscription (designed for, built later)
- v1: `profiles.subscription_status` set manually; app reads it through one
  `useEntitlement()` hook so a paywall can be added in one place later.
- Store release: RevenueCat SDK in the app; RevenueCat webhook → Edge Function
  updates `subscription_status`. Which features are gated is decided then.

## 10. Quality and testing
- Test-driven development for logic: watering logic (shared with simulator),
  water-left estimate and refill detection, plan generator, device-sync
  validation, pairing/claim, RLS policies (SQL tests against local Supabase).
- App: Jest + React Native Testing Library for components and hooks.
- End-to-end: simulator scenarios against local Supabase verify the full loop
  (reading → plan → watering event → app shows it → alert fires).
- Firmware: watering-logic module unit-tested on the host (PlatformIO native
  tests) with the same cases as the simulator.
- Code review before each feature is merged; security review on auth, RLS,
  device auth and pairing.
- All code in one Git repository pushed to GitHub.

## 11. Build order (milestones)
1. **Foundation:** repo, Expo app shell, local Supabase, auth, CLAUDE.md.
2. **Library:** plants CRUD with photos; library and detail screens.
3. **Scanning:** scan-plant + Plant.id; scan flow; species facts; photo timeline.
4. **Devices (simulated):** device-claim, device-sync, simulator, live status,
   water-left estimate, battery, "I refilled it"; hosted Supabase.
5. **Watering plans:** plan generator, plan display, watering preference.
6. **Alerts & reminders:** push notifications, care reminders, away mode.
7. **Firmware:** ESP32-C3 firmware with the same protocol, duty cycle, watering
   logic and safety limits; pairing + calibration on the real prototype.
8. **Store readiness (later):** social sign-in, RevenueCat, privacy policy,
   account deletion, EAS builds, TestFlight / Play internal testing.

## 12. Decided vs. left to the builder

**Decided:** Expo + Supabase; Plant.id; Wi-Fi + device-initiated HTTPS; battery
duty cycle with buffered readings; moisture-band plan with firmware hard limits
from the hardware doc; estimated water level with float-switch reset and "I
refilled it"; per-pot soil calibration in the app; simulator-first; local
testing first, stores later; RevenueCat later.

**Builder's calls (marked, owner can override):** 15 min read / 60 min sync
defaults; offline = 3 missed syncs; SoftAP provisioning with BLE-setup
fallback; v1 command set; OTA layout without OTA feature; hosted Supabase from
milestone 4.

**Left to the builder:** chart/UI libraries, styling, folder structure, exact
plan-generator rules (within 5.6/5.10), simulator internals, firmware framework
(Arduino vs ESP-IDF via PlatformIO), hosting region.
