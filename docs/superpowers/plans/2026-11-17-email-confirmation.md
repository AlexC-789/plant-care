# Email Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New accounts must confirm their email; after sign-up the user is sent to sign-in (email pre-filled, notice shown), can resend the confirmation email, and the link lands on a public `/email-confirmed` page.

**Architecture:** Supabase Auth with `enable_confirmations = true` verifies the link server-side and redirects to `EXPO_PUBLIC_EMAIL_CONFIRMED_URL` (a public Expo Router route served by the web build). Sign-up navigates to `/sign-in` with search params; `AuthForm` gains an initial email/notice and an optional resend action shown after an `email_not_confirmed` error.

**Tech Stack:** Expo Router (SDK 58), @supabase/supabase-js 2.x (`auth.signUp`, `auth.resend`, `auth.signOut`), jest-expo + expo-router/testing-library, Playwright + Mailpit API for the end-to-end check.

**Spec:** `docs/superpowers/specs/2026-11-17-email-confirmation-design.md` (builds on `docs/superpowers/specs/2026-11-16-plant-care-design.md`).

## Global Constraints

- All rules in `CLAUDE.md` apply (TDD, press handlers synchronous with `void`, tests in `src/**/__tests__/`, no secrets in the app).
- Exact copy (verbatim from spec):
  - `We sent a confirmation link to {email}. Confirm your email, then sign in.`
  - `Account created. Sign in to continue.`
  - `Confirm your email first. Check your inbox, then sign in.` (already exists)
  - Button: `Resend confirmation email`; success: `Confirmation email sent to {email}.`
  - Rate limit: `Too many emails sent. Wait a few minutes and try again.`
  - Page OK: heading `Email confirmed`, text `Go back to the app and sign in.`
  - Page error: heading `Link expired`, text `This link has expired or was already used. Sign in and we'll send you a new one.`
  - Both pages: link `Sign in` → `/sign-in`.
- `EXPO_PUBLIC_EMAIL_CONFIRMED_URL` default `http://127.0.0.1:8081/email-confirmed`; passed as `emailRedirectTo` on sign-up and resend.
- Resend cooldown: 60 s after any confirmation email (sign-up or resend); button disabled with label `Resend in {n}s`. Server: `[auth.email] max_frequency = "60s"`.
- `supabase/config.toml`: `enable_confirmations = true` (the `[auth.email]` one), `site_url = "http://127.0.0.1:8081"`, `additional_redirect_urls = ["http://127.0.0.1:8081/email-confirmed", "http://localhost:8081/email-confirmed"]`, `[auth.rate_limit] email_sent = 30`.
- The `/email-confirmed` page never signs anyone in.

## Review Focus

1. **Sign-in screen opened directly (no search params)** → no notice, empty email field. (Task 1)
2. **User edits the email field after the failed sign-in, then taps resend** → resend goes to the field's current (trimmed) email; an invalid/empty field shows the validation message and sends nothing. (Task 2)
3. **Resend tapped twice quickly** → one request; button disabled while sending, then the 60 s cooldown starts. (Task 2)
4. **Error delivered in the query string instead of the fragment** (`?error=access_denied&error_code=otp_expired`) → `Link expired`. (Task 3)
5. **Signed-in user opens `/email-confirmed`** → page shows; no redirect into the app or to sign-in. (Task 3)

## File Structure

```
supabase/config.toml                         modify: confirmations, URLs, rate limit
apps/mobile/.env.example                     add EXPO_PUBLIC_EMAIL_CONFIRMED_URL
apps/mobile/src/auth/emailConfirmation.ts    EMAIL_CONFIRMED_URL, confirmationResult()
apps/mobile/src/auth/AuthForm.tsx            initialEmail, initialNotice, onResendConfirmation
apps/mobile/src/auth/authErrors.ts           + over_email_send_rate_limit
apps/mobile/src/app/(auth)/sign-up.tsx       navigate to sign-in after success
apps/mobile/src/app/(auth)/sign-in.tsx       read params; wire resend
apps/mobile/src/app/email-confirmed.tsx      public page
apps/mobile/src/__tests__/auth-screens.test.tsx, email-confirmed.test.tsx
apps/mobile/src/auth/__tests__/emailConfirmation.test.ts, authErrors.test.ts
apps/mobile/src/test-utils/supabaseMock.ts   + auth.resend
README.md
```

---

### Task 1: Config and sign-up → sign-in hand-off

