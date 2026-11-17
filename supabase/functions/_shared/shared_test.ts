import { assert, assertEquals, assertInstanceOf, assertRejects } from '@std/assert';

import { requireUser, type Deps } from './auth.ts';
import { json, jsonError, readJsonBody } from './http.ts';
import { healthNote, HEALTHY_NOTE, UNSURE_NOTE } from './health_notes.ts';
import { countRecentPlantIdCalls, PLANT_ID_DAILY_LIMIT, searchAllowed } from './limits.ts';
import { confidenceWord, PlantIdClient, ProviderError } from './plantid.ts';
import { validatePhotoPaths } from './validate.ts';

const fixture = (name: string) => Deno.readTextFileSync(new URL(`./fixtures/${name}.json`, import.meta.url));
const U = '11111111-1111-1111-1111-111111111111';
const P = '22222222-2222-2222-2222-222222222222';
const post = (body: BodyInit, headers: HeadersInit = {}) => new Request('http://x/', { method: 'POST', body, headers });

Deno.test('jsonError has only { error }', async () => {
  assertEquals(await jsonError(403, 'Nope').json(), { error: 'Nope' });
  assertEquals(json({ a: 1 }, 201).status, 201);
});

Deno.test('readJsonBody: ok, 413 by header, 413 by real size, 400 invalid / non-object', async () => {
  assertEquals(await readJsonBody(post('{"a":1}')), { a: 1 });
  const big = JSON.stringify({ a: 'x'.repeat(200) });
  assertEquals((await readJsonBody(post(big, { 'content-length': '999999' }), 100) as Response).status, 413);
  // a lying (small) header does not help
  assertEquals((await readJsonBody(post(big, { 'content-length': '5' }), 100) as Response).status, 413);
  for (const bad of ['{nope', '[1]', '"s"', 'null', '']) {
    assertEquals((await readJsonBody(post(bad)) as Response).status, 400, bad);
  }
});

const goodPath = `${U}/${P}.jpg`;
Deno.test('validatePhotoPaths', () => {
  assertEquals(validatePhotoPaths([goodPath], U, 3), [goodPath]);
  for (const bad of [undefined, 'x', [], [1], [goodPath, goodPath, goodPath, goodPath]]) {
    assertEquals((validatePhotoPaths(bad, U, 3) as Response).status, 400);
  }
  for (const bad of [
    `${P}/${P}.jpg`, // other user's prefix
    `${U}/../${P}.jpg`,
    `${U}/${P}.png`,
    `${U}/${P}.jpg/../x`,
    `../${U}/${P}.jpg`,
    `${U}/${P}.jpg\n`,
    `${U}/short.jpg`,
  ]) {
    assertEquals((validatePhotoPaths([bad], U, 3) as Response).status, 403, bad);
  }
});

function deps(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>): Deps & { calls: [URL, RequestInit | undefined][] } {
  const calls: [URL, RequestInit | undefined][] = [];
  return {
    supabaseUrl: 'http://sb',
    serviceRoleKey: 'srk',
    calls,
    fetch: (input, init) => {
      const url = new URL(String(input));
      calls.push([url, init]);
      return Promise.resolve(handler(url, init));
    },
  };
}

Deno.test('requireUser: valid token, missing header, rejected token, unreachable auth', async () => {
  const ok = deps(() => json({ id: U }));
  const req = new Request('http://x/', { headers: { authorization: 'Bearer tok' } });
  assertEquals(await requireUser(req, ok), { userId: U });
  assertEquals(ok.calls[0][0].pathname, '/auth/v1/user');
  assertEquals((await requireUser(new Request('http://x/'), ok) as Response).status, 401);
  assertEquals((await requireUser(req, deps(() => json({}, 401))) as Response).status, 401);
  assertEquals((await requireUser(req, deps(() => json({}, 403))) as Response).status, 401);
});

Deno.test('requireUser: auth outage is 503, missing env is 500', async () => {
  const req = new Request('http://x/', { headers: { authorization: 'Bearer tok' } });
  assertEquals((await requireUser(req, deps(() => { throw new Error('down'); })) as Response).status, 503);
  assertEquals((await requireUser(req, deps(() => json({}, 500))) as Response).status, 503);
  assertEquals((await requireUser(req, { ...deps(() => json({ id: U })), serviceRoleKey: '' }) as Response).status, 500);
  assertEquals((await requireUser(req, { ...deps(() => json({ id: U })), supabaseUrl: '' }) as Response).status, 500);
});

