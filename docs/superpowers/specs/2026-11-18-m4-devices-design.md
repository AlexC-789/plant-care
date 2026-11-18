# Milestone 4: devices (simulated) and the digital twin — design

Date: 2026-11-18
Status: Draft for owner review (builder check done 2026-11-18)
Builds on: [Software design](2026-11-16-plant-care-design.md) (§5.4–5.9, §6, §11 item 4),
[App UI design](2026-11-17-app-ui-design.md) (§4–6), [Hardware v1](../../hardware/2026-11-16-saucer-and-stake-v1.md).
Amends all three (see §10).

## 1. Intent

The owner can attach a module to a plant and watch its live status (soil, water left, battery,
check-ins, faults) from anywhere, before the hardware works. A simulator on the owner's PC plays
the module and speaks exactly the protocol the real firmware will (M7).

The cloud keeps a **digital twin** of each module: the module uploads raw sensor numbers; the twin
does every calculation (calibration, unit conversion, status) and sends back instructions in the
module's own units. The module is a thin executor that carries out its last instructions, including
while offline, and enforces hard safety limits compiled into it. From M5 the twin rewrites the
instructions from what it sees (soil, water level, plant health; later maybe light), so it reacts
before problems show, without the module knowing why.

## 2. Owner decisions (2026-11-18)

- **Setup in the app: minimal connect (option A).** "Add its module" shows a one-time code; the
  simulator claims it from the PC. No hotspot, Wi-Fi, pot or stake screens (M7).
- **Give a drink and Pause watering wait for M5** (UI spec open question 1 stays open until then).
- **A real tank level sensor is added to the hardware.** The water level is measured, so
  "I refilled it" and `set_water_left` are dropped. The float switch stays as the safety cut-off.
  Part and mounting are chosen in M7.
- **Digital twin:** the cloud does all calculations and sends instructions; the module keeps its
  hard limits and keeps watering on its last instructions when offline (anti-goal: the plant dies
  because the cloud or Wi-Fi is down).
- Inputs the twin will react to: soil moisture, water level, plant health; light level later
  (out of scope, no placeholder now).

## 3. Goals / non-goals / anti-goals

**Goals**
- Claim a module for a plant with a one-time code (`device-claim`).
- `device-sync`: module uploads raw readings and events, gets instructions and commands back.
- Twin conversions: soil %, water left (ml), battery %, watered ml; stored next to the raw values.
- Simulator (`sim/`): claims, wakes and syncs on schedule, models soil, tank, level sensor, float,
  battery; runs the shared module rules; scenarios; replays past time fast.
- App: live status on Home and plant detail, the M4 lines of the status grammar, Resume watering
  after a fault, Remove module.
- Works against hosted Supabase from any network (phone on mobile data).

**Non-goals (later)**
- Give a drink, Pause, moisture target, plans and their explanation (M5).
- Forecasts ("runs out in about…", "next drink in about…"), push notifications, the moisture chart
  (M5/M6). Readings are stored from day one so they have history.
- Hotspot/Wi-Fi provisioning, soil and tank calibration UI, pump calibration, Module settings screen,
  move to another plant, rename module (M7).
- Firmware (M7). Light sensor (unscheduled).

**Anti-goals**
- A cloud or Wi-Fi outage stops watering.
- Any path (bad twin maths, bad calibration, hostile request) that makes a module exceed
  40 ml per dose, 150 ml per rolling 24 h, pump with the float low, or keep watering after
  2 doses with no moisture rise.
- One user seeing or commanding another user's module; a module reading another module's data.
- The app showing a guessed value: unknown is "—".

## 4. Approaches