**Files:**
- Modify: `supabase/config.toml`, `apps/mobile/.env.example`, `apps/mobile/src/auth/AuthForm.tsx`, `apps/mobile/src/app/(auth)/sign-up.tsx`, `apps/mobile/src/app/(auth)/sign-in.tsx`
- Create: `apps/mobile/src/auth/emailConfirmation.ts`
- Test: `apps/mobile/src/__tests__/auth-screens.test.tsx`

**Interfaces:**
- Produces: `export const EMAIL_CONFIRMED_URL: string` (env var or the default); `AuthForm` props `initialEmail?: string`, `initialNotice?: string`; sign-in route search params `{ email?: string; notice?: 'confirm-sent' | 'account-created' }`.

- [ ] **Step 1:** Apply the config values from Global Constraints; add `EXPO_PUBLIC_EMAIL_CONFIRMED_URL=http://127.0.0.1:8081/email-confirmed` to `.env.example`. `npx supabase stop && npm run db:start`; `npm run db:test` → PASS.
- [ ] **Step 2: Write failing tests** in `auth-screens.test.tsx` (`sign-up` describe), replacing the old "tells the user to check their email" test:
  - `signUp` → `{ data: { session: null, user: { id: 'u', identities: [{}] } }, error: null }` → pathname `/sign-in`, Email field value `new@example.com`, text `We sent a confirmation link to new@example.com. Confirm your email, then sign in.`; `signUp` called with `{ email: 'new@example.com', password: 'password123', options: { emailRedirectTo: 'http://127.0.0.1:8081/email-confirmed' } }`.
  - `signUp` returns a session → `signOut` called with `{ scope: 'local' }`, pathname `/sign-in`, text `Account created. Sign in to continue.`
  - Opening `/sign-in` directly → Email field value `''`, neither notice present.
  - Existing tests for `user_already_exists` / no-identities still pass unchanged (user stays on sign-up with the error).
- [ ] **Step 3:** `npx jest auth-screens` → the new tests FAIL.
- [ ] **Step 4:** Implement: `emailConfirmation.ts`; `AuthForm` seeds `email` state from `initialEmail` and `notice` from `initialNotice`; sign-up's `onSubmit` calls `signUp` with `options.emailRedirectTo`, and on success (no error, not the no-identities case) calls `supabase.auth.signOut({ scope: 'local' })` when a session came back, then `router.replace({ pathname: '/sign-in', params: { email, notice } })`; sign-in reads params with `useLocalSearchParams` and maps `notice` to the copy.
- [ ] **Step 5:** `npm test && npm run typecheck && npm run lint` → all pass.
- [ ] **Step 6: Commit** `feat(auth): require email confirmation; send new users to sign-in`.

### Task 2: Resend confirmation email

**Files:**
- Modify: `apps/mobile/src/auth/AuthForm.tsx`, `apps/mobile/src/auth/authErrors.ts`, `apps/mobile/src/app/(auth)/sign-in.tsx`, `apps/mobile/src/test-utils/supabaseMock.ts`
- Test: `apps/mobile/src/auth/__tests__/authErrors.test.ts`, `apps/mobile/src/__tests__/auth-screens.test.tsx`

**Interfaces:**
- Consumes: `EMAIL_CONFIRMED_URL` (Task 1).
- Produces: `AuthForm` props `onResendConfirmation?: (email: string) => Promise<AuthSubmitResult>` and `resendCooldownFromStart?: boolean` (sign-in passes `true` when arriving with `notice=confirm-sent`, because sign-up just sent an email); `export const RESEND_COOLDOWN_SECONDS = 60` in `emailConfirmation.ts`. The button appears only when `onResendConfirmation` is set and the last submit error had code `email_not_confirmed`.

