import type { Deps } from './auth.ts';

const bearer = (d: Deps) => ({ apikey: d.serviceRoleKey, authorization: `Bearer ${d.serviceRoleKey}` });

/** PostgREST call with the service role; non-2xx throws (the handler turns it into a uniform 500). */
export async function rest(d: Deps, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await d.fetch(`${d.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...bearer(d), 'content-type': 'application/json', ...init.headers as Record<string, string> },
  });
  if (!res.ok) throw new Error(`${path.split('?')[0]} failed (${res.status})`);
  return res;
}

export const insertScan = async (d: Deps, row: Record<string, unknown>): Promise<string> =>
  (await (await rest(d, 'scans?select=id', { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify(row) })).json())[0].id;

/** Reads a photo from the private bucket with the service role, as base64 for Plant.id. */
export async function downloadBase64(d: Deps, path: string): Promise<string> {
  const res = await d.fetch(`${d.supabaseUrl}/storage/v1/object/plant-photos/${path}`, { headers: bearer(d) });
  if (!res.ok) throw new Error(`photo download failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
