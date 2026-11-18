// device-claim: a module trades the one-time code from the app for its device id and secret (spec §5.1).
// Public (no user JWT): the code is the credential. Only the secret's hash is stored.
import { type Deps, envDeps } from '../_shared/auth.ts';
import { rest } from '../_shared/db.ts';
import { newSecret, sha256Hex } from '../_shared/device_auth.ts';
import { json, jsonError, readJsonBody } from '../_shared/http.ts';

export async function handler(req: Request, deps: Deps): Promise<Response> {
  const requestId = req.headers.get('sb-request-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID();
  let deviceId = '-';
  let outcome = 'error';
  const respond = (res: Response, o: string) => {
    outcome = o;
    return res;
  };
  try {
    if (req.method !== 'POST') return respond(jsonError(405, 'Invalid request.'), 'bad_method');
    const body = await readJsonBody(req);
    if (body instanceof Response) return respond(body, `body_${body.status}`);
    const code = typeof body.code === 'string' ? body.code.toUpperCase().replace(/[\s-]/g, '') : '';
    const fw = body.firmware_version;
    if (
      Object.keys(body).length !== 2 || !/^[2-9A-HJKMNP-Z]{12}$/.test(code) ||
      typeof fw !== 'string' || fw.length < 1 || fw.length > 32
    ) return respond(jsonError(400, 'Invalid request.'), 'bad_request');

    const secret = newSecret();
    const res = await rest(deps, 'rpc/claim_device', {
      method: 'POST',
      body: JSON.stringify({ p_code: code, p_secret_hash: await sha256Hex(secret), p_firmware_version: fw }),
    });
    const out: { device_id?: string; error?: string } = await res.json();
    if (out.error === 'not_found') return respond(jsonError(404, 'Code not found or expired.'), 'not_found');
    if (out.error === 'has_module') return respond(jsonError(409, 'This plant already has a module.'), 'has_module');
    if (!out.device_id) throw new Error('claim_device returned no device');
    deviceId = out.device_id;
    return respond(json({ device_id: deviceId, secret }), 'ok');
  } catch {
    return respond(jsonError(500, 'Something went wrong.'), 'error');
  } finally {
    console.log(JSON.stringify({ fn: 'device-claim', requestId, deviceId, outcome }));
  }
}

if (import.meta.main) Deno.serve((req) => handler(req, envDeps()));
