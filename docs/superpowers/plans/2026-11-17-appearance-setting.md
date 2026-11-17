# Appearance Setting and Launch Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Light by default with a Settings switch to Dark (saved on the phone), and a launch animation that rests ~500 ms on the finished drawing.

**Architecture:** `src/theme/appearance.ts` holds the preference in a tiny external store (`useSyncExternalStore`), persisted in AsyncStorage and mirrored to `Appearance.setColorScheme` where the platform supports it (native keyboard/alerts). `useTheme` reads the preference instead of the system scheme. The root waits for the stored preference (a few ms) before mounting the launch overlay, which hides the native splash.

**Spec:** `docs/superpowers/specs/2026-11-17-appearance-setting-design.md`

## Global Constraints
- Preference values `'light' | 'dark'`; default `'light'`; AsyncStorage key `plant-care.appearance`.
- `app.json`: `userInterfaceStyle: "light"`; splash plugin has no `dark` variant.
- Launch: drawing ≈ 700 ms + rest 500 ms → `LAUNCH_DURATION_MS = 1200`; fade-out unchanged; Reduce Motion unchanged.
- Copy: Settings group header `Appearance`; rows `Light`, `Dark`.

## Review Focus
1. Phone in dark mode, no saved choice → app light. (Task 1)
2. Saved Dark → launch overlay already dark (not light then dark). (Task 1/3)
3. Corrupt/unknown stored value → light, no crash. (Task 1)
4. Storage failure on save → the switch still applies for this session. (Task 1)
5. Sign out → preference kept. (Task 2)

### Task 1: Preference store
Files: `src/theme/appearance.ts`, `src/theme/index.ts` (`useTheme` reads it), `jest.setup.js` (AsyncStorage mock), tests `src/theme/__tests__/appearance.test.tsx`, update `hooks.test.tsx`.
Produces: `type Appearance = 'light'|'dark'`; `useAppearance(): { appearance: Appearance; setAppearance(a: Appearance): void }`; `loadStoredAppearance(): Promise<void>`; `useAppearanceLoaded(): boolean`; `resetAppearanceForTests()`.
- [ ] Failing tests for Review Focus 1, 3, 4; dark choice updates `useTheme().colors` to dark, persists, calls `Appearance.setColorScheme('dark')`. Implement. Commit.

### Task 2: Settings → Appearance
Files: `src/app/(app)/settings.tsx`, `src/__tests__/settings.test.tsx`.
- [ ] Failing tests: Light checked by default; pressing Dark checks Dark and stores it; signing out keeps it. Implement (group above Units). Commit.

### Task 3: Root + launch timing + config
Files: `src/app/_layout.tsx`, `src/launch/LaunchAnimation.tsx`, `app.json`, launch tests.
- [ ] Failing tests: overlay not mounted until the preference has loaded; `onDone` not before 1100 ms, called by ~1250 ms. Implement (`Animated.sequence([draw, delay(500)])`). Config change. Commit.

### Task 4: Docs + verify
- [ ] CLAUDE.md (appearance rule), app UI design note; browser screenshots (Settings light/dark; launch frames at 900 ms); full checks; push.
