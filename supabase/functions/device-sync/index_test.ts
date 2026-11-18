import { assert, assertEquals } from '@std/assert';

import { handler } from './index.ts';
import type { Deps } from '../_shared/auth.ts';
import { sha256Hex } from '../_shared/device_auth.ts';

const DEVICE = '22222222-2222-2222-2222-222222222222';
const SECRET = 'A'.repeat(43);
const NOW = Date.parse('2026-11-18T12:00:00Z');
const CMD1 = '33333333-3333-3333-3333-333333333333';
const CMD2 = '44444444-4444-4444-4444-444444444444';
const cal = { soil_air_raw: 2900, soil_wet_raw: 1200, tank_empty_raw: 1000, tank_full_raw: 3000, tank_full_ml: 705, pump_ml_per_s: 3 };

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function world(opts: { device?: Row | null; fail?: boolean } = {}) {
  const hash = sha256Hex(SECRET);
  const w = {
    device: opts.device === undefined ? { id: DEVICE, reading_ts: null, battery_pct: null, ...cal } : opts.device,
    readings: new Map<string, Row>(),
    events: new Map<string, Row>(),
    commands: [{ id: CMD1, type: 'clear_fault', acked_at: null }, { id: CMD2, type: 'clear_fault', acked_at: null }] as Row[],
    devicePatches: [] as Row[],
    urls: [] as string[],
  };
  const deps: Deps = {
    supabaseUrl: 'http://sb',
    serviceRoleKey: 'srk',
    fetch: async (input, init) => {
      const u = new URL(String(input));
      w.urls.push(u.pathname + u.search);
      if (opts.fail) return new Response('boom', { status: 500 });
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const table = u.pathname.replace('/rest/v1/', '');
      if (table === 'devices' && init?.method === 'PATCH') {
        w.devicePatches.push(body);
        return new Response(null, { status: 204 });
      }
      if (table === 'devices') {
        const ok = u.searchParams.get('secret_hash') === `eq.${await hash}` && w.device;
        return Response.json(ok ? [w.device] : []);
      }
      const upsert = (map: Map<string, Row>, key: (r: Row) => string, conflict: string) => {
        const prefer = (init?.headers as Record<string, string>)?.prefer ?? '';
        const ignore = prefer.includes('resolution=ignore-duplicates') && u.searchParams.get('on_conflict') === conflict;
        for (const r of body) {
          if (!map.has(key(r))) map.set(key(r), r);
          else if (!ignore) return new Response('dup', { status: 409 });
        }
        return new Response(null, { status: 201 });
      };
      if (table === 'readings') return upsert(w.readings, (r) => r.ts, 'device_id,ts');
      if (table === 'device_events') return upsert(w.events, (e) => `${e.ts}|${e.type}|${e.code}`, 'device_id,ts,type,code');
      if (table === 'device_commands' && init?.method === 'PATCH') {
        const ids = u.searchParams.get('id')!.slice(4, -1).split(',');
        for (const c of w.commands) if (ids.includes(c.id)) c.acked_at ??= body.acked_at;
        return new Response(null, { status: 204 });
      }
      if (table === 'device_commands') {
        const lim = Number(u.searchParams.get('limit') ?? Infinity);
        return Response.json(w.commands.filter((c) => c.acked_at === null).slice(0, lim).map(({ id, type }) => ({ id, type })));
      }
      return new Response('unexpected', { status: 500 });
    },
  };
  return { deps, w };
}

