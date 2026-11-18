import { assert, assertEquals, assertFalse } from '@std/assert';

import { type CheckHealthDeps, handler } from './index.ts';

const fixture = (name: string) => Deno.readTextFileSync(new URL(`../_shared/fixtures/${name}.json`, import.meta.url));
const U = '11111111-1111-1111-1111-111111111111';
const PLANT = '44444444-4444-4444-4444-444444444444';
const P1 = `${U}/22222222-2222-2222-2222-222222222222.jpg`;
const P2 = `${U}/33333333-3333-3333-3333-333333333333.jpg`;
const KEY = 'sk-secret-key-123';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const JPEG_B64 = btoa(String.fromCharCode(...JPEG));
const UNSURE = { healthy: null, note: "Couldn't tell from this photo. Try one with the leaves in view.", advice: null };

// keep test output pristine: the handler logs one line per request
const logs: string[] = [];
console.log = (...a: unknown[]) => void logs.push(a.join(' '));

interface World {
  deps: CheckHealthDeps;
  calls: { url: URL; init?: RequestInit }[];
  scans: Record<string, unknown>[];
}

/** Routes Auth / PostgREST / Storage / Plant.id URLs to in-memory fakes. The caller owns PLANT only. */
function world(o: { recent?: number; plantId?: () => Response } = {}): World {
  const w: World = { calls: [], scans: [], deps: undefined as never };
  w.deps = {
    supabaseUrl: 'http://sb',
    serviceRoleKey: 'srk',
    plantIdApiKey: KEY,
    fetch: (input, init) => {
      const u = new URL(String(input));
      w.calls.push({ url: u, init });
      const method = init?.method ?? 'GET';
      if (u.pathname === '/auth/v1/user') return Promise.resolve(Response.json({ id: U }));
      if (u.pathname.startsWith('/storage/v1/object/plant-photos/')) return Promise.resolve(new Response(JPEG));
      if (u.host === 'plant.id') return Promise.resolve((o.plantId ?? (() => new Response(fixture('health_assessment'))))());
      if (u.pathname === '/rest/v1/plants' && method === 'GET') {
        const owned = u.searchParams.get('id') === `eq.${PLANT}` && u.searchParams.get('user_id') === `eq.${U}`;
        return Promise.resolve(Response.json(owned ? [{ id: PLANT }] : []));
      }
      if (u.pathname === '/rest/v1/scans' && method === 'HEAD') {
        return Promise.resolve(new Response(null, { headers: { 'content-range': `*/${o.recent ?? 0}` } }));
      }
      if (u.pathname === '/rest/v1/scans' && method === 'POST') {
        w.scans.push(JSON.parse(String(init?.body)));
        return Promise.resolve(Response.json([{ id: 'scan-1' }], { status: 201 }));
      }
      return Promise.resolve(new Response('unexpected', { status: 500 }));
    },
  };
  return w;
}