Deno.test('countRecentPlantIdCalls queries ok + not_plant in the last 24h', async () => {
  const d = deps(() => new Response(null, { headers: { 'content-range': '*/7' } }));
  assertEquals(await countRecentPlantIdCalls(d, U), 7);
  const q = d.calls[0][0];
  assertEquals(q.searchParams.get('status'), 'in.(ok,not_plant)');
  assertEquals(q.searchParams.get('user_id'), `eq.${U}`);
  assert(Date.now() - Date.parse(q.searchParams.get('created_at')!.slice(3)) - 24 * 3600_000 < 5000);
  assertEquals(PLANT_ID_DAILY_LIMIT, 20);
  await assertRejects(() => countRecentPlantIdCalls(deps(() => new Response(null, { status: 500 })), U));
});

Deno.test('searchAllowed: 120th ok and logged, 121st refused and not logged', async () => {
  const at = (n: number) => deps((_u, init) => init?.method === 'HEAD' ? new Response(null, { headers: { 'content-range': `*/${n}` } }) : new Response(null, { status: 201 }));
  const under = at(119);
  assertEquals(await searchAllowed(under, U), true);
  assertEquals(under.calls.at(-1)![1]?.method, 'POST');
  const over = at(120);
  assertEquals(await searchAllowed(over, U), false);
  assertEquals(over.calls.length, 1);
});

Deno.test('confidenceWord boundaries', () => {
  assertEquals([0.7, 0.699, 0.35, 0.349, 0.05, 1].map(confidenceWord), ['very_likely', 'likely', 'likely', 'possibly', 'possibly', 'very_likely']);
});

const KEY = 'sk-secret-key-123';
const client = (h: (url: URL, init?: RequestInit) => Response | Promise<Response>, timeoutMs?: number) =>
  new PlantIdClient({ apiKey: KEY, timeoutMs, fetch: (i, init) => Promise.resolve(h(new URL(String(i)), init)) });

Deno.test('identify: request shape and mapping (drop <0.05, max 3, free details)', async () => {
  let seen: { url: URL; init?: RequestInit } | undefined;
  const r = await client((url, init) => { seen = { url, init }; return new Response(fixture('identification')); }).identify(['a', 'b']);
  assertEquals(seen!.url.pathname, '/api/v3/identification');
  assertEquals(seen!.url.searchParams.get('details'), 'common_names,description,watering,best_light_condition');
  assertEquals(JSON.parse(String(seen!.init?.body)), { images: ['a', 'b'], similar_images: false });
  assertEquals((seen!.init?.headers as Record<string, string>)['Api-Key'], KEY);
  assertEquals(r.isPlant, true);
  assertEquals(r.suggestions.map((s) => [s.scientificName, s.confidence]), [
    ['Monstera deliciosa', 'very_likely'], ['Monstera adansonii', 'likely'], ['Philodendron bipinnatifidum', 'possibly'],
  ]);
  assertEquals(r.suggestions[0].commonNames, ['Swiss cheese plant', 'Split-leaf philodendron']);
  assertEquals(r.suggestions[0].details.description?.startsWith('Monstera deliciosa is'), true);
  assertEquals(r.suggestions[0].details.watering, { min: 1, max: 2 });
  assertEquals(r.suggestions[0].details.bestLight, 'Bright indirect light. Tolerates some shade.');
  assertEquals(r.suggestions[1].details, {});
});

Deno.test('identify: is_plant < 0.5 gives no suggestions', async () => {
  const r = await client(() => new Response(fixture('identification_not_plant'))).identify(['a']);
  assertEquals(r.isPlant, false);
  assertEquals(r.suggestions, []);
});

Deno.test('health and nameSearch map the documented shapes', async () => {
  let path = '';
  const c = client((url) => {
    path = url.pathname + url.search;
    return new Response(fixture(url.pathname.includes('health') ? 'health_assessment' : 'name_search'));
  });
  const h = await c.health(['a']);
  assertEquals(path, '/api/v3/health_assessment');
  assertEquals(h.isHealthyProbability, 0.14163023233413696);
  assertEquals(h.isPlantProbability, 1);
  assertEquals(h.issues[0], { name: 'water excess or uneven watering', probability: 0.51401126 });
  const hits = await c.nameSearch('swiss & cheese');
  assertEquals(path, '/api/v3/kb/plants/name_search?q=swiss%20%26%20cheese&limit=10');
  // fixture has no entity_name: common-name-only hits are dropped, the entity_name match stays
  assertEquals(hits, [{ commonName: '', scientificName: 'Swissia exemplum' }]);
});

