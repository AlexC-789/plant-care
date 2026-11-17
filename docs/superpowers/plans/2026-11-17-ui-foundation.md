# UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved "Glazed Ceramic" look to every existing screen through a small in-house theme layer, with dark mode, large-text support, units "Automatic", and the empty-state line drawing.

**Architecture:** `src/theme/` holds tokens (colours light/dark, type styles, spacing, radii) plus `useTheme()` and `useIsAccessibilitySize()`. `src/ui/` holds the shared building blocks (`Text`, `Button`, `InsetGroup`, `Row`, `Icon`, `PotDrawing`). Screens use only these; an ESLint rule blocks raw colour literals outside `src/theme/`.

**Tech Stack:** Expo SDK 58, Expo Router native stack (large titles, formSheet), expo-symbols (SF Symbols / Material Symbols), react-native-svg, jest-expo, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-17-ui-foundation-design.md`, which applies `docs/superpowers/specs/2026-11-17-app-ui-design.md` (token tables are the source of truth).

## Global Constraints

- Colour values exactly as the app UI design's §3 table (light and dark).
- Type styles exactly as §3 Type (largeTitle 34/41 serif 500, title 28/34 serif 500, title3 20/25 serif 500, headline 17/22 600, body 17/22, callout 16/21, subheadline 15/20, footnote 13/18, caption1 12/16). Never set `maxFontSizeMultiplier` or `allowFontScaling={false}`.
- Serif family: iOS `ui-serif`, Android `serif`, web `ui-serif, "New York", Georgia, serif`.
- Spacing on the 4 pt grid; screen margin 16; rows ≥ 44 (inset group radius 22, capsule buttons).
- No raw colour literals outside `src/theme/` (lint error).
- Copy unchanged except: home title `Plants`; empty state `No plants yet` / `Adding pots arrives in the next build.`; sign-in title `Sign in to Plant Care`; Settings plan row values `Free (testing)` / `Active`; units options `Automatic`, `Metric`, `Imperial`.
- All CLAUDE.md rules.

## Review Focus

1. **Dark mode on every screen** (including header, sheet, inputs and placeholder text) → no white surfaces, all text readable. (Task 2 contrast test; Task 5 screenshots)
2. **Largest accessibility text size** → nothing truncated or overlapping on the auth form, home empty state and Settings rows (rows wrap; value moves under label). (Task 3 `Row` test at fontScale 3)
3. **Existing profile rows with `units = 'metric'`** → Settings shows Metric checked; new users get Automatic. (Task 1)
4. **Settings opened as a sheet then "Done"/swipe-down** → returns to Plants; sign-out from the sheet still lands on sign-in. (Task 4)
5. **Icons on Android/web** where SF Symbols don't exist → equivalent Material symbol renders, no blank square. (Task 3 `Icon` test)

---

### Task 1: Units "Automatic" (DB + Settings logic)

**Files:** Create `supabase/migrations/20261117000000_units_auto.sql`; Modify `supabase/tests/database/profiles.test.sql`, `apps/mobile/src/lib/database.types.ts` (regenerated), tests referencing `units`.

- [ ] **Step 1: Failing pgTAP:** new profile defaults to `units = 'auto'`; `update … set units = 'auto'` allowed for the owner; `'furlongs'` still rejected. Plan count updated.
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Migration: drop the existing units check constraint, add `check (units in ('auto','metric','imperial'))`, `alter column units set default 'auto'`. Existing rows untouched.
- [ ] **Step 4:** `npm run db:reset && npm run db:test` → PASS; `npm run db:types`.
- [ ] **Step 5: Commit** `feat(db): units default to automatic`.

### Task 2: Theme tokens, hooks, contrast test, lint rule

**Files:** Create `apps/mobile/src/theme/{colors.ts,typography.ts,spacing.ts,index.ts,contrast.ts}`, tests `src/theme/__tests__/{contrast.test.ts,hooks.test.tsx}`; Modify `apps/mobile/eslint.config.js`.

**Interfaces — Produces:**
- `type ColorToken` = keys of the design's colour table (`background, surface, label, secondaryLabel, separator, tint, onTint, statusFine, statusSoon, statusNow, statusQuiet, water, waterFill, band, nowFill, soonFill`; `onTint` = white light / `#0F2419` dark).
- `colors: Record<'light'|'dark', Record<ColorToken,string>>`.
- `type TextStyleName = 'largeTitle'|'title'|'title3'|'headline'|'body'|'callout'|'subheadline'|'footnote'|'caption1'`; `typography: Record<TextStyleName, TextStyle>`.
- `space = {xs:4, s:8, m:12, l:16, xl:20, xxl:24, xxxl:32, touch:44}`; `radius = {thumb:14, group:22, capsule:999}`.
- `useTheme(): { scheme: 'light'|'dark'; colors: Record<ColorToken,string> }` (from `useColorScheme`, default light).
- `useIsAccessibilitySize(): boolean` = `useWindowDimensions().fontScale > 1.4`.
- `contrastRatio(a: string, b: string): number` (WCAG relative luminance).

- [ ] **Step 1: Failing tests:** `contrastRatio('#000000','#FFFFFF')` = 21 (±0.01); for both schemes `label`, `secondaryLabel`, `tint`, `statusNow` vs `surface` ≥ 4.5 and vs `background` ≥ 4.5; `onTint` vs `tint` ≥ 4.5; `useTheme` returns dark colours when `useColorScheme` is mocked `'dark'`; `useIsAccessibilitySize` false at fontScale 1.3, true at 1.5.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** ESLint: `no-restricted-syntax` on `Literal[value=/^#(?:[0-9a-fA-F]{3,4}){1,2}$/]` and `/^rgba?\(/`, message "Use a theme colour token"; `ignores` for `src/theme/**` and `**/__tests__/**`. `npm run lint` now lists existing violations (fixed in Tasks 3–4).
- [ ] **Step 6: Commit** `feat(ui): theme tokens, contrast checks and colour lint rule`.

