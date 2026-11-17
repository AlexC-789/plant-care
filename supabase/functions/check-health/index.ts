// check-health: Plant.id health assessment on demand for one of the caller's plants (spec §5.7, §7, §8a).
// Body is exactly { plantId, photoPaths }; photos travel via Storage, never the body.
import { type Deps, envDeps, requireUser } from '../_shared/auth.ts';
import { downloadBase64, insertScan, rest } from '../_shared/db.ts';
import { healthNote, UNSURE_NOTE } from '../_shared/health_notes.ts';
import { json, jsonError, readJsonBody } from '../_shared/http.ts';
import { countRecentPlantIdCalls, PLANT_ID_DAILY_LIMIT } from '../_shared/limits.ts';
import { PlantIdClient, ProviderError } from '../_shared/plantid.ts';
import { validatePhotoPaths } from '../_shared/validate.ts';

export interface CheckHealthDeps extends Deps {
  plantIdApiKey: string;
}

// the daily limit is shared with identify-plant, the copy is not
const LIMIT_MESSAGE = "You've reached the health check limit for now. Try again later.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handler(req: Request, deps: CheckHealthDeps): Promise<Response> {
  const requestId = req.headers.get('sb-request-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID();
  let userId = '-';
  let outcome = 'error';
  let providerStatus: number | undefined;
  const respond = (res: Response, o: string) => {
    outcome = o;
    return res;
  };
  try {
    if (req.method !== 'POST') return respond(jsonError(405, 'Invalid request.'), 'bad_method');
    const user = await requireUser(req, deps);
    if (user instanceof Response) return respond(user, `auth_${user.status}`);
    userId = user.userId;
    if (!deps.plantIdApiKey) {
      console.error(JSON.stringify({ fn: 'check-health', requestId, outcome: 'misconfigured' }));
      return respond(jsonError(500, 'Something went wrong.'), 'misconfigured');
    }

    const body = await readJsonBody(req);
    if (body instanceof Response) return respond(body, `body_${body.status}`);
    const { plantId } = body;
    if (Object.keys(body).some((k) => k !== 'plantId' && k !== 'photoPaths') || typeof plantId !== 'string' || !UUID.test(plantId)) {
      return respond(jsonError(400, 'Invalid request.'), 'bad_fields');
    }
    const paths = validatePhotoPaths(body.photoPaths, userId, 2);
    if (paths instanceof Response) return respond(paths, `paths_${paths.status}`);

    const owned = await (await rest(deps, `plants?select=id&id=eq.${plantId}&user_id=eq.${userId}`)).json();
    if (!owned.length) return respond(jsonError(403, 'Not allowed.'), 'not_owner');

    if ((await countRecentPlantIdCalls(deps, userId)) >= PLANT_ID_DAILY_LIMIT) {
      return respond(jsonError(429, LIMIT_MESSAGE), 'limited');
    }

    const images = await Promise.all(paths.map((p) => downloadBase64(deps, p)));
    const scan = { user_id: userId, kind: 'health', plant_id: plantId, photo_paths: paths };
    let result;
    try {
      result = await new PlantIdClient({ apiKey: deps.plantIdApiKey, fetch: deps.fetch }).health(images);
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      providerStatus = e.status;
      await insertScan(deps, { ...scan, status: 'error' });
      return respond(jsonError(502, "Couldn't check right now. Try again."), 'provider_error');
    }

    const isPlant = result.isPlantProbability >= 0.5;
    const health = isPlant ? healthNote(result) : { healthy: null, note: UNSURE_NOTE, advice: null };
    const scanId = await insertScan(deps, { ...scan, status: isPlant ? 'ok' : 'not_plant', is_plant: result.isPlantProbability, health });
    return respond(json({ scanId, ...health }), isPlant ? 'ok' : 'not_plant');
  } catch {
    return respond(jsonError(500, 'Something went wrong.'), 'error');
  } finally {
    console.log(JSON.stringify({ fn: 'check-health', requestId, userId, outcome, status: providerStatus }));
  }
}

if (import.meta.main) {
  Deno.serve((req) => handler(req, { ...envDeps(), plantIdApiKey: Deno.env.get('PLANT_ID_API_KEY') ?? '' }));
}
