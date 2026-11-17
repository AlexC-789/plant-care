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

/** Verifies the caller's JWT with Supabase Auth; returns the user id or a 401. */
export async function requireUser(req: Request, deps: Deps): Promise<{ userId: string } | Response> {
  const token = /^Bearer (\S+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) return jsonError(401, 'Sign in required.');
  try {
    const res = await deps.fetch(`${deps.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: deps.serviceRoleKey, authorization: `Bearer ${token}` },
    });
    const id = res.ok ? (await res.json())?.id : undefined;
    if (typeof id === 'string') return { userId: id };
  } catch { /* fall through: treat an unreachable auth service as unauthenticated */ }
  return jsonError(401, 'Sign in required.');
}
