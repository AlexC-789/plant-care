# Email Domain Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject sign-ups whose email domain is disposable or can't receive mail, server-side, before the account is created.

**Architecture:** Supabase `before_user_created` HTTP auth hook → Edge Function `before-user-created` (Deno). Pure decision logic in `check.ts` with DNS injected; `index.ts` verifies the Standard Webhooks signature and maps the decision to the hook response.

**Tech Stack:** Supabase Edge Functions (Deno 2), `npm:standardwebhooks`, Deno test (`deno` npm package as a root devDependency), Jest for the app message.

**Spec:** `docs/superpowers/specs/2026-11-17-email-domain-check-design.md`

## Global Constraints
- Copy (verbatim): disposable → `Use a permanent email address. Temporary inboxes can't be used.`; no mail → `This email domain can't receive mail. Check the address.`
- DNS timeout 2 s; any lookup error other than "domain doesn't exist" → allow (fail open).
- Only the domain is looked up.
- Hook reject response: `{ "error": { "http_code": 400, "message": <copy> } }`; allow: `{}`; bad signature: 401.

## Review Focus
1. **Uppercase or whitespace in the address** (`X@Mailinator.COM `) → still matched. (Task 1)
2. **Subdomain of a disposable domain** (`a@inbox.mailinator.com`) → rejected. (Task 1)
3. **Domain with no MX but an A record** → allowed (implicit MX). (Task 1)
4. **DNS lookup throws or times out** → allowed. (Task 1)
5. **Hook message reaching the app** → shown verbatim on the sign-up screen, form stays usable. (Task 3)

---

### Task 1: Decision logic (`check.ts`)
**Files:** Create `supabase/functions/before-user-created/{check.ts,check_test.ts,disposable_domains.ts}`; root `package.json` (devDependency `deno`, script `fn:test`: `deno test --allow-read supabase/functions`).
**Produces:** `type Lookup = (domain: string, type: 'MX'|'A'|'AAAA') => Promise<string[]>` (throws `NotFound` error class exported as `DomainNotFound` for NXDOMAIN); `checkEmail(email: string, lookup: Lookup, timeoutMs = 2000): Promise<{ ok: true } | { ok: false; message: string }>`; `DISPOSABLE: Set<string>`.
- [ ] Failing tests for every Review Focus 1–4 case plus: MX present → ok; NXDOMAIN → no-mail message; no MX/A/AAAA → no-mail message; lookup slower than timeout → ok; `mailinator.com` → disposable message (checked before DNS: lookup not called).
- [ ] Run `npm run fn:test` → FAIL; implement; → PASS. Commit `feat(auth): email domain check logic`.

### Task 2: Edge Function + hook config
**Files:** Create `supabase/functions/before-user-created/index.ts`, `supabase/functions/before-user-created/index_test.ts`, `supabase/functions/.env.example`; Modify `supabase/config.toml` (`[auth.hook.before_user_created] enabled = true`, `uri = "http://host.docker.internal:54321/functions/v1/before-user-created"`, `secrets = "env(BEFORE_USER_CREATED_HOOK_SECRET)"`; `[functions.before-user-created] verify_jwt = false`), `.gitignore`/`supabase/.env` handling.
**Produces:** `handler(req: Request, deps: { secret: string; lookup: Lookup }): Promise<Response>`; real lookup = `Deno.resolveDns` mapping `NotFound` → `DomainNotFound`.
- [ ] Failing tests: unsigned → 401; signed + disposable → 200 with reject body; signed + ok → 200 `{}`.
- [ ] Implement; PASS; local end-to-end via `supabase.auth.signUp` against local stack: `x@ajshs.fur`, `x@mailinator.com` rejected, `x@gmail.com` allowed. Commit `feat(auth): before-user-created hook`.

### Task 3: App message + docs
**Files:** Modify `apps/mobile/src/auth/authErrors.ts` (+ test), `README.md`, `CLAUDE.md`.
- [ ] Failing test: `authErrorMessage({ status: 400, message: <each copy> })` returns the copy; sign-up screen shows it.
- [ ] Implement (pass through exactly those two messages); docs: restart Supabase after config changes; hook secret setup; `npm run fn:test`. Full checks; commit; push.