- [ ] **Step 1: Write failing tests**
  - `authErrorMessage({ code: 'over_email_send_rate_limit' })` → `Too many emails sent. Wait a few minutes and try again.`
  - Sign-in rejected with `{ code: 'email_not_confirmed' }` → button `Resend confirmation email` shown; for `invalid_credentials` it is not shown.
  - Pressing it → `auth.resend` called once with `{ type: 'signup', email: 'a@example.com', options: { emailRedirectTo: 'http://127.0.0.1:8081/email-confirmed' } }`; then text `Confirmation email sent to a@example.com.`
  - Changing the Email field to `' b@example.com '` before pressing → resend uses `b@example.com`; changing it to `nope` → `Enter a valid email address.` and `resend` not called.
  - `resend` pending: press twice → called once, button disabled; resolving re-enables it.
  - `resend` resolves `{ error: { code: 'over_email_send_rate_limit' } }` → rate-limit message.
  - Cooldown (jest fake timers): after a successful resend the button is disabled and reads `Resend in 60s`; after advancing 1 s → `Resend in 59s`; after 60 s total → `Resend confirmation email`, enabled, and a second press calls `resend` again.
  - Arriving with `?email=a@example.com&notice=confirm-sent` then failing sign-in with `email_not_confirmed` → button already reads `Resend in 60s` (counted from arrival) and is disabled.
  - A failed resend (error) does **not** start the cooldown.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: set `max_frequency = "60s"` under `[auth.email]` in `config.toml` (restart Supabase); cooldown stored as `resendAvailableAt: number` (ms timestamp) with a 1 s interval to re-render while cooling, cleared on unmount; add the code to `MESSAGES`; `AuthForm` keeps `lastErrorCode` from the submit result/exception, a separate `resendPending` state + in-flight ref, validates only the email via `validateCredentials(email, 'x'.repeat(8)).email`; sign-in passes `onResendConfirmation` calling `supabase.auth.resend(...)` and returning `{ error }` or `{ notice }`. Add `resend: jest.fn()` to the mock.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint` → pass.
- [ ] **Step 5: Commit** `feat(auth): resend confirmation email from sign-in`.

### Task 3: `/email-confirmed` page

**Files:**
- Create: `apps/mobile/src/app/email-confirmed.tsx`
- Modify: `apps/mobile/src/auth/emailConfirmation.ts`
- Test: `apps/mobile/src/auth/__tests__/emailConfirmation.test.ts`, `apps/mobile/src/__tests__/email-confirmed.test.tsx`

**Interfaces:**
- Produces: `confirmationResult(search: string, hash: string): 'confirmed' | 'expired'` — `'expired'` when either string contains an `error` or `error_code` parameter.

- [ ] **Step 1: Write failing tests**
  - `confirmationResult('', '#access_token=x&type=signup')` → `'confirmed'`; `('', '')` → `'confirmed'`; `('', '#error=access_denied&error_code=otp_expired&error_description=x')` → `'expired'`; `('?error=access_denied&error_code=otp_expired', '')` → `'expired'`.
  - Screen (renderRouter, `initialUrl: '/email-confirmed'`, signed out) → `Email confirmed`, `Go back to the app and sign in.`, `Sign in` link navigates to `/sign-in`.
  - Same while signed in (`getSession` returns `fakeSession`) → pathname stays `/email-confirmed`, page shown.
  - Expired copy: mock `Platform.OS = 'web'` with `window.location` `{ search: '', hash: '#error=access_denied&error_code=otp_expired', pathname: '/email-confirmed' }` and `window.history.replaceState` spy → `Link expired` + its text; `replaceState` called with `(null, '', '/email-confirmed')`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `confirmationResult` with `URLSearchParams` (strip leading `?`/`#`). Page: on web read `window.location.search`/`hash` once (lazy `useState` initializer), strip the URL with `history.replaceState` in an effect; on native treat as `'confirmed'`. Public route (outside groups) so no redirect applies.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint` → pass.
- [ ] **Step 5: Commit** `feat(auth): email-confirmed landing page`.

### Task 4: Docs and end-to-end check

**Files:**
- Modify: `README.md` (Mailpit at http://127.0.0.1:54324; confirmation flow; `EXPO_PUBLIC_EMAIL_CONFIRMED_URL` in `.env.local`), `CLAUDE.md` (one line: confirmations on; Mailpit for local email).

- [ ] **Step 1:** Update docs.
- [ ] **Step 2: E2E** (Playwright, `npx expo start --web --port 8081` with `.env.local` incl. the new var): sign up → lands on `/sign-in` with email filled and the notice; sign in → `Confirm your email first…` + resend button; press resend → wait until the countdown ends (or confirm it reads `Resend in …s` right after sign-up, then wait 60 s) → `Confirmation email sent to …`; fetch the newest message for that address from Mailpit (`GET http://127.0.0.1:54324/api/v1/search?query=to:<email>`, then `/api/v1/message/<ID>`), extract the confirmation link, open it → `Email confirmed`; sign in → `No plants yet`. Open the first (already-used) link again → `Link expired`. Screenshot sign-in-with-notice and both page states.
- [ ] **Step 3:** `npm test && npm run typecheck && npm run lint && npm run db:test` → all pass.
- [ ] **Step 4: Commit** `docs: email confirmation setup`; push branch.
