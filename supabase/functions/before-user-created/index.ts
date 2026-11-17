// Supabase Auth "before user created" hook: rejects sign-ups whose email domain is
// disposable or can't receive mail. Configured in supabase/config.toml
// ([auth.hook.before_user_created]); the request is signed with Standard Webhooks.
import { checkEmail, type Lookup } from './check.ts';
import { verifyWebhook } from './webhook.ts';

type Deps = { secret: string; lookup: Lookup };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Real DNS. A missing domain or record type both read as "no records". */
const dnsLookup: Lookup = async (domain, type) => {
  try {
    if (type === 'MX') return (await Deno.resolveDns(domain, 'MX')).map((r) => r.exchange);
    return await Deno.resolveDns(domain, type);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error; // other failures: checkEmail fails open
  }
};

export async function handler(req: Request, { secret, lookup }: Deps): Promise<Response> {
  const payload = await req.text();
  if (!(await verifyWebhook(secret, req.headers, payload))) {
    return json({ error: 'invalid signature' }, 401);
  }
  let email = '';
  try {
    email = (JSON.parse(payload) as { user?: { email?: string } }).user?.email ?? '';
  } catch {
    return json({ error: 'invalid payload' }, 400);
  }

  const decision = await checkEmail(email, lookup);
  return decision.ok ? json({}) : json({ error: { http_code: 400, message: decision.message } });
}

if (import.meta.main) {
  const secret = Deno.env.get('BEFORE_USER_CREATED_HOOK_SECRET');
  Deno.serve((req) =>
    secret
      ? handler(req, { secret, lookup: dnsLookup })
      : json({ error: 'BEFORE_USER_CREATED_HOOK_SECRET is not set' }, 500),
  );
}
