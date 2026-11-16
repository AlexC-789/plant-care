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
| `npm run db:types` | Regenerate `apps/mobile/src/lib/database.types.ts` after a migration |

Local Supabase Studio (database browser): http://127.0.0.1:54323

## Giving yourself a subscription (testing)

Subscriptions are set by hand until store billing exists. In Studio's SQL editor:

```sql
update public.profiles set subscription_status = 'active'
where user_id = (select id from auth.users where email = 'you@example.com');
```
