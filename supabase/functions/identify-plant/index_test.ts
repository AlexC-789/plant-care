import { assert, assertEquals, assertFalse } from '@std/assert';

import { handler, lightFrom, moistureFrom, wateringLine, type IdentifyDeps } from './index.ts';

const fixture = (name: string) => Deno.readTextFileSync(new URL(`../_shared/fixtures/${name}.json`, import.meta.url));
const U = '11111111-1111-1111-1111-111111111111';
const P1 = `${U}/22222222-2222-2222-2222-222222222222.jpg`;
const P2 = `${U}/33333333-3333-3333-3333-333333333333.jpg`;
const KEY = 'sk-secret-key-123';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const JPEG_B64 = btoa(String.fromCharCode(...JPEG));

interface World {
  deps: IdentifyDeps;
  calls: { url: URL; init?: RequestInit }[];
  scans: Record<string, unknown>[];
  speciesPosts: { url: URL; init?: RequestInit; body: Record<string, unknown>[] }[];
  species: Map<string, { id: string; scientific_name: string }>;
}

/** Routes Auth / PostgREST / Storage / Plant.id URLs to in-memory fakes. */
function world(o: { recent?: number; plantId?: () => Response; auth?: Response } = {}): World {
  const w: World = { calls: [], scans: [], speciesPosts: [], species: new Map(), deps: undefined as never };
  const url = (s: string) => new URL(s);
  w.deps = {
    supabaseUrl: 'http://sb',
    serviceRoleKey: 'srk',
    plantIdApiKey: KEY,
    fetch: (input, init) => {
      const u = url(String(input));
      w.calls.push({ url: u, init });
      const method = init?.method ?? 'GET';
      if (u.pathname === '/auth/v1/user') return Promise.resolve(o.auth ?? Response.json({ id: U }));
      if (u.pathname.startsWith('/storage/v1/object/plant-photos/')) return Promise.resolve(new Response(JPEG));
      if (u.host === 'plant.id') return Promise.resolve((o.plantId ?? (() => new Response(fixture('identification'))))());
      if (u.pathname === '/rest/v1/scans' && method === 'HEAD') {
        return Promise.resolve(new Response(null, { headers: { 'content-range': `*/${o.recent ?? 0}` } }));
      }
      if (u.pathname === '/rest/v1/scans' && method === 'POST') {
        const row = JSON.parse(String(init?.body));
        w.scans.push(row);
        return Promise.resolve(Response.json([{ id: 'scan-1' }], { status: 201 }));
      }
      if (u.pathname === '/rest/v1/species' && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        w.speciesPosts.push({ url: u, init, body });
        for (const r of body) {
          if (!w.species.has(r.scientific_name)) w.species.set(r.scientific_name, { id: `sp-${w.species.size}`, scientific_name: r.scientific_name });
        }
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      if (u.pathname === '/rest/v1/species' && method === 'GET') return Promise.resolve(Response.json([...w.species.values()]));
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

Deno.test('unauthenticated is 401 and nothing else is called', async () => {
  const w = world();
  assertEquals((await handler(req({ photoPaths: [P1] }, null), w.deps)).status, 401);
  assertEquals(w.calls.length, 0);
});

Deno.test('auth outage is 503', async () => {
  const w = world({ auth: new Response('x', { status: 500 }) });
  assertEquals((await handler(req({ photoPaths: [P1] }), w.deps)).status, 503);
});

Deno.test('invalid body, unknown fields (incl. plantId) 400; foreign or odd path 403', async () => {
  const w = world();
  for (const b of ['{nope', { photoPaths: [P1], plantId: 'x' }, { photoPaths: [P1], extra: 1 }, {}, { photoPaths: [] }, { photoPaths: [P1, P1, P1, P1] }]) {
    assertEquals((await handler(req(b), w.deps)).status, 400, JSON.stringify(b));
  }
  const other = `22222222-2222-2222-2222-222222222222/22222222-2222-2222-2222-222222222222.jpg`;
  for (const p of [other, `${U}/../x.jpg`]) assertEquals((await handler(req({ photoPaths: [p] }), w.deps)).status, 403);
  assertFalse(w.calls.some((c) => c.url.host === 'plant.id' || c.url.pathname.startsWith('/storage')));
});

Deno.test('20 counted calls: 429 with the spec copy, no provider call; 19 still allowed', async () => {
  const w = world({ recent: 20 });
  const res = await handler(req({ photoPaths: [P1] }), w.deps);
  assertEquals(res.status, 429);
  assertEquals(await res.json(), { error: "You've reached the identification limit for now. Search for the plant type, or try again later." });
  assertFalse(w.calls.some((c) => c.url.host === 'plant.id'));
  assertEquals((await handler(req({ photoPaths: [P1] }), world({ recent: 19 }).deps)).status, 200);
});

Deno.test('success: request carries all images, no health; species created; scan stored; response shape', async () => {
  const w = world();
  const res = await handler(req({ photoPaths: [P1, P2] }), w.deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(Object.keys(body).sort(), ['isPlant', 'scanId', 'suggestions']);
  assertEquals(body.scanId, 'scan-1');
  assertEquals(body.isPlant, true);
  assertEquals(Object.keys(body.suggestions[0]).sort(), ['commonName', 'confidence', 'scientificName', 'speciesId']);
  assertEquals(body.suggestions[0].scientificName, 'Monstera deliciosa');
  assertEquals(body.suggestions[0].commonName, 'Swiss cheese plant');
  assertEquals(body.suggestions[0].confidence, 'very_likely');

  const pid = w.calls.filter((c) => c.url.host === 'plant.id');
  assertEquals(pid.length, 1);
  assertEquals(pid[0].url.pathname, '/api/v3/identification');
  assertFalse(pid[0].url.pathname.includes('health'));
  assertEquals(JSON.parse(String(pid[0].init?.body)).images, [JPEG_B64, JPEG_B64]);
  const storage = w.calls.filter((c) => c.url.pathname.startsWith('/storage'));
  assertEquals(storage.map((c) => c.url.pathname), [P1, P2].map((p) => `/storage/v1/object/plant-photos/${p}`));
  assertEquals((storage[0].init?.headers as Record<string, string>).authorization, 'Bearer srk');

  const post = w.speciesPosts[0];
  assertEquals(post.url.searchParams.get('on_conflict'), 'scientific_name');
  assert((post.init?.headers as Record<string, string>).prefer.includes('resolution=ignore-duplicates'));
  assert(post.body.every((r) => r.origin === 'plantid' && r.plantid_name === r.scientific_name));
  assertEquals(post.body[0].description, 'Monstera deliciosa is a species of flowering plant native to tropical forests of southern Mexico.');
  // watering {1,2} -> avg 1.5 -> moderate; light prose contains "shade" -> low (ruling: first keyword match in order)
  assertEquals([post.body[0].moisture_category, post.body[0].watering, post.body[0].light], ['moderate', 'Water when the top few centimetres of soil are dry.', 'bright_indirect']);

  assertEquals(w.scans.length, 1);
  const s = w.scans[0];
  assertEquals([s.kind, s.status, s.user_id, s.photo_paths], ['identify', 'ok', U, [P1, P2]]);
  assertEquals(s.plant_id ?? null, null);
  assertEquals(s.suggestions, body.suggestions);
  assertFalse(JSON.stringify(body).includes(KEY));
});

Deno.test('existing species (curated) is matched, never overwritten; repeat is idempotent', async () => {
  const w = world();
  w.species.set('Monstera deliciosa', { id: 'curated-1', scientific_name: 'Monstera deliciosa' });
  const body = await (await handler(req({ photoPaths: [P1] }), w.deps)).json();
  assertEquals(body.suggestions[0].speciesId, 'curated-1');
  const n = w.species.size;
  await handler(req({ photoPaths: [P1] }), w.deps);
  assertEquals(w.species.size, n);
  // every insert is ignore-duplicates, so PostgREST never updates an existing row
  assert(w.speciesPosts.every((p) => (p.init?.headers as Record<string, string>).prefer.includes('ignore-duplicates')));
});

Deno.test('not a plant: isPlant false, no suggestions, status not_plant', async () => {
  const w = world({ plantId: () => new Response(fixture('identification_not_plant')) });
  const body = await (await handler(req({ photoPaths: [P1] }), w.deps)).json();
  assertEquals([body.isPlant, body.suggestions], [false, []]);
  assertEquals(w.scans[0].status, 'not_plant');
  assertEquals(w.speciesPosts.length, 0);
});

Deno.test('provider failure: 502 uniform body, error scan stored, no key leaked', async () => {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    const w = world({ plantId: () => new Response(`boom ${KEY}`, { status: 401 }) });
    const res = await handler(req({ photoPaths: [P1] }), w.deps);
    assertEquals(res.status, 502);
    assertEquals(await res.json(), { error: "Couldn't identify right now. Try again." });
    assertEquals(w.scans.map((s) => s.status), ['error']);
    const out = logs.join('\n');
    assert(out.includes(U) && out.includes('provider_error'));
    assertEquals(JSON.parse(logs[0]).status, 401);
    for (const secret of [KEY, 'srk', JPEG_B64]) assertFalse(out.includes(secret));
  } finally {
    console.log = orig;
  }
});

Deno.test('unexpected failure: 500 uniform body, no stack', async () => {
  const w = world();
  const inner = w.deps.fetch;
  w.deps.fetch = (i, init) => String(i).includes('/storage/') ? Promise.reject(new Error('disk on fire at /srv/secret.ts')) : inner(i, init);
  const res = await handler(req({ photoPaths: [P1] }), w.deps);
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'Something went wrong.' });
});

Deno.test('free details map to our enums', () => {
  assertEquals([{ min: 1, max: 1 }, { min: 1, max: 2 }, { min: 2, max: 3 }, { min: 3, max: 3 }, undefined].map(moistureFrom), ['dry', 'moderate', 'moderate', 'moist', null]);
  assertEquals((['dry', 'moderate', 'moist', null] as const).map((m) => wateringLine(m)), [
    'Let the soil dry out between waterings.', 'Water when the top few centimetres of soil are dry.', 'Keep the soil evenly moist.', null,
  ]);
  assertEquals(
    ['Full sun', 'Needs direct sun', 'Low light or shade', 'Bright indirect light. Tolerates some shade.', 'Partial light', 'Medium', 'Sunny', undefined].map(lightFrom),
    ['direct', 'direct', 'low', 'bright_indirect', 'medium', 'medium', null, null],
  );
});

Deno.test('new species stores watering details; an unmappable one stores nulls', async () => {
  const w = world({ plantId: () => Response.json({ result: { is_plant: { probability: 0.9 }, classification: { suggestions: [
    { name: 'Ficus lyrata', probability: 0.8, details: { common_names: ['Fiddle-leaf fig'], watering: { min: 3, max: 3 }, best_light_condition: 'Bright light' } },
    { name: 'Bare thing', probability: 0.5, details: {} },
  ] } } }) });
  await handler(req({ photoPaths: [P1] }), w.deps);
  const [a, b] = w.speciesPosts[0].body;
  assertEquals([a.moisture_category, a.watering, a.light], ['moist', 'Keep the soil evenly moist.', 'bright_indirect']);
  assertEquals([b.moisture_category, b.watering, b.light], [null, null, null]);
});

Deno.test('missing PLANT_ID_API_KEY is a uniform 500 before any download or scan, logged as misconfigured', async () => {
  const w = world();
  const errors: string[] = [];
  const realError = console.error;
  console.error = (...a: unknown[]) => void errors.push(a.join(' '));
  try {
    const res = await handler(req({ photoPaths: [P1] }), { ...w.deps, plantIdApiKey: '' });
    assertEquals(res.status, 500);
    assertEquals(await res.json(), { error: 'Something went wrong.' });
  } finally {
    console.error = realError;
  }
  assertFalse(w.calls.some((c) => c.url.pathname.startsWith('/storage') || c.url.host === 'plant.id'));
  assertEquals(w.scans, []);
  assertEquals(errors.length, 1);
  assertEquals(JSON.parse(errors[0]).outcome, 'misconfigured');
});
