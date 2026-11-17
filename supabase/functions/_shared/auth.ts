import { jsonError } from './http.ts';

/** What the shared helpers need: Supabase REST access with the service-role key. */
export interface Deps {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetch: typeof fetch;
}

export function envDeps(): Deps {
  return {
    supabaseUrl: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    fetch: (...args) => fetch(...args),
  };
}

/** Verifies the caller's JWT with Supabase Auth: the user id, 401 (bad token), 503 (Auth down) or 500 (missing env). */
export async function requireUser(req: Request, deps: Deps): Promise<{ userId: string } | Response> {
  if (!deps.supabaseUrl || !deps.serviceRoleKey) {
    console.error('requireUser: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return jsonError(500, 'Something went wrong.');
  }
  const token = /^Bearer (\S+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) return jsonError(401, 'Sign in required.');
  try {
    const res = await deps.fetch(`${deps.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: deps.serviceRoleKey, authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) return jsonError(401, 'Sign in required.');
    const id = res.ok ? (await res.json())?.id : undefined;
    if (typeof id === 'string') return { userId: id };
  } catch { /* fall through: Auth unreachable */ }
  return jsonError(503, 'Service unavailable. Try again.');
}