Deno.test('provider failures become ProviderError without key or provider body', async () => {
  const leaks = [
    client(() => new Response(`oops ${KEY} provider says no`, { status: 500 })),
    client(() => { throw new Error(`network ${KEY}`); }),
    client(() => new Response('not json')),
  ];
  for (const c of leaks) {
    const e = await assertRejects(() => c.identify(['a']), ProviderError);
    assert(!e.message.includes(KEY) && !e.message.includes('provider says') && !String(e.stack).includes(KEY));
  }
});

Deno.test('timeout aborts into ProviderError', async () => {
  const slow = client((_u, init) => new Promise<Response>((_res, rej) => init!.signal!.addEventListener('abort', () => rej(init!.signal!.reason))) as unknown as Response, 20);
  assertInstanceOf(await slow.identify(['a']).catch((e) => e), ProviderError);
});

Deno.test('a failing call logs nothing containing the key', async () => {
  const lines: string[] = [];
  const orig = [console.log, console.error, console.warn];
  console.log = console.error = console.warn = (...a: unknown[]) => void lines.push(a.join(' '));
  try {
    await client(() => new Response(KEY, { status: 401 })).health(['a']).catch(() => {});
  } finally {
    [console.log, console.error, console.warn] = orig;
  }
  assertEquals(lines.filter((l) => l.includes(KEY)), []);
});

Deno.test('nameSearch makes exactly one request; entity_name is used, deduped and clamped to 10', async () => {
  let calls = 0;
  const entities = [
    { matched_in: 'Swiss cheese plant', matched_in_type: 'common_name', entity_name: 'Monstera deliciosa' },
    { matched_in: 'Monstera deliciosa', matched_in_type: 'entity_name', entity_name: 'Monstera deliciosa' },
    ...Array.from({ length: 12 }, (_, i) => ({ matched_in: `Genus ${i}`, matched_in_type: 'entity_name' })),
  ];
  const hits = await client(() => { calls++; return new Response(JSON.stringify({ entities })); }).nameSearch('m');
  assertEquals(calls, 1);
  assertEquals(hits.length, 10);
  assertEquals(hits[0], { commonName: 'Swiss cheese plant', scientificName: 'Monstera deliciosa' });
});

Deno.test('health: issues sorted by probability desc, non-finite dropped; missing is_plant is 0', async () => {
  const h = await client(() => Response.json({ result: { is_healthy: { probability: 0.2 }, disease: { suggestions: [
    { name: 'fungi', probability: 0.3 },
    { name: 'bad', probability: 'x' },
    { name: 'nan', probability: null },
    { name: 'water deficiency', probability: 0.6 },
  ] } } })).health(['a']);
  assertEquals(h.issues, [{ name: 'water deficiency', probability: 0.6 }, { name: 'fungi', probability: 0.3 }]);
  assertEquals(h.isPlantProbability, 0);
});

Deno.test('healthNote: healthy >= 0.8, mapped top issue >= 0.5, otherwise unsure; never a raw name', () => {
  const r = (isHealthyProbability: number, issues: { name: string; probability: number }[] = []) =>
    ({ isPlantProbability: 1, isHealthyProbability, issues });
  assertEquals(HEALTHY_NOTE, 'It looks healthy in this photo.');
  assertEquals(UNSURE_NOTE, "Couldn't tell from this photo. Try one with the leaves in view.");
  assertEquals(healthNote(r(0.8)), { healthy: true, note: HEALTHY_NOTE, advice: null });
  assertEquals(healthNote(r(0.79, [{ name: 'water excess or uneven watering', probability: 0.5 }])), {
    healthy: false,
    note: 'Some leaves look yellow. Often too much water.',
    advice: 'Let the top few centimetres of soil dry before watering again.',
  });
  // case-insensitive on the provider name
  assertEquals(healthNote(r(0.1, [{ name: 'Water Deficiency', probability: 0.9 }])).healthy, false);
  const unsure = { healthy: null, note: UNSURE_NOTE, advice: null };
  assertEquals(healthNote(r(0.1, [{ name: 'fungi', probability: 0.49 }])), unsure);
  assertEquals(healthNote(r(0.1, [{ name: 'Some Obscure Pathogen', probability: 0.9 }])), unsure);
  assertEquals(healthNote(r(0.1, [{ name: 'constructor', probability: 0.9 }])), unsure);
  assertEquals(healthNote(r(0.1)), unsure);
});
