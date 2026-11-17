// search-plants: Plant.id's free name search as a fallback for type search, and "pick" to store a names-only species (spec §7).
// Body is exactly one of { query } or { pick }.
import { type Deps, envDeps, requireUser } from '../_shared/auth.ts';
import { rest } from '../_shared/db.ts';
import { json, jsonError, readJsonBody } from '../_shared/http.ts';
import { searchAllowed } from '../_shared/limits.ts';
import { PlantIdClient, ProviderError } from '../_shared/plantid.ts';

export interface SearchDeps extends Deps {
  plantIdApiKey: string;
}

const text = (v: unknown, min: number, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length >= min && s.length <= max ? s : null;
};

export async function handler(req: Request, deps: SearchDeps): Promise<Response> {
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
    const keys = Object.keys(body);
    const kind = keys.length === 1 && (keys[0] === 'query' || keys[0] === 'pick') ? keys[0] : null;
    const value = kind === 'query' ? text(body.query, 2, 60) : kind === 'pick' ? text(body.pick, 2, 120) : null;
    if (!value) return respond(jsonError(400, 'Invalid request.'), 'bad_request');

    if (kind === 'pick') {
      // shortcut: any scientific name string is accepted, so a user can create junk names-only rows; add a Plant.id-backed check if abused.
      await rest(deps, 'species?on_conflict=scientific_name', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ scientific_name: value, common_names: [], origin: 'plantid', plantid_name: value }),
      });
      const rows: { id: string }[] =
        await (await rest(deps, `species?select=id&scientific_name=eq.${encodeURIComponent(value)}`)).json();
      return respond(json({ speciesId: rows[0].id }), 'pick');
    }

    if (!(await searchAllowed(deps, userId))) {
      return respond(jsonError(429, 'Too many searches. Try again in a few minutes.'), 'limited');
    }
    try {
      const hits = await new PlantIdClient({ apiKey: deps.plantIdApiKey, fetch: deps.fetch }).nameSearch(value);
      return respond(json({ hits: hits.slice(0, 10) }), 'ok');
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      return respond(jsonError(502, "Couldn't search right now. Try again."), 'provider_error');
    }
  } catch {
    return respond(jsonError(500, 'Something went wrong.'), 'error');
  } finally {
    console.log(JSON.stringify({ fn: 'search-plants', requestId, userId, outcome }));
  }
}

if (import.meta.main) {
  Deno.serve((req) => handler(req, { ...envDeps(), plantIdApiKey: Deno.env.get('PLANT_ID_API_KEY') ?? '' }));
}
