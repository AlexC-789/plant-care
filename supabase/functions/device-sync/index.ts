// device-sync: a module uploads its buffered readings/events, acks commands, and gets instructions + pending
// commands back (spec §5.2). Public (no user JWT): the device secret is the credential; only its hash is stored.
// Bad items are skipped, never fatal: a buffer that can never upload would strand the module.
import { type Deps, envDeps } from '../_shared/auth.ts';
import { rest } from '../_shared/db.ts';
import { sha256Hex } from '../_shared/device_auth.ts';
import { json, jsonError, readJsonBody } from '../_shared/http.ts';
import { batteryPct, type Calibration, instructionsFor, soilPct, waterLeftMl, wateredMl } from '../_shared/twin.ts';

const DAY = 86_400_000;
const FAULTS = ['no_moisture_rise', 'sensor_out_of_range'];
const TYPES = ['watered', 'refill_detected', 'tank_low', 'battery_low', 'boot', 'fault'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IGNORE = { prefer: 'resolution=ignore-duplicates,return=minimal' };

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const onlyKeys = (o: Obj, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));
const int = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const bool = (x: unknown): x is boolean => typeof x === 'boolean';

/** ISO timestamp inside [now - 14 d, now + 5 min], normalised; null if not. */
function goodTs(x: unknown, now: number): string | null {
  const t = typeof x === 'string' ? Date.parse(x) : NaN;
  return t >= now - 14 * DAY && t <= now + 300_000 ? new Date(t).toISOString() : null;
}

export async function handler(req: Request, deps: Deps, now: () => number = Date.now): Promise<Response> {
  const requestId = req.headers.get('sb-request-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID();
  let deviceId = '-';
  let outcome = 'error';
  let skipped = 0;
  const respond = (res: Response, o: string) => {
    outcome = o;
    return res;
  };
  try {
    if (req.method !== 'POST') return respond(jsonError(405, 'Invalid request.'), 'bad_method');
    const secret = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.get('authorization') ?? '')?.[1];
    if (!secret) return respond(jsonError(401, 'Invalid request.'), 'unauthorized');

    const body = await readJsonBody(req, 65_536);
    if (body instanceof Response) return respond(body, `body_${body.status}`);
    const { firmware_version: fw, fault, readings, events, acked } = body;
    if (
      Object.keys(body).length !== 5 || typeof fw !== 'string' || fw.length < 1 || fw.length > 32 ||
      !(fault === null || FAULTS.includes(fault as string)) ||
      !Array.isArray(readings) || readings.length > 200 || !Array.isArray(events) || events.length > 100 ||
      !Array.isArray(acked) || acked.length > 20 || !acked.every((a) => typeof a === 'string' && UUID.test(a))
    ) return respond(jsonError(400, 'Invalid request.'), 'bad_request');

    const t = now();
    const hash = await sha256Hex(secret);
    const dres = await rest(deps, `devices?secret_hash=eq.${encodeURIComponent(hash)}&select=id,reading_ts,battery_pct,soil_air_raw,soil_wet_raw,tank_empty_raw,tank_full_raw,tank_full_ml,pump_ml_per_s`);
    const dev: (Calibration & { id: string; reading_ts: string | null; battery_pct: number | null }) | undefined = (await dres.json())[0];
    if (!dev) return respond(json({ error: 'Unknown device.' }, 410), 'unknown_device');
    deviceId = dev.id;

    const rows = [];
    for (const r of readings) {
      const ts = isObj(r) ? goodTs(r.ts, t) : null;
      if (
        !isObj(r) || !ts || !onlyKeys(r, ['ts', 'soil_raw', 'tank_raw', 'float_low', 'battery_mv', 'charging']) ||
        !int(r.soil_raw, 0, 4095) || !int(r.tank_raw, 0, 4095) || !int(r.battery_mv, 2500, 4500) || !bool(r.float_low) || !bool(r.charging)
      ) {
        skipped++;
        continue;
      }
      rows.push({
        device_id: dev.id, ts, soil_raw: r.soil_raw, tank_raw: r.tank_raw, float_low: r.float_low, battery_mv: r.battery_mv,
        charging: r.charging, soil_pct: soilPct(r.soil_raw, dev), water_left_ml: waterLeftMl(r.tank_raw, dev), battery_pct: batteryPct(r.battery_mv),
      });
    }
    const evs = [];
    for (const e of events) {
      const ts = isObj(e) ? goodTs(e.ts, t) : null;
      const ok = isObj(e) && ts && onlyKeys(e, ['ts', 'type', 'pump_ms', 'code']) && TYPES.includes(e.type as string) &&
        (e.type === 'watered' ? int(e.pump_ms, 1, 60_000) : e.pump_ms == null) &&
        (e.type === 'fault' ? FAULTS.includes(e.code as string) : e.code == null);
      if (!ok) {
        skipped++;
        continue;
      }
      const pump = e.type === 'watered' ? e.pump_ms as number : null;
      evs.push({ device_id: dev.id, ts, type: e.type, pump_ms: pump, ml: pump === null ? null : wateredMl(pump, dev), code: e.code ?? null });
    }

    if (rows.length) await rest(deps, 'readings?on_conflict=device_id,ts', { method: 'POST', headers: IGNORE, body: JSON.stringify(rows) });
    if (evs.length) await rest(deps, 'device_events?on_conflict=device_id,ts,type,code', { method: 'POST', headers: IGNORE, body: JSON.stringify(evs) });
    if (acked.length) {
      await rest(deps, `device_commands?device_id=eq.${dev.id}&id=in.(${acked.join(',')})&acked_at=is.null`, {
        method: 'PATCH',
        body: JSON.stringify({ acked_at: new Date(t).toISOString() }),
      });
    }

    // Latest values only from the newest reading, and only if newer than what the row already has.
    const newest = rows.reduce<(typeof rows)[number] | null>((m, r) => (!m || r.ts > m.ts ? r : m), null);
    const fresh = newest && (!dev.reading_ts || Date.parse(newest.ts) > Date.parse(dev.reading_ts)) ? newest : null;
    const instructions = instructionsFor(dev, fresh ? fresh.battery_pct : dev.battery_pct);
    await rest(deps, `devices?id=eq.${dev.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        last_seen_at: new Date(t).toISOString(), firmware_version: fw, fault_code: fault, sync_interval_s: instructions.sync_interval_s,
        ...(fresh && {
          reading_ts: fresh.ts, soil_pct: fresh.soil_pct, water_left_ml: fresh.water_left_ml, float_low: fresh.float_low,
          battery_pct: fresh.battery_pct, charging: fresh.charging,
        }),
      }),
    });

    const commands = await (await rest(deps, `device_commands?device_id=eq.${dev.id}&acked_at=is.null&order=created_at&limit=20&select=id,type`)).json();
    return respond(json({ instructions, commands }), 'ok');
  } catch {
    return respond(jsonError(500, 'Something went wrong.'), 'error');
  } finally {
    console.log(JSON.stringify({ fn: 'device-sync', requestId, deviceId, outcome, skipped }));
  }
}

if (import.meta.main) Deno.serve((req) => handler(req, envDeps()));
