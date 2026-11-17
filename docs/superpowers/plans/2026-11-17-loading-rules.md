# Loading Rules, Skeletons, Client Cache and Launch Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the three loading rules: a shimmering `Skeleton` building block, a TanStack Query client cache (profile first), Settings skeletons, and a launch animation that replaces any spinner.

**Architecture:** `src/ui/Skeleton.tsx` with a root `ShimmerProvider` holding one Reanimated shared value (one wave for the screen). `src/lib/queryClient.ts` + `QueryClientProvider` at the root; `useProfile` becomes a query + mutation keyed by user id; the cache is cleared on sign-out. `src/launch/LaunchAnimation.tsx` draws the pot drawing's strokes (react-native-svg + Reanimated `strokeDashoffset`) over the app until both the animation and the session are done.

**Tech Stack:** react-native-reanimated 4 (installed), expo-linear-gradient (new), @tanstack/react-query 5 (new), expo-splash-screen (installed), react-native-svg.

**Spec:** `docs/superpowers/specs/2026-11-17-loading-rules-design.md`

## Global Constraints
- Skeleton delay 300 ms; sweep period 1600 ms; content cross-fade 150 ms; launch animation ≈ 700 ms, ease-out, no bounce; Reduce Motion → static skeletons, 300 ms fade launch.
- New tokens `skeleton` / `skeletonHighlight` in `src/theme/colors.ts` (light `#ECE7DE` / `#F6F3ED`; dark `#2A2622` / `#35302A`).
- Skeletons: `accessibilityLabel="Loading"` on the group, individual blocks hidden from screen readers.
- No `ActivityIndicator` as a screen's loading state anywhere (button-internal busy spinners are fine).
- `useProfile` public interface unchanged: `{ profile, isLoading, error, update }`.
- Native splash: background `#F4F1EB`, image = PNG of the pot drawing.

## Review Focus
1. **Fast loads (< 300 ms)** → no skeleton flash at all. (Task 1)
2. **Sign out then sign in as another user** → no cached data from the first user. (Task 2)
3. **Session read slower than the animation** → animation holds on its last frame until the session is known; no blank frame, no spinner. (Task 4)
4. **App resumed from background** → launch animation does not replay. (Task 4)
5. **Profile load error with a cache present** → cached values stay shown; error text appears. (Task 2)

---

### Task 1: Skeleton + shimmer
**Files:** `src/theme/colors.ts` (tokens), `src/ui/Skeleton.tsx`, `src/ui/ShimmerProvider.tsx`, `src/ui/index.ts`, tests `src/ui/__tests__/skeleton.test.tsx`; `npx expo install expo-linear-gradient`.
**Produces:** `ShimmerProvider({children})`; `Skeleton({ width?: DimensionValue; height: number; radius?: number })`; `SkeletonText({ variant?: TextStyleName; width?: DimensionValue })`; `SkeletonRow({ withValue?: boolean })`; `useDelayedVisible(delayMs = 300): boolean`; `LoadingGroup({ children })` (accessible, label "Loading").
- [ ] Failing tests: nothing rendered before 300 ms, rendered after (fake timers); `LoadingGroup` exposes label "Loading" and its blocks are not accessible; with `useReducedMotion` → true no gradient band rendered; `SkeletonText` height = variant lineHeight.
- [ ] Implement; tests pass; commit `feat(ui): skeleton placeholders with a shared shimmer`.

### Task 2: Client cache (profile)
**Files:** `src/lib/queryClient.ts`, `src/app/_layout.tsx` (provider; clear on SIGNED_OUT), `src/profile/useProfile.ts`, tests `src/profile/__tests__/useProfile.test.tsx` (wrap in provider).
**Produces:** `queryClient: QueryClient` (retry 1, staleTime 30 s); query key `['profile', userId]`.
- [ ] Failing tests: second mount with a warm cache returns the profile immediately (`isLoading` false on first render); after a SIGNED_OUT auth event the cache is empty; failed refetch keeps cached profile and sets `error`; existing hook tests keep passing.
- [ ] Implement with `useQuery` / `useMutation` (`onSuccess` → `setQueryData`); commit `feat(data): TanStack Query client cache for the profile`.

### Task 3: Settings skeletons
**Files:** `src/app/(app)/settings.tsx`, `src/__tests__/settings.test.tsx`.
- [ ] Failing tests: while the profile is pending (after 300 ms) the Units group shows 3 skeleton rows and the Subscription row a skeleton value; `Free (testing)` is not shown; Email row shows the session email immediately; after load, real rows.
- [ ] Implement; commit `feat(ui): settings shows skeletons while the profile loads`.

### Task 4: Launch animation
**Files:** `src/launch/LaunchAnimation.tsx`, `src/launch/useLaunchGate.ts`, `src/app/_layout.tsx`, `src/ui/PotDrawing.tsx` (export path data), `app.json` (splash), `assets/images/splash-pot.png` (generated from the drawing), tests `src/launch/__tests__/launch.test.tsx`.
**Produces:** `POT_PATHS` (shared stroke data); `LaunchAnimation({ onDone })`; `useLaunchGate(sessionLoading: boolean): { showLaunch: boolean; onAnimationDone(): void }` — module-level flag so it plays once per process.
- [ ] Failing tests: root shows the launch overlay (label "Plant Care") and no ActivityIndicator while the session loads; overlay stays until both animation done and session known; with reduced motion `onDone` fires after 300 ms; a second mount of the root in the same process doesn't show it.
- [ ] Implement (SplashScreen.preventAutoHideAsync at module load, hideAsync on first layout of the overlay); generate the splash PNG; commit `feat(ui): launch animation draws the pot`.

### Task 5: Rules in docs + verify
- [ ] `CLAUDE.md`: the three loading rules, shimmer exception, client cache rule. Browser screenshots: Settings loading (throttled) light/dark, launch animation frames. Full checks; commit; push.
