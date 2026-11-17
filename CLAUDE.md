# Plant Care — project guide for Claude

Companion app for a self-watering device (saucer with ~705 ml tank + pump, stake with
capacitive moisture probe, ESP32-C3, Wi-Fi, LiPo). Users scan plants (Plant.id), keep a
plant library, see moisture / estimated water left / battery, and the backend generates
watering plans the device executes. Subscription model (RevenueCat, later).

- Spec (authority): `docs/superpowers/specs/2026-11-16-plant-care-design.md`
- Hardware: `docs/hardware/2026-11-16-saucer-and-stake-v1.md`
- Plans per milestone: `docs/superpowers/plans/`

## Layout

```
apps/mobile/          Expo (SDK 58) + Expo Router app, TypeScript strict
  src/app/            routes only: (auth)/ signed-out, (app)/ signed-in
  src/lib/            supabase client, generated database.types.ts
  src/auth/ src/profile/ ...   feature code + __tests__
  src/theme/          design tokens (colours light/dark, type, spacing, radii), useTheme(),
                      useIsAccessibilitySize(); the ONLY place colour values live
  src/ui/             shared building blocks: Text, Button, InsetGroup, Row, Icon, TextLink, PotDrawing
  src/test-utils/     supabaseMock for jest.mock('@/lib/supabase')
supabase/             config.toml, migrations/, tests/database/ (pgTAP),
                      functions/ (Edge Functions, Deno; tests: npm run fn:test)
```

Also read `apps/mobile/AGENTS.md` (Expo-specific rules: fetch versioned docs, don't trust memory).

## Commands (repo root)

`npm test` · `npm run typecheck` · `npm run lint` · `npm run db:start` · `npm run db:reset` ·
`npm run db:test` · `npm run db:types` · `npm run fn:test`. Run all of test/typecheck/lint/db:test/fn:test before calling work done.

## Rules

- Add Expo deps with `npx expo install` (in this cloud sandbox: `EXPO_OFFLINE=1 npx expo install`,
  the version API is blocked by the proxy).
- No secrets in the app. Only `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  Third-party keys (Plant.id, RevenueCat secret) live in Edge Function secrets.
- Every user-owned table: RLS on, owner-only policies, pgTAP tests proving it (incl. a
  cross-user test). Server-controlled columns (e.g. `subscription_status`) are never
  writable by `authenticated` — use column-level grants.
- Schema changes only via `supabase/migrations/`; then `npm run db:types`.
- Gate paid features only through `useEntitlement()`.
- Sign-up email check: `before-user-created` auth hook (Edge Function). It must fail open on
  DNS problems; its user-facing messages are mirrored in `apps/mobile/src/auth/authErrors.ts`.
  Edge Functions keep zero runtime npm deps (the local runtime may not reach npm).
- After changing `supabase/config.toml`, restart Supabase (`npx supabase stop` + `npm run db:start`).
- Email confirmation is ON (sign-up → sign-in; resend has a 60 s cooldown matching
  `max_frequency`). Local emails go to Mailpit: http://127.0.0.1:54324.
- UI follows `docs/superpowers/specs/2026-11-17-app-ui-design.md` (canvas linked there).
  Screens use `src/ui` + theme tokens only; raw colours outside `src/theme/` fail lint. Never cap
  font scaling (`maxFontSizeMultiplier`/`allowFontScaling={false}`). Icons: `Icon` (SF Symbols on
  iOS, Material Symbols elsewhere). No emoji.
- Don't add expo-status-bar's `<StatusBar>`: it hangs React's act() in Jest; the system style
  already follows light/dark.
- Route files only in `src/app/`; tests go in `src/**/__tests__/` (not under `src/app/`).
- Press handlers stay synchronous (`void doAsync()`); RNTL awaits async handlers.
- Watering safety limits (≤ 40 ml/dose, ≤ 150 ml/24 h, never pump when float switch is low,
  stop after 2 doses with no moisture rise) live in firmware and the shared watering module.
  Never relax them; plans must stay inside them.
- Test-first (superpowers TDD). Commit per task.