const reading = (o: Row = {}) => ({ ts: '2026-11-18T11:00:00Z', soil_raw: 2000, tank_raw: 1500, float_low: false, battery_mv: 3900, charging: false, ...o });
const base = (o: Row = {}) => ({ firmware_version: 'sim-0.1.0', fault: null, readings: [], events: [], acked: [], ...o });
const req = (body: unknown, auth: string | null = `Bearer ${SECRET}`, method = 'POST') =>
  new Request('http://x/', {
    method,
    headers: auth ? { authorization: auth } : {},
    body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
const sync = (b: unknown, x = world(), auth?: string | null) => handler(req(b, auth), x.deps, () => NOW);

const logs: string[] = [];
const realLog = console.log;
console.log = (s: string) => logs.push(String(s));
addEventListener('unload', () => (console.log = realLog));

Deno.test('401 without a well-formed bearer', async () => {
  const x = world();
  for (const a of [null, 'Bearer short', `Basic ${SECRET}`, `Bearer ${SECRET}x`]) {
    assertEquals((await handler(req(base(), a), x.deps, () => NOW)).status, 401, String(a));
  }
  assertEquals(x.w.urls.length, 0);
});

Deno.test('410 for an unknown secret', async () => {
  const res = await sync(base(), world(), `Bearer ${'B'.repeat(43)}`);
  assertEquals(res.status, 410);
  assertEquals(await res.json(), { error: 'Unknown device.' });
});

Deno.test('405 on GET', async () => {
  assertEquals((await handler(req(null, `Bearer ${SECRET}`, 'GET'), world().deps, () => NOW)).status, 405);
});

Deno.test('400 on unknown top-level field or > 200 readings', async () => {
  const x = world();
  const many = Array.from({ length: 201 }, (_, i) => reading({ ts: new Date(NOW - i * 1000).toISOString() }));
  for (const b of [{ ...base(), extra: 1 }, base({ readings: many }), { firmware_version: 'x' }, base({ fault: 'nope' }), base({ acked: ['x'] }), '{nope']) {
    assertEquals((await sync(b, x)).status, 400, JSON.stringify(b).slice(0, 60));
  }
  assertEquals(x.w.urls.length, 0);
});

Deno.test('stores readings with converted values and returns default instructions', async () => {
  const x = world();
  const res = await sync(base({ readings: [reading()] }), x);
  assertEquals(res.status, 200);
  const { instructions, commands } = await res.json();
  assertEquals(instructions.water_when_soil_raw_above, 2305);
  assertEquals(instructions.pump_ms, 10_000);
  assertEquals(instructions.sync_interval_s, 3600);
  assertEquals(commands.length, 2);
  const r = [...x.w.readings.values()][0];
  assertEquals([r.device_id, r.soil_pct, r.water_left_ml, r.battery_pct], [DEVICE, 52.9, 176, 65]);
  const p = x.w.devicePatches[0];
  assertEquals([p.reading_ts, p.soil_pct, p.battery_pct, p.float_low, p.charging, p.sync_interval_s], ['2026-11-18T11:00:00.000Z', 52.9, 65, false, false, 3600]);
  assertEquals(p.last_seen_at, new Date(NOW).toISOString());
});

Deno.test('skips bad items and stores the rest', async () => {
  const x = world();
  logs.length = 0;
  const res = await sync(base({
    readings: [reading({ ts: '1970-01-01T00:00:00Z' }), reading({ soil_raw: 5000 }), reading({ battery_mv: 0 }), reading({ battery_mv: 5000 }), reading({ ts: '2026-11-18T10:00:00Z' })],
    events: [{ ts: '2026-11-18T10:00:00Z', type: 'explode' }],
  }), x);
  assertEquals(res.status, 200);
  assertEquals(x.w.readings.size, 1);
  assertEquals(x.w.events.size, 0);
  assertEquals(JSON.parse(logs.at(-1)!).skipped, 5);
});

Deno.test('a retried sync stores nothing twice and acks again harmlessly', async () => {
  const x = world();
  const b = base({
    readings: [reading()],
    events: [{ ts: '2026-11-18T10:30:00Z', type: 'watered', pump_ms: 10_000 }],
    acked: [CMD1],
  });
  assertEquals((await sync(b, x)).status, 200);
  assertEquals((await sync(b, x)).status, 200);
  assertEquals(x.w.readings.size, 1);
  assertEquals(x.w.events.size, 1);
  assertEquals([...x.w.events.values()][0].ml, 30);
  assertEquals([...x.w.events.values()][0].code, null);
});

Deno.test('mirrors the module fault', async () => {
  const x = world();
  await sync(base({ fault: 'no_moisture_rise' }), x);
  assertEquals(x.w.devicePatches[0].fault_code, 'no_moisture_rise');
  await sync(base(), x);
  assertEquals(x.w.devicePatches[1].fault_code, null);
});

Deno.test('acks commands and returns only unacked ones oldest first', async () => {
  const x = world();
  const res = await sync(base({ acked: [CMD1] }), x);
  assertEquals((await res.json()).commands, [{ id: CMD2, type: 'clear_fault' }]);
  assert(x.w.urls.some((u) => u.includes('order=created_at')));
});

Deno.test('returns at most 20 commands so the ack list stays within its cap', async () => {
  const x = world();
  x.w.commands = Array.from({ length: 25 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, type: 'clear_fault', acked_at: null }));
  assertEquals((await (await sync(base(), x)).json()).commands.length, 20);
});

Deno.test('an older buffer never overwrites newer latest values', async () => {
  const x = world({ device: { id: DEVICE, reading_ts: '2026-11-18T11:30:00Z', battery_pct: 70, ...cal } });
  await sync(base({ readings: [reading()] }), x);
  assertEquals(x.w.readings.size, 1);
  const p = x.w.devicePatches[0];
  for (const k of ['reading_ts', 'soil_pct', 'water_left_ml', 'float_low', 'battery_pct', 'charging']) assert(!(k in p), k);
});

Deno.test('low battery sends a 3 h sync interval and stores it on the row', async () => {
  const x = world();
  const res = await sync(base({ readings: [reading({ battery_mv: 3500 })] }), x);
  assertEquals((await res.json()).instructions.sync_interval_s, 10_800);
  assertEquals(x.w.devicePatches[0].sync_interval_s, 10_800);
});

Deno.test('uniform 500 when the database fails, nothing sensitive logged', async () => {
  logs.length = 0;
  const res = await sync(base(), world({ fail: true }));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'Something went wrong.' });
  const all = logs.join('\n');
  assert(!all.includes(SECRET) && !all.includes(await sha256Hex(SECRET)));
});

Deno.test('explicit null pump_ms and code are the same as absent', async () => {
  const x = world();
  const res = await sync(base({ events: [{ ts: '2026-11-18T10:00:00Z', type: 'refill_detected', pump_ms: null, code: null }] }), x);
  assertEquals(res.status, 200);
  assertEquals(x.w.events.size, 1);
});
