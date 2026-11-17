// identify-plant: the single boundary between the app and Plant.id (spec §7, §8a).
// Body is exactly { photoPaths }; photos travel via Storage, never the body.
import { type Deps, envDeps, requireUser } from '../_shared/auth.ts';
import { json, jsonError, readJsonBody } from '../_shared/http.ts';
import { countRecentPlantIdCalls, PLANT_ID_DAILY_LIMIT } from '../_shared/limits.ts';
import { PlantIdClient, ProviderError } from '../_shared/plantid.ts';
import { validatePhotoPaths } from '../_shared/validate.ts';

export interface IdentifyDeps extends Deps {
  plantIdApiKey: string;
}

const LIMIT_MESSAGE = "You've reached the identification limit for now. Search for the plant type, or try again later.";

type Moisture = 'dry' | 'moderate' | 'moist';
// Plant.id watering is 1 (dry) .. 3 (wet)
export const moistureFrom = (w?: { min: number; max: number }): Moisture | null => {
  if (!w) return null;
  const avg = (w.min + w.max) / 2;
  return avg < 1.5 ? 'dry' : avg <= 2.5 ? 'moderate' : 'moist';
};
const WATERING: Record<Moisture, string> = {
  dry: 'Let the soil dry out between waterings.',
  moderate: 'Water when the top few centimetres of soil are dry.',
  moist: 'Keep the soil evenly moist.',
};
export const wateringLine = (m: Moisture | null): string | null => (m ? WATERING[m] : null);
// shortcut: keyword match on Plant.id's prose, first match wins ("bright indirect, tolerates shade" reads as low); refine against real responses.
const LIGHT: [string[], string][] = [
  [['full sun', 'direct sun'], 'direct'],
  [['shade', 'low light'], 'low'],
  [['indirect', 'bright'], 'bright_indirect'],
  [['partial', 'medium'], 'medium'],
];
export const lightFrom = (text?: string): string | null => {
  const t = text?.toLowerCase() ?? '';
  return LIGHT.find(([words]) => words.some((w) => t.includes(w)))?.[1] ?? null;
};

const bearer = (d: Deps) => ({ apikey: d.serviceRoleKey, authorization: `Bearer ${d.serviceRoleKey}` });

async function downloadBase64(d: Deps, path: string): Promise<string> {
  const res = await d.fetch(`${d.supabaseUrl}/storage/v1/object/plant-photos/${path}`, { headers: bearer(d) });
  if (!res.ok) throw new Error(`photo download failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function rest(d: Deps, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await d.fetch(`${d.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...bearer(d), 'content-type': 'application/json', ...init.headers as Record<string, string> },
  });
  if (!res.ok) throw new Error(`${path.split('?')[0]} failed (${res.status})`);
  return res;
}

const insertScan = async (d: Deps, row: Record<string, unknown>): Promise<string> =>
  (await (await rest(d, 'scans?select=id', { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify(row) })).json())[0].id;

/** Ensures a species row per name and returns name -> id. Existing (curated) rows are never touched. */
async function speciesIds(d: Deps, rows: Record<string, unknown>[]): Promise<Map<string, string>> {
  await rest(d, 'species?on_conflict=scientific_name', {
    method: 'POST',
    headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  // quoted list; a name can't contain a double quote or backslash through this path
  const names = rows.map((r) => `"${String(r.scientific_name).replace(/["\\]/g, '')}"`).join(',');
  const found: { id: string; scientific_name: string }[] =
    await (await rest(d, `species?select=id,scientific_name&scientific_name=in.(${encodeURIComponent(names)})`)).json();
  return new Map(found.map((s) => [s.scientific_name, s.id]));
}

export async function handler(req: Request, deps: IdentifyDeps): Promise<Response> {
  const requestId = req.headers.get('sb-request-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID();
  let userId = '-';
  let outcome = 'error';
  const respond = (res: Response, o: string) => {
    outcome = o;
    return res;
  };
  try {
    if (req.method !== 'POST') return respond(jsonError(405, 'Invalid request.'), 'bad_method');
    const user = await requireUser(req, deps);
    if (user instanceof Response) return respond(user, `auth_${user.status}`);
    userId = user.userId;

    const body = await readJsonBody(req);
    if (body instanceof Response) return respond(body, `body_${body.status}`);
    if (Object.keys(body).some((k) => k !== 'photoPaths')) return respond(jsonError(400, 'Invalid request.'), 'bad_fields');
    const paths = validatePhotoPaths(body.photoPaths, userId, 3);
    if (paths instanceof Response) return respond(paths, `paths_${paths.status}`);

    if ((await countRecentPlantIdCalls(deps, userId)) >= PLANT_ID_DAILY_LIMIT) {
      return respond(jsonError(429, LIMIT_MESSAGE), 'limited');
    }

    const images = await Promise.all(paths.map((p) => downloadBase64(deps, p)));
    const scan = { user_id: userId, kind: 'identify', photo_paths: paths };
    let result;
    try {
      result = await new PlantIdClient({ apiKey: deps.plantIdApiKey, fetch: deps.fetch }).identify(images);
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      await insertScan(deps, { ...scan, status: 'error' });
      return respond(jsonError(502, "Couldn't identify right now. Try again."), 'provider_error');
    }

    const ids = result.suggestions.length
      ? await speciesIds(deps, result.suggestions.map((s) => ({
        scientific_name: s.scientificName,
        plantid_name: s.scientificName,
        common_names: s.commonNames,
        origin: 'plantid',
        description: s.details.description ?? null,
        moisture_category: moistureFrom(s.details.watering),
        watering: wateringLine(moistureFrom(s.details.watering)),
        light: lightFrom(s.details.bestLight),
      })))
      : new Map<string, string>();
    const suggestions = result.suggestions.map((s) => ({
      speciesId: ids.get(s.scientificName),
      commonName: s.commonNames[0] ?? s.scientificName,
      scientificName: s.scientificName,
      confidence: s.confidence,
    }));
    const scanId = await insertScan(deps, {
      ...scan,
      status: result.isPlant ? 'ok' : 'not_plant',
      is_plant: result.isPlantProbability,
      suggestions,
    });
    return respond(json({ scanId, isPlant: result.isPlant, suggestions }), result.isPlant ? 'ok' : 'not_plant');
  } catch {
    return respond(jsonError(500, 'Something went wrong.'), 'error');
  } finally {
    console.log(JSON.stringify({ fn: 'identify-plant', requestId, userId, outcome }));
  }
}

if (import.meta.main) {
  Deno.serve((req) => handler(req, { ...envDeps(), plantIdApiKey: Deno.env.get('PLANT_ID_API_KEY') ?? '' }));
}
