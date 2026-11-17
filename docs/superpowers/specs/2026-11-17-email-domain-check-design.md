# Email domain check at sign-up: design (small change)

Date: 2026-11-17
Status: Approved 2026-11-17
Builds on: email confirmation (`2026-11-17-email-confirmation-design.md`), branch `ui-foundation`

## Intent
Stop obviously unusable addresses (a domain that can't receive mail, or a throwaway inbox
service) at sign-up, before an account exists, with a message that tells the person what to
fix. Email confirmation stays the final proof that an address is real.

## Owner decisions (2026-11-17)
- Option 1: check that the domain can receive mail (server side).
- Option 3: also block disposable/throwaway email services.
- Theme: keep following the phone's light/dark setting (no in-app switch).

## Approaches
- **Supabase "before user created" auth hook calling an Edge Function (chosen).** Runs on the
  server for every sign-up, so the app can't bypass it; Edge Functions can look up DNS.
- Check in the app before calling sign-up (rejected): bypassable, and the app can't do DNS.
- Postgres-function hook (rejected): Postgres can't look up DNS.

## Behaviour
Edge Function `before-user-created` receives the new user's email and, in order:
1. **Disposable domain** (the domain or any parent domain is on the bundled blocklist) →
   reject: "Use a permanent email address. Temporary inboxes can't be used."
2. **Mail check:** look up MX records; if none, look up A/AAAA (mail falls back to them).
   The domain doesn't exist, or has neither → reject:
   "This email domain can't receive mail. Check the address."
3. Otherwise allow.

**Fail open:** if the DNS lookup itself errors or times out (2 s), or the resolver can't
resolve a known-good domain, allow the sign-up and log a warning (domain only). A missing hook
secret also allows (and logs an error). Confirmation still protects us.
Not covered by fail-open: an enabled hook whose function isn't deployed, or whose secret
doesn't match. Supabase Auth then fails the sign-up, so the README's hosted checklist ends
with a smoke test.

Only the domain is looked up. The address is never sent anywhere.

**Blocklist:** the community-maintained `disposable-email-domains` list (CC0), vendored into
the function as a file with its source and date. Refresh it by hand when needed.

**Security:** the hook request is signed (Standard Webhooks). The function rejects
unsigned or wrongly signed calls with 401. Local development uses a dev-only secret in
`supabase/config.toml` (hook and `[edge_runtime.secrets]`). Hosted secrets are set in the dashboard
(milestone 4).

**App:** the hook's message reaches the app as a sign-up error. `authErrorMessage` shows those
two messages as they are; the existing generic fallback covers anything else.

## Testing
- Function unit tests (Deno): disposable domain and subdomain rejected; NXDOMAIN rejected;
  no MX but an A record allowed; MX allowed; a DNS error allowed (fail open); bad signature 401.
  DNS is injected so the tests don't need the network.
- App test: sign-up shows each hook message.
- End to end against local Supabase: `x@ajshs.fur` rejected; `x@mailinator.com` rejected;
  `x@gmail.com` reaches "We sent a confirmation link".
- Docs: README/CLAUDE.md explain restarting Supabase after config changes, and that
  confirmation must be on.

## Left for later
Deploying the function and enabling the hook on the hosted project (milestone 4).
Cleaning up accounts that never confirm.
