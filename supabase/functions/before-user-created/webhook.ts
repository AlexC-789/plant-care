// Standard Webhooks signature check (https://www.standardwebhooks.com), using only
// Web Crypto so the function has no runtime dependencies.
const TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True when `webhook-signature` holds a valid `v1,<base64 HMAC-SHA256>` of
 * `${id}.${timestamp}.${payload}` and the timestamp is within 5 minutes.
 * `secret` is in Supabase's form "v1,whsec_<base64 key>"; "whsec_<base64 key>" also works.
 */
export async function verifyWebhook(
  secret: string,
  headers: Headers,
  payload: string,
  now = Date.now(),
): Promise<boolean> {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');
  if (!id || !timestamp || !signatures) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(secret.replace(/^(v1,)?whsec_/, '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = bytesToBase64(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`)),
  );
  return signatures
    .split(' ')
    .some((entry) => entry.startsWith('v1,') && constantTimeEqual(entry.slice(3), expected));
}
