import { assert, assertEquals, assertNotEquals } from '@std/assert';

import { newSecret, sha256Hex } from './device_auth.ts';

Deno.test('newSecret is 43 base64url chars and unique', () => {
  const a = newSecret();
  assertEquals(a.length, 43);
  assert(/^[A-Za-z0-9_-]{43}$/.test(a));
  assertNotEquals(a, newSecret());
});

Deno.test('sha256Hex is lowercase hex', async () => {
  assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