### Task 3: Building blocks

**Files:** Create `apps/mobile/src/ui/{Text.tsx,Button.tsx,InsetGroup.tsx,Row.tsx,Icon.tsx,PotDrawing.tsx,index.ts}`, tests `src/ui/__tests__/*.test.tsx`.

**Interfaces — Produces:**
- `Text({ variant?: TextStyleName = 'body', color?: ColorToken = 'label', ...TextProps })`.
- `Button({ label, onPress, variant?: 'prominent'|'bordered'|'plain' = 'prominent', disabled?, busy?, destructive? })`: capsule, min height 44, `accessibilityRole="button"`, `accessibilityLabel={label}`, `accessibilityState={{disabled, busy}}`; prominent = `tint` bg + `onTint` text; bordered = `tint` hairline + `tint` text; plain = `tint` text (destructive → `statusNow`).
- `InsetGroup({ header?: string, footer?: string, children })`: `surface` bg, radius 22, hairline `separator` between children; header `subheadline` 600 `secondaryLabel`, footer `footnote` `secondaryLabel`.
- `Row({ label, value?, accessory?: 'chevron'|'checkmark'|'none', onPress?, destructive?, children? })`: min height 44, padding 16; at accessibility size the value wraps under the label.
- `Icon({ name: 'account' | 'checkmark' | 'chevronRight' | 'error', size?: number = 22, color?: ColorToken = 'label' })` mapping to SF `person.crop.circle`/`checkmark`/`chevron.right`/`exclamationmark.circle.fill` and Material `account_circle`/`check`/`chevron_right`/`error`.
- `PotDrawing({ width?: number = 160 })`: hairline (1.5) `secondaryLabel` drawing of saucer + pot + stake, `accessibilityLabel="Drawing of a pot standing on the watering saucer, with the sensor stake in the soil"`.

- [ ] **Step 1: Failing tests:** `Button` prominent uses tint bg / onTint text; disabled state exposed; `Row` with `accessory="checkmark"` renders the checkmark icon and `accessibilityState.selected`; `Row` at fontScale 3 (mock `useWindowDimensions`) stacks value below label (flexDirection `column`); `Icon` passes `{ios:'person.crop.circle', android:'account_circle', web:'account_circle'}` to `SymbolView` (mock `expo-symbols`); `PotDrawing` has its accessibility label; `Text` applies the variant's fontSize and the token colour in dark mode.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(ui): shared building blocks and pot drawing`.

### Task 4: Restyle screens

**Files:** Modify `src/app/_layout.tsx`, `src/app/(app)/_layout.tsx`, `src/app/(app)/index.tsx`, `src/app/(app)/settings.tsx`, `src/app/(auth)/_layout.tsx`, `src/app/(auth)/sign-in.tsx`, `src/auth/AuthForm.tsx`, `src/app/email-confirmed.tsx`, related tests.

- [ ] **Step 1: Update/failing tests:** home shows `Plants` (header title option), `No plants yet`, `Adding pots arrives in the next build.` and the drawing's label; header button labelled `Settings` opens `/settings`; Settings shows rows `Automatic`/`Metric`/`Imperial` with the profile's value selected, pressing `Automatic` calls `update({ units: 'auto' })`; plan row `Free (testing)`; `Done` returns to `/`; sign-in heading `Sign in to Plant Care`; all existing auth/settings tests still pass with the new copy.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement:
  - Root: `ThemeProvider` from `@react-navigation/native` fed with theme colours; `StatusBar style="auto"`; root background `background`.
  - `(app)` stack: index `headerLargeTitle: true`, `headerLargeTitleStyle` serif, `headerShadowVisible: false`, header bg `background`, `headerRight` = icon button (`Icon name="account"`, 44×44, label `Settings`); `settings` screen `presentation: 'formSheet'` (iOS) with `headerLeft`/`headerRight` `Done` (plain tint).
  - Home: centred empty state (PotDrawing, `title3` serif heading, `subheadline` secondary body).
  - Settings: `InsetGroup` Profile (display name `TextInput` row), Units (3 checkmark rows), Plan (row value), Account (Email row value, Sign out plain destructive centred row).
  - AuthForm: paper background, serif `title`, inputs in an `InsetGroup` (hairline between), placeholder `secondaryLabel`, error `statusNow` with `Icon error`, notice `label`, prominent `Button`, bordered resend `Button`, footer link `tint`.
  - Email confirmed: same language.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint` → all pass (lint clean = no raw colours left).
- [ ] **Step 5: Commit** `feat(ui): restyle screens in the Glazed Ceramic look`.

### Task 5: Verify visually and document

- [ ] **Step 1:** Browser screenshots (Playwright, 390×844) of sign-in (+ error/resend), sign-up, home, settings, email-confirmed in light and dark; compare against the unslop audit list; fix anything left.
- [ ] **Step 2:** `CLAUDE.md`: theme/ui layout and the "tokens only" rule.
- [ ] **Step 3:** `npm test && npm run typecheck && npm run lint && npm run db:test` → all pass. **Commit** `docs: theme and UI conventions`; push.
