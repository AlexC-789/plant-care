import { assert, assertEquals } from '@std/assert';

import { handler } from './index.ts';
import type { Deps } from '../_shared/auth.ts';

const U = '11111111-1111-1111-1111-111111111111';
const KEY = 'sk-secret-key-123';

interface World {
  deps: Deps & { plantIdApiKey: string };
  calls: { url: URL; init?: RequestInit }[];
  speciesPosts: { url: URL; body: Record<string, unknown> }[];
}

const entity = (i: number) => ({ matched_in: `Name ${i}`, matched_in_type: 'common_name', entity_name: `Genus sp${i}` });

function world(o: { recent?: number; plantId?: () => Response } = {}): World {
  const species = new Map<string, string>();
  const w: World = { calls: [], speciesPosts: [], deps: undefined as never };
  w.deps = {
    supabaseUrl: 'http://sb',
    serviceRoleKey: 'srk',
    plantIdApiKey: KEY,
    fetch: (input, init) => {
      const u = new URL(String(input));
      w.calls.push({ url: u, init });
      const method = init?.method ?? 'GET';
      if (u.pathname === '/auth/v1/user') return Promise.resolve(Response.json({ id: U }));
      if (u.host === 'plant.id') {
        return Promise.resolve(
          (o.plantId ?? (() => Response.json({ entities: Array.from({ length: 15 }, (_, i) => entity(i)) })))(),
        );
      }
      if (u.pathname === '/rest/v1/search_log' && method === 'HEAD') {
        return Promise.resolve(new Response(null, { headers: { 'content-range': `*/${o.recent ?? 0}` } }));
      }
      if (u.pathname === '/rest/v1/search_log' && method === 'POST') return Promise.resolve(new Response(null, { status: 201 }));
      if (u.pathname === '/rest/v1/species' && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        w.speciesPosts.push({ url: u, body });
        const name = (Array.isArray(body) ? body[0] : body).scientific_name;
        if (!species.has(name)) species.set(name, `sp-${species.size}`);
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      if (u.pathname === '/rest/v1/species' && method === 'GET') {
        const name = u.searchParams.get('scientific_name')!.replace(/^eq\./, '');
        return Promise.resolve(Response.json(species.has(name) ? [{ id: species.get(name) }] : []));
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

const plantIdCalls = (w: World) => w.calls.filter((c) => c.url.host === 'plant.id').length;

const realLog = console.log;
console.log = () => {};
addEventListener('unload', () => (console.log = realLog));

Deno.test('unauthenticated is 401 and nothing else is called', async () => {
  const w = world();
  assertEquals((await handler(req({ query: 'monstera' }, null), w.deps)).status, 401);
  assertEquals(w.calls.length, 0);
});

Deno.test('body must be exactly one of query / pick, with valid lengths', async () => {
  const w = world();
  const bad = [
    '{nope', {}, { query: 'ok', pick: 'Ficus lyrata' }, { query: 'ok', extra: 1 }, { pick: 'Ficus lyrata', extra: 1 },
    { query: 'a' }, { query: ' a ' }, { query: 'x'.repeat(61) }, { query: 5 },
    { pick: 'a' }, { pick: 'x'.repeat(121) }, { pick: 5 }, { pick: ' ' },
  ];
  for (const b of bad) assertEquals((await handler(req(b), w.deps)).status, 400, JSON.stringify(b));
  assertEquals(w.calls.filter((c) => c.url.host !== 'sb' || c.url.pathname !== '/auth/v1/user').length, 0);
});

Deno.test('query returns hits clamped to 10, trimmed, and uses one free Plant.id call', async () => {
  const w = world();
  const res = await handler(req({ query: '  mons  ' }), w.deps);
  assertEquals(res.status, 200);
  const { hits } = await res.json();
  assertEquals(hits.length, 10);
  assertEquals(hits[0], { commonName: 'Name 0', scientificName: 'Genus sp0' });
  assertEquals(plantIdCalls(w), 1);
  assert(w.calls.find((c) => c.url.host === 'plant.id')!.url.search.includes('q=mons&'));
});

Deno.test('the 121st search in an hour is 429 and Plant.id is not called', async () => {
  const w = world({ recent: 120 });
  const res = await handler(req({ query: 'monstera' }), w.deps);
  assertEquals(res.status, 429);
  assertEquals(await res.json(), { error: 'Too many searches. Try again in a few minutes.' });
  assertEquals(plantIdCalls(w), 0);
});

Deno.test('Plant.id failure is a uniform 502 with no provider text or key', async () => {
  const w = world({ plantId: () => new Response(`boom ${KEY}`, { status: 500 }) });
  const res = await handler(req({ query: 'monstera' }), w.deps);
  assertEquals(res.status, 502);
  const text = await res.text();
  assertEquals(JSON.parse(text), { error: "Couldn't search right now. Try again." });
  assert(!text.includes(KEY));
});

Deno.test('pick stores a names-only plantid species, is idempotent, never calls Plant.id or counts as a search', async () => {
  const w = world({ recent: 500 });
  const a = await (await handler(req({ pick: ' Ficus lyrata ' }), w.deps)).json();
  const b = await (await handler(req({ pick: 'Ficus lyrata' }), w.deps)).json();
  assertEquals(a, { speciesId: 'sp-0' });
  assertEquals(b, a);
  assertEquals(plantIdCalls(w), 0);
  assertEquals(w.calls.some((c) => c.url.pathname === '/rest/v1/search_log'), false);
  const post = w.speciesPosts[0];
  assertEquals(post.body, { scientific_name: 'Ficus lyrata', common_names: [], origin: 'plantid', plantid_name: 'Ficus lyrata' });
  assert(post.url.search.includes('on_conflict=scientific_name'));
  const init = w.calls.find((c) => c.url.pathname === '/rest/v1/species')!.init!;
  assert(String((init.headers as Record<string, string>).prefer).includes('resolution=ignore-duplicates'));
});

Deno.test('pick with quotes or odd characters is stored as a literal name and looked up by exact match', async () => {
  const w = world();
  const res = await handler(req({ pick: 'Ficus "x" & y=z' }), w.deps);
  assertEquals(res.status, 200);
  assertEquals(w.speciesPosts[0].body.scientific_name, 'Ficus "x" & y=z');
});
