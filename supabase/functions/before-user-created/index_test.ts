import { assertEquals } from '@std/assert';
import { Webhook } from 'standardwebhooks';

import { handler } from './index.ts';
import type { Lookup } from './check.ts';

// Base64 of a dev-only key, in the same shape Supabase uses ("v1,whsec_<base64>").
const SECRET = 'v1,whsec_' + btoa('local-test-secret-0123456789abcd');
const lookup: Lookup = (domain, type) =>
  Promise.resolve(domain === 'gmail.com' && type === 'MX' ? ['mx'] : []);

function signedRequest(email: string, secret = SECRET): Request {
  const body = JSON.stringify({ user: { email }, metadata: { name: 'before-user-created' } });
  const id = 'msg_1';
  const timestamp = new Date();
  const signature = new Webhook(secret.replace('v1,whsec_', '')).sign(id, timestamp, body);
  return new Request('http://localhost/before-user-created', {
    method: 'POST',
    body,
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': signature,
    },
  });
}

Deno.test('unsigned requests are rejected with 401', async () => {
  const req = new Request('http://localhost/', {
    method: 'POST',
    body: JSON.stringify({ user: { email: 'x@gmail.com' } }),
  });
  const res = await handler(req, { secret: SECRET, lookup });
  assertEquals(res.status, 401);
});

Deno.test('requests signed with another secret are rejected with 401', async () => {
  const other = 'v1,whsec_' + btoa('some-other-secret-0123456789abcd');
  const res = await handler(signedRequest('x@gmail.com', other), { secret: SECRET, lookup });
  assertEquals(res.status, 401);
});

Deno.test('an acceptable email is allowed with an empty object', async () => {
  const res = await handler(signedRequest('maya@gmail.com'), { secret: SECRET, lookup });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {});
});

Deno.test('a disposable email is rejected with a 400 hook error', async () => {
  const res = await handler(signedRequest('x@mailinator.com'), { secret: SECRET, lookup });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    error: {
      http_code: 400,
      message: "Use a permanent email address. Temporary inboxes can't be used.",
    },
  });
});

Deno.test('a correctly signed but stale request (over 5 minutes old) is rejected', async () => {
  const body = JSON.stringify({ user: { email: 'maya@gmail.com' } });
  const old = new Date(Date.now() - 10 * 60 * 1000);
  const signature = new Webhook(SECRET.replace('v1,whsec_', '')).sign('msg_2', old, body);
  const req = new Request('http://localhost/', {
    method: 'POST',
    body,
    headers: {
      'webhook-id': 'msg_2',
      'webhook-timestamp': String(Math.floor(old.getTime() / 1000)),
      'webhook-signature': signature,
    },
  });
  const res = await handler(req, { secret: SECRET, lookup });
  assertEquals(res.status, 401);
});