| Choice | Picked | Rejected, and why |
|---|---|---|
| Module ↔ backend | Edge Functions `device-claim`, `device-sync` (spec §5.5) with a per-module secret, stored hashed | Postgres RPC called by the module: validation in SQL, module needs the anon key |
| "Current status" for Home | `device-sync` copies the newest converted reading onto the `devices` row | A view picking the newest reading per module on every load: more work per load, fiddly paging |
| Keeping the app current | Refetch on open and on foreground; 30 s on plant detail; 5 s on the setup steps | Supabase Realtime: second data path to secure and test; modules report hourly anyway |
| Where calculations live | Cloud twin (owner); module keeps hard limits and runs offline | Module does the maths (spec as written): firmware changes for every logic change. Cloud decides each dose: plant unwatered when offline, battery cost of frequent Wi-Fi |
| Simulator | Zero-dependency Node script, plain `node` (Node 22 runs `.ts`), importing the shared module rules | A separate package with a build step |

## 5. The protocol (replaces spec §5.5)

Both endpoints: `verify_jwt = false` (the module has no user JWT), JSON, uniform errors as the other
functions (`{ error }`, no stacks or provider text), unknown fields rejected, logs only request id,
device id and outcome.

### 5.1 `POST /functions/v1/device-claim`

Request: exactly `{ "code": "K7P4QM2X9RTD", "firmware_version": "sim-0.1.0" }`
(code: 12 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, case-insensitive, separators ignored;
firmware_version ≤ 32 chars).

- Atomically consumes the claim (exists, not expired, deleted on use) and creates the module row for
  the claim's user and plant, in one SQL function executable only by `service_role`.
- The secret is 32 random bytes, base64url; the server stores only its SHA-256 (hex). Returned once.
- Response 200: `{ "device_id": "…", "secret": "…" }`. Unknown/expired/used code: 404
  "Code not found or expired." Plant already has a module: 409 "This plant already has a module."
- 59-bit codes valid 15 minutes: guessing is infeasible, so no rate limit (decided).

### 5.2 `POST /functions/v1/device-sync`

