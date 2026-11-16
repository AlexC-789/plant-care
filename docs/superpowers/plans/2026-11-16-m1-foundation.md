# Milestone 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A monorepo with an Expo app where a user can sign up, sign in, see an empty plant library, edit their profile and sign out, backed by a local Supabase with a `profiles` table protected by Row Level Security.

**Architecture:** npm workspaces monorepo. `apps/mobile` is an Expo Router TypeScript app talking to Supabase through `@supabase/supabase-js`. `supabase/` holds config, SQL migrations and pgTAP database tests, run locally with the Supabase CLI in Docker. A profile row is created by a database trigger on sign-up; users can read/update only their own row and can never change `subscription_status`.

**Tech Stack:** Expo SDK 58 (expo-router, TypeScript), @supabase/supabase-js 2.x, @react-native-async-storage/async-storage, jest-expo + @testing-library/react-native, Supabase CLI 3.x (Postgres + pgTAP), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-16-plant-care-design.md` (sections 5.1, 5.2, 6 `profiles`, 7 screens 1 & 7, 9, 10). Milestones 2–8 get their own plans.

## Global Constraints

- TypeScript `strict: true` everywhere.
- Add Expo-managed dependencies with `npx expo install <pkg>` (picks SDK-compatible versions), never plain `npm install`.
- No secrets in the app. Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public by design) reach the client; real values live in `apps/mobile/.env.local` (git-ignored); `.env.example` is committed.
- Every user-owned table has RLS enabled with owner-only policies.
- `profiles.subscription_status` values: `'none' | 'active' | 'expired'`, default `'none'`; never writable by the `authenticated` role.
- `profiles.units` values: `'metric' | 'imperial'`, default `'metric'`.
- Minimum password length: 8.
- Schema changes only via files in `supabase/migrations/`; regenerate `apps/mobile/src/lib/database.types.ts` after each.
- Commit after each task with a conventional-commit message ending in the session's attribution lines.

## Review Focus

1. **Sign-up with an email that already exists** → message "An account with this email already exists. Sign in instead.", no crash. (Task 4)
2. **Sign-up when the server requires email confirmation** (hosted Supabase default) → no session is returned; the app shows "Check your email to confirm your account, then sign in." instead of hanging or navigating to an empty app. (Task 4)
3. **App launch with a stored session whose refresh fails** (expired / revoked) → lands on sign-in, never an endless spinner. (Task 3)
4. **Network failure during sign-in / sign-up** → "Can't reach the server. Check your connection and try again.", button re-enabled; double-tapping submit sends one request. (Task 4)
5. **A signed-in user calling the API directly to set `subscription_status = 'active'` or read another user's profile** → denied. (Task 2)

## File Structure

```
package.json                     # npm workspaces root, top-level scripts
.gitignore  .editorconfig
CLAUDE.md  README.md
.github/workflows/ci.yml
apps/mobile/
  app.json  package.json  tsconfig.json  jest.config.js  .env.example
  app/_layout.tsx                # AuthProvider + redirect logic
  app/(auth)/_layout.tsx  app/(auth)/sign-in.tsx  app/(auth)/sign-up.tsx
  app/(app)/_layout.tsx   app/(app)/index.tsx      app/(app)/settings.tsx
  src/lib/supabase.ts            # the single Supabase client
  src/lib/database.types.ts      # generated
  src/auth/AuthProvider.tsx      # session state
  src/auth/validation.ts         # form validation
  src/auth/authErrors.ts         # error -> user message
  src/profile/useProfile.ts  src/profile/useEntitlement.ts
  src/**/__tests__/*.test.ts(x)
supabase/
  config.toml
  migrations/20261116000000_profiles.sql
  tests/database/profiles.test.sql
```

---

### Task 1: Monorepo and Expo app shell

**Files:**
- Create: `package.json`, `.gitignore`, `.editorconfig`, `apps/mobile/**` (via create-expo-app), `apps/mobile/jest.config.js`, `apps/mobile/src/__tests__/smoke.test.tsx`

**Interfaces:**
- Produces: root scripts `npm run test`, `npm run typecheck`, `npm run lint` (each delegating to `apps/mobile`); Expo Router app at `apps/mobile/app/`.

- [ ] **Step 1:** Root `package.json`: `"private": true`, `"workspaces": ["apps/*"]`, scripts `test`, `typecheck`, `lint` that run `npm run <x> -w apps/mobile`. `.gitignore` covers `node_modules`, `.expo`, `dist`, `.env*.local`, `supabase/.temp`, `supabase/.branches`.
- [ ] **Step 2:** `npx create-expo-app@latest apps/mobile --template default --no-install`, then `npm install` at root, then `npm run reset-project -w apps/mobile` and delete the generated `app-example/`. Set `"strict": true` in `apps/mobile/tsconfig.json`. App name/slug `plant-care`.
- [ ] **Step 3:** `npx expo install jest-expo jest @testing-library/react-native @types/jest -- --save-dev` in `apps/mobile`; `jest.config.js` uses `preset: 'jest-expo'`; scripts `test: jest`, `typecheck: tsc --noEmit`, `lint: expo lint`.
- [ ] **Step 4: Write the smoke test** `src/__tests__/smoke.test.tsx`: renders `app/index.tsx` (the reset-project screen) and asserts it renders without throwing.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run lint` at root. Expected: 1 test passes, no type or lint errors.
- [ ] **Step 6:** Run `npx expo export --platform web` in `apps/mobile`. Expected: completes, writes `dist/`.
- [ ] **Step 7: Commit** `chore: scaffold monorepo and Expo app`.

### Task 2: Local Supabase and `profiles` schema with RLS

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/20261116000000_profiles.sql`, `supabase/tests/database/profiles.test.sql`
- Modify: root `package.json` (add `supabase` CLI as devDependency; scripts `db:start`, `db:reset`, `db:test`, `db:types`)

**Interfaces:**
- Produces: table `public.profiles` — `user_id uuid primary key references auth.users on delete cascade`, `display_name text`, `units text not null default 'metric' check (units in ('metric','imperial'))`, `notification_prefs jsonb not null default '{}'`, `quiet_hours_start time`, `quiet_hours_end time`, `subscription_status text not null default 'none' check (subscription_status in ('none','active','expired'))`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
- Produces: script `npm run db:types` → `supabase gen types typescript --local > apps/mobile/src/lib/database.types.ts`.

- [ ] **Step 1:** In `config.toml` set `[auth] minimum_password_length = 8` and `[auth.email] enable_confirmations = false` (local only).
- [ ] **Step 2: Write the failing pgTAP tests** in `profiles.test.sql` (use `tests.create_supabase_user` / `tests.authenticate_as` from `supabase-test-helpers`, or equivalent inline helpers setting `request.jwt.claims` and `role authenticated`):
  - `has_table('public','profiles')`; `row_security_active`/RLS enabled on it.
  - Inserting a user into `auth.users` creates exactly one profile with `units = 'metric'`, `subscription_status = 'none'`.
  - As user A: `select count(*) from profiles` = 1 (only own row).
  - As user A: `update profiles set display_name = 'A'` affects 1 row; update targeting user B's row affects 0 rows.
  - As user A: `update profiles set subscription_status = 'active'` → `throws_ok` (permission denied).
  - As user A: `insert into profiles ...` and `delete from profiles` → `throws_ok` or 0 rows.
  - `update ... set units = 'furlongs'` → `throws_ok` (check violation).
- [ ] **Step 3:** `npm run db:start` then `npm run db:test`. Expected: FAIL (table missing).
- [ ] **Step 4: Write the migration**: table above; `enable row level security`; policies `profiles_select_own` (select using `user_id = auth.uid()`), `profiles_update_own` (update using/with check `user_id = auth.uid()`); `revoke insert, delete, update on profiles from authenticated, anon`; `grant select on profiles to authenticated`; `grant update (display_name, units, notification_prefs, quiet_hours_start, quiet_hours_end) on profiles to authenticated`; `security definer` function `public.handle_new_user()` with `set search_path = ''` inserting `(new.id)`, trigger `on_auth_user_created after insert on auth.users`; `updated_at` trigger.
- [ ] **Step 5:** `npm run db:reset && npm run db:test`. Expected: all pass.
- [ ] **Step 6:** `npm run db:types`. Expected: `database.types.ts` contains `profiles`.
- [ ] **Step 7: Commit** `feat(db): profiles table with RLS and signup trigger`.

### Task 3: Supabase client and session provider

**Files:**
- Create: `apps/mobile/src/lib/supabase.ts`, `apps/mobile/src/auth/AuthProvider.tsx`, `apps/mobile/.env.example`, `apps/mobile/src/auth/__tests__/AuthProvider.test.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `Database` type from `src/lib/database.types.ts` (Task 2).
- Produces: `export const supabase: SupabaseClient<Database>`; `AuthProvider({ children }: { children: React.ReactNode })`; `useSession(): { session: Session | null; isLoading: boolean }`.

- [ ] **Step 1:** `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill`.
- [ ] **Step 2: Write the failing tests** (mock `src/lib/supabase` with a fake `auth` exposing `getSession` and `onAuthStateChange`):
  - `isLoading` is `true` until `getSession` resolves, then `false`.
  - `getSession` resolving `{ data: { session: S } }` → `useSession().session === S`.
  - `getSession` resolving `{ data: { session: null }, error: <AuthError> }` (refresh failed) → `session === null`, `isLoading === false`.
  - `getSession` rejecting → `session === null`, `isLoading === false`.
  - `onAuthStateChange` callback with `('SIGNED_OUT', null)` → `session` becomes `null`; listener is unsubscribed on unmount.
- [ ] **Step 3:** Run `npm test -w apps/mobile -- AuthProvider`. Expected: FAIL (module not found).
- [ ] **Step 4:** Implement `supabase.ts`: `createClient<Database>(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`; throw a clear error at import if either env var is missing; register `AppState` listener calling `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()` on active/background. Implement `AuthProvider` + `useSession`. `.env.example` lists both vars with the local defaults printed by `supabase start`.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Wrap the root `_layout.tsx` `Stack` in `AuthProvider`. Run `npm test && npm run typecheck`. Expected: pass.
- [ ] **Step 7: Commit** `feat(mobile): supabase client and session provider`.

### Task 4: Sign-up, sign-in and route guarding

**Files:**
- Create: `apps/mobile/src/auth/validation.ts`, `apps/mobile/src/auth/authErrors.ts`, `apps/mobile/app/(auth)/_layout.tsx`, `apps/mobile/app/(auth)/sign-in.tsx`, `apps/mobile/app/(auth)/sign-up.tsx`, `apps/mobile/app/(app)/_layout.tsx`, `apps/mobile/app/(app)/index.tsx`, tests under `src/auth/__tests__/` and `app/__tests__/`
- Modify: `apps/mobile/app/_layout.tsx`; delete the reset-project `app/index.tsx` and update the smoke test to render the sign-in screen.

**Interfaces:**
- Consumes: `supabase`, `useSession` (Task 3).
- Produces: `validateCredentials(email: string, password: string): { email?: string; password?: string }`; `authErrorMessage(error: unknown): string`; routes `/(auth)/sign-in`, `/(auth)/sign-up`, `/(app)` (library).

- [ ] **Step 1: Write failing unit tests**
  - `validateCredentials('', 'x')` → `{ email: 'Enter your email.', password: 'Password must be at least 8 characters.' }`; `('a@b', '12345678')` → `{ email: 'Enter a valid email address.' }`; `('  me@x.com ', '12345678')` → `{}` (email trimmed).
  - `authErrorMessage` with `{ code: 'user_already_exists' }` → `'An account with this email already exists. Sign in instead.'`; `{ code: 'invalid_credentials' }` → `'Email or password is incorrect.'`; `{ code: 'weak_password' }` → `'Password must be at least 8 characters.'`; an `AuthRetryableFetchError` or `TypeError('Network request failed')` → `"Can't reach the server. Check your connection and try again."`; anything else → `'Something went wrong. Please try again.'`
- [ ] **Step 2:** Run; expected FAIL. Implement both modules; run; expected PASS.
- [ ] **Step 3: Write failing screen tests** (RNTL, mocked `supabase.auth`):
  - Sign-in: invalid input shows the validation messages and does not call `signInWithPassword`.
  - Sign-in: pressing "Sign in" twice quickly calls `signInWithPassword` once; button shows disabled while pending.
  - Sign-in: rejected with network error → shows the network message; button re-enabled.
  - Sign-up: `signUp` resolves `{ data: { session: null, user: {...} }, error: null }` → shows `'Check your email to confirm your account, then sign in.'`
  - Sign-up: `{ error: { code: 'user_already_exists' } }` → shows the matching message.
  - Each screen links to the other ("Don't have an account? Sign up" / "Already have an account? Sign in").
- [ ] **Step 4:** Run; FAIL. Implement screens (email field with `autoCapitalize="none"`, `keyboardType="email-address"`, `autoComplete`; password `secureTextEntry`). Run; PASS.
- [ ] **Step 5: Write failing guard tests** for root `_layout.tsx`: while `isLoading` → loading indicator and no redirect; `session === null` → redirected to `/(auth)/sign-in`; session present → `/(app)` showing library empty state `"No plants yet"` with subtitle `"Scan your first plant to get started."` Implement with `Stack.Protected guard={...}` (expo-router) or `<Redirect>`; run; PASS.
- [ ] **Step 6:** Run `npm test && npm run typecheck && npm run lint`. Expected: all pass.
- [ ] **Step 7: Manual check** (use the `run` skill): `npm run db:start`, copy keys to `.env.local`, `npx expo start --web`; with Playwright sign up a new user, land on "No plants yet", reload page and remain signed in; screenshot both screens.
- [ ] **Step 8: Commit** `feat(mobile): sign-up, sign-in and auth routing`.

### Task 5: Settings — profile, entitlement, sign-out

**Files:**
- Create: `apps/mobile/src/profile/useProfile.ts`, `apps/mobile/src/profile/useEntitlement.ts`, `apps/mobile/app/(app)/settings.tsx`, tests under `src/profile/__tests__/` and `app/__tests__/settings.test.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx` (settings button in header of the library)

**Interfaces:**
- Consumes: `supabase`, `useSession`, `Database['public']['Tables']['profiles']`.
- Produces: `type Profile = Database['public']['Tables']['profiles']['Row']`; `type ProfileUpdate = Pick<Database['public']['Tables']['profiles']['Update'], 'display_name' | 'units' | 'notification_prefs' | 'quiet_hours_start' | 'quiet_hours_end'>`; `useProfile(): { profile: Profile | null; isLoading: boolean; error: string | null; update(patch: ProfileUpdate): Promise<void> }`; `useEntitlement(): { isSubscribed: boolean; isLoading: boolean }` (`isSubscribed === (profile?.subscription_status === 'active')`). Milestones 2+ gate features only through `useEntitlement`.

- [ ] **Step 1: Write failing hook tests**: `useProfile` loads the row for the session user; `update({ units: 'imperial' })` sends only that column and updates state; a failed update sets `error` and leaves `profile` unchanged. `useEntitlement` → `true` only for `'active'`; `false` for `'none'`, `'expired'`, and while no profile.
- [ ] **Step 2:** Run; FAIL. Implement; run; PASS.
- [ ] **Step 3: Write failing screen test**: settings shows the email, an editable display name, a Metric/Imperial switch that calls `update`, subscription row reading `"Free (testing)"` for non-subscribed / `"Active"` for subscribed, and "Sign out" calling `supabase.auth.signOut()`. Implement; run; PASS.
- [ ] **Step 4:** Integration check against local Supabase: `npm run db:reset`, sign up in the web app, change units, verify in Studio (`http://127.0.0.1:54323`) that the row changed; sign out returns to sign-in.
- [ ] **Step 5: Commit** `feat(mobile): settings with profile, entitlement and sign-out`.

### Task 6: CI and project docs

**Files:**
- Create: `.github/workflows/ci.yml`, `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: root scripts from Tasks 1–2.

- [ ] **Step 1:** `ci.yml` on push and pull_request: job `mobile` (Node 22, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`); job `db` (`supabase/setup-cli@v1`, `supabase db start`, `supabase test db`).
- [ ] **Step 2:** `README.md`: prerequisites (Node 22, Docker), first-time setup, `npm run db:start`, copying keys to `apps/mobile/.env.local`, `npx expo start`, testing on a phone with Expo Go on the same Wi-Fi (backend URL must be the computer's LAN IP, not `127.0.0.1`).
- [ ] **Step 3:** `CLAUDE.md`: one-paragraph product summary linking the spec and hardware doc; repo layout; all commands; rules from Global Constraints; "watering safety limits live in firmware and in the shared watering module — never relax them" (for later milestones).
- [ ] **Step 4:** Run the CI commands locally in sequence. Expected: all pass.
- [ ] **Step 5: Commit** `chore: CI workflow and project docs`; push once the GitHub remote exists, confirm the CI run is green.
