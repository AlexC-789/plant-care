import { assert, assertEquals } from '@std/assert';

import { handler } from './index.ts';
import type { Deps } from '../_shared/auth.ts';
import { sha256Hex } from '../_shared/device_auth.ts';

const DEVICE = '22222222-2222-2222-2222-222222222222';

function world(rpc: () => Response = () => Response.json({ device_id: DEVICE })) {
  const bodies: Record<string, string>[] = [];
  const deps: Deps = {
    supabaseUrl: 'http://sb',
    serviceRoleKey: 'srk',
    fetch: (input, init) => {
      const u = new URL(String(input));
      if (u.pathname !== '/rest/v1/rpc/claim_device') return Promise.resolve(new Response('unexpected', { status: 500 }));
      bodies.push(JSON.parse(String(init?.body)));
      return Promise.resolve(rpc());
    },
  };
  return { deps, bodies };
}

const req = (body: unknown, method = 'POST') =>
  new Request('http://x/', { method, body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
const ok = { code: 'K7P4QM2X9RTD', firmware_version: 'sim-0.1.0' };

const realLog = console.log;
console.log = () => {};
addEventListener('unload', () => (console.log = realLog));

Deno.test('claims a valid code and returns a 43-char secret whose hash was sent', async () => {
  const w = world();
  const res = await handler(req(ok), w.deps);
  assertEquals(res.status, 200);
  const { device_id, secret } = await res.json();
  assertEquals(device_id, DEVICE);
  assertEquals(secret.length, 43);
  assertEquals(w.bodies[0].p_secret_hash, await sha256Hex(secret));
  assertEquals(w.bodies[0].p_firmware_version, 'sim-0.1.0');
  assert(!JSON.stringify(w.bodies[0]).includes(secret));
});

Deno.test('normalises a hand-typed code', async () => {
  const w = world();
  await handler(req({ ...ok, code: 'k7p4-qm2x 9rtd' }), w.deps);
  assertEquals(w.bodies[0].p_code, 'K7P4QM2X9RTD');
});

Deno.test('rejects characters outside the alphabet without calling the database', async () => {
  const w = world();
  for (const code of ['O7P4QM2X9RTD', 'K7P4QM2X9RT', 'K7P4QM2X9RTDD', '17P4QM2X9RTD']) {
    assertEquals((await handler(req({ ...ok, code }), w.deps)).status, 400, code);
  }
  assertEquals(w.bodies.length, 0);
});

Deno.test('rejects unknown fields, wrong types, bad firmware_version', async () => {
  const w = world();
  const bad = ['{nope', {}, { ...ok, extra: 1 }, { code: ok.code }, { ...ok, code: 5 }, { ...ok, firmware_version: 1 },
    { ...ok, firmware_version: '' }, { ...ok, firmware_version: 'x'.repeat(33) }];
  for (const b of bad) assertEquals((await handler(req(b), w.deps)).status, 400, JSON.stringify(b));
  assertEquals(w.bodies.length, 0);
});

Deno.test('maps not_found to 404 and has_module to 409', async () => {
  const nf = await handler(req(ok), world(() => Response.json({ error: 'not_found' })).deps);
  assertEquals(nf.status, 404);
  assertEquals(await nf.json(), { error: 'Code not found or expired.' });
  const hm = await handler(req(ok), world(() => Response.json({ error: 'has_module' })).deps);
  assertEquals(hm.status, 409);
  assertEquals(await hm.json(), { error: 'This plant already has a module.' });
});

Deno.test('returns a uniform 500 when the RPC fails', async () => {
  const res = await handler(req(ok), world(() => new Response('boom', { status: 500 })).deps);
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'Something went wrong.' });
});

Deno.test('405 on GET', async () => {
  assertEquals((await handler(req(null, 'GET'), world().deps)).status, 405);
});
