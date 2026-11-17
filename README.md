# Plant Care

Companion app and backend for the self-watering saucer & stake.

- Software design: [docs/superpowers/specs/2026-11-16-plant-care-design.md](docs/superpowers/specs/2026-11-16-plant-care-design.md)
- Hardware design: [docs/hardware/2026-11-16-saucer-and-stake-v1.md](docs/hardware/2026-11-16-saucer-and-stake-v1.md)
- Build plans: [docs/superpowers/plans/](docs/superpowers/plans/)

## Prerequisites

- Node.js 22
- Docker (for the local Supabase backend)
- On your phone: [Expo Go](https://expo.dev/go), or a development build later on

## First-time setup

```bash
npm install
npm run db:start          # starts local Supabase in Docker, applies migrations
```

`db:start` prints the API URL and anon key. Copy the example env file and fill them in:

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

## Email confirmation (local)

New accounts must confirm their email before signing in. Locally no real emails are
sent: Supabase delivers them to **Mailpit**, a test inbox at http://127.0.0.1:54324.
Open the message there and click the link; it lands on the app's `/email-confirmed`
page (served by `npx expo start`, press `w` for web). Resends are limited to one per
60 seconds.

The link target comes from `EXPO_PUBLIC_EMAIL_CONFIRMED_URL` in `apps/mobile/.env.local`
(default `http://127.0.0.1:8081/email-confirmed`) and must be listed in
`additional_redirect_urls` in `supabase/config.toml`.

## Sign-up email check

Supabase runs `supabase/functions/before-user-created` before every new account is
created. It rejects throwaway inboxes (a vendored copy of the CC0
[disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
list) and domains that can't receive mail. If DNS isn't working, sign-ups are allowed and the
confirmation email remains the check.

- Function tests: `npm run fn:test` (uses the `deno` dev dependency).
- **After changing `supabase/config.toml`, restart Supabase** (`npx supabase stop`, then
  `npm run db:start`). Settings such as email confirmation and the hook only apply after a restart.
- Refresh the throwaway list: download `disposable_email_blocklist.conf` from the repo above and
  regenerate `supabase/functions/before-user-created/disposable_domains.ts` (one quoted domain per line).
- Hosted project (milestone 4), **in this order** (an enabled hook whose function is missing or
  has the wrong secret makes every sign-up fail):
  1. In the dashboard, create the "Before User Created" HTTP hook (still disabled) pointing at
     the function URL, and copy its secret.
  2. `npx supabase secrets set BEFORE_USER_CREATED_HOOK_SECRET=<that secret>`
  3. `npx supabase functions deploy before-user-created --no-verify-jwt`
  4. Enable the hook, then sign up once with a real address (should reach "We sent a
     confirmation link") and once with `x@mailinator.com` (should be rejected).
  5. Check the function logs: "allowing <domain>" warnings mean DNS isn't working there.

## Plant identification (Plant.id)

`identify-plant` and `check-health` call Plant.id (Kindwise). Create an account, then put the key in
`supabase/functions/.env` (git-ignored):

```
PLANT_ID_API_KEY=<your key>
```

Restart so it is picked up: `npx supabase stop` then `npm run db:start` (or restart
`npx supabase functions serve`). Hosted: `npx supabase secrets set PLANT_ID_API_KEY=<your key>`.

After pulling milestone 2, run `npm ci` (new `expo-image-picker` and `expo-image-manipulator`).

## Run the app

```bash
cd apps/mobile
npx expo start            # press w for web, or scan the QR code with Expo Go
```

**Testing on a phone:** the phone must reach the backend, so in `apps/mobile/.env.local`
replace `127.0.0.1` with your computer's LAN IP (e.g. `http://192.168.1.20:54321`), keep the
phone on the same Wi-Fi, and restart `expo start`.

## Everyday commands (from the repo root)

| Command | What it does |
|---|---|
| `npm test` | App unit/screen tests (Jest) |
| `npm run typecheck` | Generates route types, runs TypeScript |
| `npm run lint` | ESLint (Expo config) |
| `npm run db:start` / `db:stop` | Start/stop local Supabase |
| `npm run db:reset` | Recreate the local database from migrations |
| `npm run db:test` | Database tests (pgTAP) incl. security rules |
| `npm run fn:test` | Edge Function tests (Deno) |
| `npm run db:types` | Regenerate `apps/mobile/src/lib/database.types.ts` after a migration |

Security proofs against a running local stack and web app (`npx expo start --web --port 8081`, then
`SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node apps/mobile/e2e/m2-security.mjs`,
values from `npx supabase status -o json`; needs Playwright installed globally).

Local Supabase Studio (database browser): http://127.0.0.1:54323

## Giving yourself a subscription (testing)

Subscriptions are set by hand until store billing exists. In Studio's SQL editor:

```sql
update public.profiles set subscription_status = 'active'
where user_id = (select id from auth.users where email = 'you@example.com');
```