const req = (body: unknown, auth: string | null = 'Bearer tok') =>
  new Request('http://x/', {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const health = (isHealthy: number, suggestions: unknown[] = [], isPlant = 1) => () =>
  Response.json({ result: { is_plant: { probability: isPlant }, is_healthy: { probability: isHealthy }, disease: { suggestions } } });
const touchedProviderOrStorage = (w: World) => w.calls.some((c) => c.url.host === 'plant.id' || c.url.pathname.startsWith('/storage'));

Deno.test('unauthenticated is 401 and nothing else is called', async () => {
  const w = world();
  assertEquals((await handler(req({ plantId: PLANT, photoPaths: [P1] }, null), w.deps)).status, 401);
  assertEquals(w.calls.length, 0);
});

Deno.test('invalid body, bad plantId, unknown fields, wrong counts 400; foreign path 403', async () => {
  const w = world();
  for (const b of ['{nope', {}, { photoPaths: [P1] }, { plantId: PLANT }, { plantId: 'x', photoPaths: [P1] }, { plantId: 5, photoPaths: [P1] },
    { plantId: PLANT, photoPaths: [P1], extra: 1 }, { plantId: PLANT, photoPaths: [] }, { plantId: PLANT, photoPaths: [P1, P2, P1] }]) {
    assertEquals((await handler(req(b), w.deps)).status, 400, JSON.stringify(b));
  }
  const other = '22222222-2222-2222-2222-222222222222/22222222-2222-2222-2222-222222222222.jpg';
  assertEquals((await handler(req({ plantId: PLANT, photoPaths: [other] }), w.deps)).status, 403);
  assertFalse(touchedProviderOrStorage(w));
});

Deno.test('plant not owned (or missing): 403 before any Storage read or Plant.id call', async () => {
  const w = world();
  const res = await handler(req({ plantId: '55555555-5555-5555-5555-555555555555', photoPaths: [P1] }), w.deps);
  assertEquals(res.status, 403);
  assertEquals(await res.json(), { error: 'Not allowed.' });
  const lookup = w.calls.find((c) => c.url.pathname === '/rest/v1/plants')!;
  assertEquals((lookup.init?.headers as Record<string, string>).authorization, 'Bearer srk');
  assertFalse(touchedProviderOrStorage(w));
  assertEquals(w.scans, []);
});

Deno.test('limit is shared with identify: 20 counted calls 429 with the health copy; 19 allowed', async () => {
  const w = world({ recent: 20 });
  const res = await handler(req({ plantId: PLANT, photoPaths: [P1] }), w.deps);
  assertEquals(res.status, 429);
  assertEquals(await res.json(), { error: "You've reached the health check limit for now. Try again later." });
  const count = w.calls.find((c) => c.init?.method === 'HEAD')!.url;
  // no kind filter: identify and health scans count together
  assertEquals(count.searchParams.get('kind'), null);
  assertEquals(count.searchParams.get('status'), 'in.(ok,not_plant)');
  assertFalse(touchedProviderOrStorage(w));
  assertEquals((await handler(req({ plantId: PLANT, photoPaths: [P1] }), world({ recent: 19 }).deps)).status, 200);
});

Deno.test('healthy >= 0.8: healthy copy; request carries all images; scan linked to the plant', async () => {
  const w = world({ plantId: health(0.8) });
  const res = await handler(req({ plantId: PLANT, photoPaths: [P1, P2] }), w.deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { scanId: 'scan-1', healthy: true, note: 'It looks healthy in this photo.', advice: null });
  const pid = w.calls.filter((c) => c.url.host === 'plant.id');
  assertEquals(pid.map((c) => c.url.pathname), ['/api/v3/health_assessment']);
  assertEquals(JSON.parse(String(pid[0].init?.body)).images, [JPEG_B64, JPEG_B64]);
  assertEquals(w.scans, [{
    user_id: U, kind: 'health', plant_id: PLANT, photo_paths: [P1, P2], status: 'ok', is_plant: 1,
    health: { healthy: true, note: 'It looks healthy in this photo.', advice: null, top_issue: null },
  }]);
});

Deno.test('top issue >= 0.3 and mapped: plain-words note and advice (recorded fixture)', async () => {
  const w = world();
  const body = await (await handler(req({ plantId: PLANT, photoPaths: [P1] }), w.deps)).json();
  assertEquals(body, {
    scanId: 'scan-1',
    healthy: false,
    note: 'Some leaves look yellow. Often too much water.',
    advice: 'Let the top few centimetres of soil dry before watering again.',
  });
  assertEquals(Object.keys(body).sort(), ['advice', 'healthy', 'note', 'scanId']);
  assertEquals(w.scans[0].health, {
    healthy: false, note: body.note, advice: body.advice,
    top_issue: { name: 'water excess or uneven watering', probability: 0.51401126 },
  });
  assertFalse(JSON.stringify(body).includes('water excess'));
});

Deno.test('top issue < 0.3, or unmapped: unsure copy, never the provider name', async () => {
  for (const s of [[{ name: 'fungi', probability: 0.29 }], [{ name: 'Phytophthora obscura', probability: 0.9 }], []]) {
    const w = world({ plantId: health(0.3, s) });
    const body = await (await handler(req({ plantId: PLANT, photoPaths: [P1] }), w.deps)).json();
    assertEquals(body, { scanId: 'scan-1', ...UNSURE }, JSON.stringify(s));
    assertEquals(w.scans[0].status, 'ok');
    assertFalse(JSON.stringify(body).includes('Phytophthora'));
  }
});

Deno.test('not a plant: status not_plant, unsure copy', async () => {
  const w = world({ plantId: health(0.9, [], 0.2) });
  const body = await (await handler(req({ plantId: PLANT, photoPaths: [P1] }), w.deps)).json();
  assertEquals(body, { scanId: 'scan-1', ...UNSURE });
  assertEquals([w.scans[0].status, w.scans[0].is_plant, w.scans[0].health], ['not_plant', 0.2, { ...UNSURE, top_issue: null }]);
});

Deno.test('provider error or timeout: 502 uniform body, error scan stored, nothing secret logged', async () => {
  for (const plantId of [() => new Response(`boom ${KEY}`, { status: 500 }), () => { throw new DOMException('timed out', 'TimeoutError'); }]) {
    logs.length = 0;
    const w = world({ plantId });
    const res = await handler(req({ plantId: PLANT, photoPaths: [P1] }), w.deps);
    assertEquals(res.status, 502);
    assertEquals(await res.json(), { error: "Couldn't check right now. Try again." });
    assertEquals(w.scans.map((s) => [s.kind, s.plant_id, s.status]), [['health', PLANT, 'error']]);
    const out = logs.join('\n');
    assert(out.includes(U) && out.includes('provider_error') && out.includes('check-health'));
    for (const secret of [KEY, 'srk', JPEG_B64]) assertFalse(out.includes(secret));
  }
});

Deno.test('unexpected failure: 500 uniform body', async () => {
  const w = world();
  const inner = w.deps.fetch;
  w.deps.fetch = (i, init) => String(i).includes('/storage/') ? Promise.reject(new Error('disk on fire')) : inner(i, init);
  const res = await handler(req({ plantId: PLANT, photoPaths: [P1] }), w.deps);
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'Something went wrong.' });
});

Deno.test('missing PLANT_ID_API_KEY is a uniform 500 before any download or scan, logged as misconfigured', async () => {
  const w = world();
  const errors: string[] = [];
  const realError = console.error;
  console.error = (...a: unknown[]) => void errors.push(a.join(' '));
  try {
    const res = await handler(req({ plantId: PLANT, photoPaths: [P1] }), { ...w.deps, plantIdApiKey: '' });
    assertEquals(res.status, 500);
    assertEquals(await res.json(), { error: 'Something went wrong.' });
  } finally {
    console.error = realError;
  }
  assertEquals(w.calls.filter((c) => c.url.pathname.startsWith('/storage') || c.url.host === 'plant.id').length, 0);
  assertEquals(w.scans, []);
  assertEquals(errors.length, 1);
  assertEquals(JSON.parse(errors[0]).outcome, 'misconfigured');
});