`Authorization: Bearer <secret>`. Missing or malformed header → 401. Well-formed secret that matches
no module → **410 `{ "error": "Unknown device." }`, which means "you belong to no one"** (removing a
module is a row delete; this is how the module learns of it). The module forgets its secret and Wi-Fi
and returns to setup mode only after **410 on two syncs in a row**; the simulator exits with a message.
Every other failure (401 included, which a gateway or key problem can produce) is retried next sync,
keeping the buffer, so a backend misconfiguration can never factory-reset modules (builder's call).

Request (body ≤ 64 KB, ≤ 200 readings, ≤ 100 events, ≤ 20 acks):
```json
{
  "firmware_version": "sim-0.1.0",
  "fault": null,
  "readings": [
    { "ts": "2026-11-18T09:00:00Z", "soil_raw": 1830, "tank_raw": 2210,
      "float_low": false, "battery_mv": 3920, "charging": false }
  ],
  "events": [
    { "ts": "2026-11-18T08:45:00Z", "type": "watered", "pump_ms": 9800 },
    { "ts": "2026-11-18T08:10:00Z", "type": "refill_detected" },
    { "ts": "2026-11-18T07:00:00Z", "type": "fault", "code": "no_moisture_rise" }
  ],
  "acked": ["<command id>"]
}
```
- `fault` is the module's **current** fault state (`null` | `no_moisture_rise` | `sensor_out_of_range`),
  sent on every sync; the server mirrors it into `devices.fault_code`. Fault *events* are history only,
  so offline buffers, acks and clock skew never have to be ordered (builder's call).
- Raw values are integers in 0–4095 (12-bit ADC); `battery_mv` 2500–4500; `pump_ms` 1–60 000.
- `ts` must be within [now − 14 days, now + 5 min]. Readings and events are idempotent
  (unique on device + ts, and device + ts + type), so a retried upload is harmless.
- Event types: `watered` (needs `pump_ms`), `refill_detected`, `tank_low`, `battery_low`, `boot`,
  `fault` (needs `code`: `no_moisture_rise` | `sensor_out_of_range`).

Response 200:
```json
{
  "instructions": {
    "water_when_soil_raw_above": 2305,
    "pump_ms": 10000,
    "min_minutes_between_doses": 60,
    "read_interval_s": 900,
    "sync_interval_s": 3600
  },
  "commands": [ { "id": "…", "type": "clear_fault" } ]
}
```
- The full instructions come back on every sync; the module keeps the latest. No versions until M5.
- Commands are the module's un-acked commands, oldest first. M4 has one: `clear_fault`.

### 5.3 What the module does (shared rules, `supabase/functions/_shared/watering.ts`)

Every wake (`read_interval_s`): read soil, tank, float, battery; store the reading in its buffer
(≥ 24 h); then decide:

- Water (`pump_ms`, capped as below) only if `soil_raw > water_when_soil_raw_above`, float not low,
  no fault, `min_minutes_between_doses` passed, and the rolling-24 h pump time allows it.
- **Compiled-in limits (no instruction can exceed them):** pump time per dose ≤ 40 ml and per rolling
  24 h ≤ 150 ml, each converted with a compiled worst-case pump rate (placeholder 4.0 ml/s → 10 s and
  37.5 s; M7 measures the real pump at 4.2 V and sets it). Never pump while the float reads low.
  Raw soil outside the sensor's plausible range → no watering and `fault: sensor_out_of_range`, which
  clears itself once readings are back in range.
- After 2 doses with no moisture rise (soil raw not lower by at least a compiled step after the
  dose): stop watering, raise `fault: no_moisture_rise`, wait for `clear_fault` (the only fault the
  user clears).
- **Safety state survives reboots and power loss:** the rolling-24 h pump log, the no-rise counter,
  the current fault and the last instructions are saved (firmware: flash/NVS, written after each dose
  and change; simulator: `sim/.devices/<name>.json`). If saved state is missing or unreadable, the
  module treats today's 24 h budget as used up (safety first; at worst a day without watering)
  (builder's call). `watering.ts` is a pure function `(state, reading, instructions, now) → (state,
  action)` so this is testable.
- Never received instructions → built-in conservative defaults. No sync for a long time → keep the
  last instructions.
- Sync early (spec §5.4) on: refill detected (tank raw rose by a compiled step), float went low,
  a fault, battery below its low threshold.
- On `clear_fault`: clear the fault and the no-rise counter; ack the id on the next sync.
- **Battery (owner, 2026-11-18: must last a vacation):** a failed sync (no Wi-Fi, timeout, any non-200)
  backs off: the next try is after 1, 2, 4, then at most 6 h, reset by the first success; watering
  carries on locally throughout and the buffer keeps the readings (oldest dropped past its capacity).
  Instructed intervals are accepted only within compiled bounds (read 5–60 min, sync 15 min–6 h), so a
  twin bug can't make the module sync itself flat.

The module does no calibration maths. The twin also clamps what it sends to the same limits using the
calibrated pump rate, so there are two independent layers.

## 6. The twin (cloud)

`supabase/functions/_shared/twin.ts`, pure and unit-tested; `device-sync` calls it.

- **Soil %** = (air − raw) / (air − wet) × 100, clamped 0–100 (capacitive: drier reads higher).
- **Water left (ml)** = tank_full_ml × (raw − empty_raw) / (full_raw − empty_raw), clamped 0–full,
  rounded. Null when the reading is outside the calibrated span by more than a margin (sensor fault).
- **Battery %** from a LiPo voltage table (3.30 V = 0 %, 4.20 V = 100 %, piecewise linear).
- **Watered ml** = pump_ms × pump_ml_per_s / 1000.
- **Instructions (M4):** the spec's default plan: band 35–55 % → `water_when_soil_raw_above` = the raw
  value at 35 %; dose 30 ml → `pump_ms` at the calibrated pump rate, clamped to 40 ml; 60 min between
  doses; 900 s read interval; sync interval 3600 s, or **10 800 s when the latest battery is < 20 %**
  (saves battery; the row stores the interval it sent as `sync_interval_s`, and the app's "not heard
  from" threshold is 3 × that). Battery-voltage correction of the pump rate is left to M7 (shortcut:
  a full battery pumps ~10 % more, still inside the 40 ml compiled cap).
- **Calibration** lives only on the `devices` row. M4 sets defaults at claim (soil air 2900 / wet 1200,
  tank empty / full raw from the simulator's sensor model, tank 705 ml, pump 3.0 ml/s); the simulator
  models sensors that match them. M7 adds the calibration steps that overwrite them; because raw values
  are stored, history can be recomputed then.
- On each sync `device-sync` also: records `last_seen_at` and `firmware_version`; copies the newest
  reading's converted values onto the row; mirrors the request's `fault` into `fault_code`; marks
  acked commands.

## 7. Data and security

New migration(s); then `npm run db:types`.

| Table | Columns (main) | Who writes |
|---|---|---|
| `device_claims` | `code` pk, `user_id` default `auth.uid()`, `plant_id` → plants on delete cascade, `expires_at` default now() + 15 min, `created_at` | owner inserts (`plant_id` only; code and expiry from defaults) |
| `devices` | `id`, `user_id`, `plant_id` unique → plants on delete cascade, `secret_hash` unique, `firmware_version`, `created_at`, `last_seen_at`, `sync_interval_s`; latest: `reading_ts`, `soil_pct`, `water_left_ml`, `float_low`, `battery_pct`, `charging`, `fault_code`; calibration: `soil_air_raw`, `soil_wet_raw`, `tank_empty_raw`, `tank_full_raw`, `tank_full_ml`, `pump_ml_per_s` | functions only; owner may delete |
| `readings` | pk (`device_id`, `ts`), raw (`soil_raw`, `tank_raw`, `float_low`, `battery_mv`, `charging`) + converted (`soil_pct`, `water_left_ml`, `battery_pct`) | functions only |
| `device_events` | `id`, `device_id`, `ts`, `type`, `pump_ms`, `ml`, `code`; unique (`device_id`, `ts`, `type`) | functions only |
| `device_commands` | `id`, `device_id`, `type` check in (`clear_fault`), `created_at`, `acked_at` | owner inserts (`device_id`, `type`); functions ack |

- RLS on all five, owner-only: `devices` and `device_claims` by `user_id`; `readings`,
  `device_events`, `device_commands` through an own device. Owner select on all five; owner delete on
  `devices` only (readings, events, commands cascade); no owner updates anywhere.
- `secret_hash` is never selectable by `authenticated` (column-level select grant without it, so the
  app lists its columns; `select *` fails). Calibration columns are readable, never writable.
- Claim insert policy: plant must be the caller's own and have no module. Creating a claim deletes the
  caller's earlier claims for that plant.
- Command insert policy: device must be the caller's own.
- `claim_device(code, secret_hash)` security definer, execute only for `service_role`.
- `service_role` grants for every table and function the two functions touch, asserted in
  `service_role_grants.test.sql` (hosted grants nothing; local tests can't catch a miss: verify on hosted).
- pgTAP: cross-user tests on all five tables; secret_hash not selectable; owner can't insert devices,
  readings or events, can't update anything, can't claim for another user's plant or a plant with a
  module, can't command another user's device or insert a type other than `clear_fault`;
  `claim_device` single-use, expiry, one module per plant; deleting a plant removes its module and
  history.
- No retention job for readings (~100 rows/day/module). Shortcut: fine for the owner's test fleet;
  add downsampling before store release.
- No rate limit on `device-sync`: a valid secret only lets its owner load their own rows, each call is
  bounded (≤ 200 readings). Shortcut: revisit before store release.

## 8. App

### 8.1 Setup (from plant detail)
- Plant without a module: the "Setup isn't finished" banner gets **Add its module** → `plant/[id]/module`.
- **Module step:** creates a claim on open and shows the code in three groups (`K7P4 QM2X 9RTD`) with:
  "Simulated module: on your computer run `node sim/sim.ts --claim K7P4QM2X9RTD`. The real module
  receives this code over its own Wi-Fi during setup." A quiet "Waiting for the module…" row and
  "Code expires at 14:35". Polls every 5 s; when the plant has a module, goes on to the tank step.
  Expired: "This code expired." + **New code**. Leaving and returning makes a new code.
- **Tank step** (`plant/[id]/tank`): "Fill the tank. Open the cap on the saucer and pour until the
  water reaches the top of the hole." Tank vessel (react-native-svg, already installed) with the
  current level. Polls every 5 s; at ≥ 90 % full shows `StepDone` "The tank is full." and returns to
  the plant. **Done** in the bottom bar always leaves (the level then updates at the next check-in).
  The module syncs early when it sees a refill, so the step updates within seconds.

### 8.2 Status (`src/devices/status.ts`, pure, tested)
One sentence per plant, top-down, from the `devices` row and the current time:

| # | Condition | Level | Home sentence | Detail banner |
|---|---|---|---|---|
| 1 | `fault_code` set | Now | Watering stopped · Check the stake is in the soil | `no_moisture_rise`: "Watering stopped. Check the stake is in the soil and the tube isn't kinked, then resume." + **Resume watering**. `sensor_out_of_range`: "Watering stopped. Check the stake is pushed into the soil; it resumes by itself." |
| 2 | `float_low` | Now | Tank needs refilling | "The tank needs refilling. Watering is paused until it's filled." |
| 3 | `last_seen_at` older than 3 × `sync_interval_s` (3 missed check-ins) | Quiet (Now if the last battery was < 20 %: "…its battery was low") | Not heard from since 09:12 | "Not heard from since 09:12. It should keep watering on its last instructions." |
| 4 | `soil_pct` > 55 | Soon | Soil is very wet · Watering is on hold | none |
| 5 | `battery_pct` < 20 | Soon | Battery is low · Charge it this week | "Battery is low. Charge it this week." |
| 6 | otherwise | Fine | Doing well · Still learning how fast it drinks | none |
| – | no module | Quiet | Setup isn't finished · Add its module | today's banner + **Add its module** |

- Band 35–55 % is the M4 default (a constant shared with the twin; M5 makes it per plant).
- Times follow the device locale; older than today shows the weekday or date.
- Home: summary "2 need you · 3 doing well" and sections "Needs you" (Now, Soon, Quiet incl. no module)
  and "Doing well" (Fine); headers dropped when all are fine. Counts cover loaded pages (known limit).
- The plants page query embeds the module (`devices(...)` with explicit columns); Home refetches on
  open/foreground as today.

### 8.3 Plant detail
- Banner per §8.2 above the timeline. **Resume watering** inserts `clear_fault`; then "Resumes at the
  next check-in, by about 10:12" until the fault clears.
- **Module** group (inset rows), only with a module:
  - Water: vessel + "About 500 ml left" (rounded to 50 ml; "Needs refilling" when the float is low;
    "—" when unknown)
  - Soil: "Dry · 28 %" / "Damp · 41 %" / "Very wet · 70 %" by the band; "—" when unknown
  - Battery: "78 %", "· Charging"
  - Checked in: "09:12"
- Refetch every 30 s while open.
- "…" menu: Edit plant; **Remove module** (confirm: "Remove the module? Its history is deleted. The
  module forgets this account at its next check-in."). Deleting a plant also removes its module
  (Edit's delete copy says so).
- Text before data as today: skeleton rows inside `LoadingGroup`; failed load with no cache → "—".

## 9. Simulator (`sim/`)

- `node sim/sim.ts --claim <code> [--name pot1] [--url <supabase url>] [--from 2d --speed 360]
  [--scenario <name>]`; later runs `node sim/sim.ts --name pot1` reuse the saved secret.
- URL defaults to `EXPO_PUBLIC_SUPABASE_URL` in `apps/mobile/.env.local` (hosted or local).
  Secrets saved in `sim/.devices/<name>.json`, git-ignored.
- Clock: real time by default. `--from 2d --speed 360` starts the module's clock 2 days in the past and
  runs it 360× until it catches up with now, then continues in real time, so timestamps never lie
  ahead of the server and the app gets history quickly.
- Model: soil dries at a scenario rate, a dose raises it; the tank drains by each dose; level sensor raw
  is linear in ml plus noise, matching the claim defaults; float low at ≤ 100 ml; battery drains per wake
  and more per sync.
- Keys while running: `f` fill the tank, `h` top up half, `q` quit.
- Scenarios (spec §5.9 minus the two estimate cases): `drought` (fast drying), `tank-empty` (starts at
  50 ml), `offline-6h` (no syncs for 6 h, then uploads the buffer), `stake-out-of-soil` (soil stays at
  air → no rise → fault), `battery-low` (starts at 3.45 V). A plain claim starts with an empty tank so the
  Tank step is exercised.
- Several modules: one process per `--name`. Exits after 410 on two syncs in a row.
- Runs the shared `watering.ts` rules unchanged; prints one line per wake and per sync.
- A small `node --test` self-check of the model (`sim/sim_test.ts`), run by a new root script
  `sim:test`, added to the CLAUDE.md check list.

## 10. Doc amendments (in this milestone)
- Hardware doc: dated change "tank level sensor added (measured water level); float switch stays as the
  low-water cut-off; part and mounting chosen in M7 (candidates: a v1.2 capacitive probe hung upright
  from the rim, or a plate on the dry side of the bay wall)"; requirement 11 updated; power note (battery must last a vacation): the level sensor and the float switch draw power only while being read (GPIO-powered or switched, no standing pull-up current), like the soil probe, and the SuperMini's always-on power LED is removed (alone it would drain the battery in about 6 weeks).
- Software spec: §5.5 → this §5; §5.6 water-left estimate → measured level, twin, runtime caps; §5.7
  commands for M4 = `clear_fault`, unpair = 410 twice; §6 data model per §7 here; §7 drops "I refilled it".
- UI spec: "I refilled it" sheet and "Still reads low" removed; vessel line is solid (measured);
  Give a drink / Pause noted as M5.
- CLAUDE.md: device rules (secret hashed, functions-only writes, compiled limits) and `sim:test`.

## 11. Testing and verification
- Deno: `watering.ts` (every limit, float, fault after 2 no-rise doses, defaults, early-sync triggers),
  `twin.ts` (conversions, clamps, null on sensor fault, instruction clamps), both functions with mocked
  fetch (validation incl. unknown fields and bounds, 401/410/404/409, idempotent retry, ack, fault
  mirrored, uniform errors). `watering.ts` also: state restored after a reboot keeps the 24 h budget and
  the fault; missing state → budget used up.
- pgTAP per §7. Jest: status function (each row and order), Home summary/sections, detail module group
  and banners, module and tank steps (polling, expiry, new code), Resume watering, Remove module.
- End to end: simulator scenarios against local Supabase with the web app; then hosted, with the phone
  on mobile data (proves "from anywhere"). Confirm on hosted that `verify_jwt = false` functions accept
  the module's bearer secret without an `apikey` header; if not, the module sends the anon key as
  `apikey` (public value, not a secret).

## 12. Left to the builder
Migration split, SQL function names, exact noise/drying constants in the simulator, compiled steps for
"moisture rise" and "refill detected", vessel drawing details, copy polish within the UI spec's voice,
route presentation (push or modal).
