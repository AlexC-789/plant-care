# Email confirmation — Design (small change)

Date: 2026-11-17
Status: Approved 2026-11-17
Builds on: milestone 1 (`docs/superpowers/specs/2026-11-16-plant-care-design.md`, branch `m1-foundation`)

## Intent
New accounts must confirm their email before they can use the app. Signing up
never drops the user straight into the app; they always sign in afterwards.

## Approaches
- **Link opens a "confirmed" web page (chosen).** Supabase verifies the link on
  its side and redirects to our page, which only shows a message. Works whichever
  device the email is opened on; no deep-link setup.
- Link opens the app (rejected): needs iOS/Android deep-link config, fails on another
  device, and Supabase would sign the user in automatically.

Where the page lives:
- **A public route in our Expo app's web build (chosen).** Testable end-to-end
  locally today; one codebase. Needs the web build hosted publicly for real users
  (milestone 4).
- Standalone static HTML page (rejected): second thing to host and keep in sync.

## Behaviour
1. **Sign up** → on success go to **sign-in** with the email pre-filled and the
   notice: "We sent a confirmation link to {email}. Confirm your email, then sign in."
   If the server ever returns a session (confirmation switched off), the app signs
   out locally and shows "Account created. Sign in to continue." — sign-in after
   sign-up is always required. Existing-email handling from milestone 1 is unchanged.
2. **Sign in before confirming** → "Confirm your email first. Check your inbox, then
   sign in." plus a **"Resend confirmation email"** button. Pressing it resends to the
   email in the field; success: "Confirmation email sent to {email}." Button disabled
   while sending; errors use the existing messages plus rate limiting:
   "Too many emails sent. Wait a few minutes and try again."
3. **Confirmation link** → Supabase verifies, then redirects to `/email-confirmed`:
   - normal: heading "Email confirmed", text "Go back to the app and sign in.",
     plus a "Sign in" link (handy when confirmed on a computer);
   - error in the redirect (expired / already used): heading "Link expired",
     text "This link has expired or was already used. Sign in and we'll send you a
     new one.", plus "Sign in" link.
   The page never signs anyone in; on web it strips the URL fragment (Supabase puts
   tokens there) from the address bar.
   The route sits outside `(auth)`/`(app)` so it works signed in or out.

## Config
- `supabase/config.toml`: `enable_confirmations = true`;
  `site_url = "http://127.0.0.1:8081"`;
  `additional_redirect_urls` include `http://127.0.0.1:8081/email-confirmed` and
  `http://localhost:8081/email-confirmed`; local `email_sent` rate limit raised from
  2 to 30/hour so testing isn't blocked (hosted keeps its own limits).
- New public env var `EXPO_PUBLIC_EMAIL_CONFIRMED_URL` (default
  `http://127.0.0.1:8081/email-confirmed`), passed as `emailRedirectTo` on sign-up
  and resend. Added to `.env.example`.
- Local emails land in Mailpit: http://127.0.0.1:54324 (README updated).

## Testing
Screen tests for the sign-up → sign-in hand-off, the session-returned case, resend
(success, pending, rate-limited), and both versions of `/email-confirmed`.
End-to-end in the browser against local Supabase: sign up → email in Mailpit →
click link → "Email confirmed" → sign in works; signing in before confirming shows
the resend button; an already-used link shows "Link expired".

## Left for later (milestone 4 unless noted)
- Host the web build publicly; set `EXPO_PUBLIC_EMAIL_CONFIRMED_URL` to its
  `/email-confirmed` page and add it to the hosted Supabase redirect allow-list.
- Custom SMTP sender (e.g. Resend or Postmark) on your own domain: hosted Supabase's
  built-in email is for testing only and sends just a few emails per hour.
- Branded email templates (milestone 8).
