# Loading rules and skeleton shimmer: design (small change)

Date: 2026-11-17
Status: Approved 2026-11-17
Amends: [App UI design](2026-11-17-app-ui-design.md) §3 Motion and §5 loading states

## Intent
Every screen feels instant and calm: it appears at once with its real layout, data fills in
afterwards, and anything still loading shows a placeholder in the shape of what's coming.

## Standing rules (owner, 2026-11-17), for every screen from now on
1. **Lazy loading.** Nothing loads before it's needed:
   - data is fetched per screen, on demand, and paged (lists, histories); never "everything up front";
   - images use `expo-image`, load when shown, and are cached;
   - long lists are virtualised (`FlatList`/`FlashList`), never `ScrollView` + `map`;
   - heavy, rarely used modules (camera, charts) load when their screen opens. Routes are
     already split on web by Expo Router.
2. **UI before data.** A screen renders its full layout (titles, sections, buttons) immediately
   and never waits for data to appear. No blank screens, and no full-screen spinners.
3. **Loading looks like the UI.** Anything waiting for data shows a `Skeleton` in its own shape
   (text line, photo block, row) until the data arrives, then cross-fades to the content.

## Client cache (owner, 2026-11-17)
- Server data on the phone goes through one client cache (TanStack Query): a screen shows
  what it loaded last time instantly, then refreshes in the background. This is the "cache"
  that matters at this scale. No Redis: Postgres handles this load, and a server cache outside
  RLS risks showing one user another's data. Revisit Redis/Upstash for rate limiting, or if
  database CPU stays above ~60%.
- Applied now to the profile (`useProfile`), so Settings opens instantly on a second visit.
  Cached data is cleared on sign-out.

## Launch animation (owner, 2026-11-17)
- On a cold start, after the native splash, the app plays a short logo animation, then
  cross-fades into the first screen.
- **Logo (placeholder until a real one exists):** the app's hairline drawing (saucer, pot,
  stake). The animation **draws the lines in** like a pen sketch, then the leaves settle,
  about 700 ms in total, ease-out, no bounce. Paper background, `secondaryLabel` ink.
- It plays *while* the saved login is read, so it never adds waiting on top. The first screen
  appears when both are done (normally right at the end of the animation).
- Cold start only, not when returning from the background. Reduce Motion: the drawing simply
  fades in and out (300 ms).
- The native splash is plain paper (no image) and is hidden from the overlay's first layout,
  so the hand-off is paper to paper and the drawing appears once, as it sketches itself in.
  (Changed in review: a static drawing on the splash blanked and redrew.) The overlay fades
  out into the first screen (250 ms; 150 ms with Reduce Motion).

## Shimmer (owner chose the gentle sweep; amends "nothing loops")
- A soft light band sweeps across skeletons once every 1.6 s. Every skeleton on screen shares
  one timing, so a list reads as one surface.
- Faint: new tokens `skeleton` (base) and `skeletonHighlight` (band), light and dark.
- Shown only after 300 ms, so fast loads never flash. Content cross-fades in over 150 ms.
- Reduce Motion on → static skeletons, no sweep.
- Runs on the UI thread (React Native `Animated`, native driver). Soft band edge via
  `expo-linear-gradient`.
- This is the only looping motion allowed in the app.

## Approaches
- **Gentle sweep (chosen):** reads as "working" and fits the ceramic-glaze world.
- Static (rejected): can look frozen on slow loads.
- Opacity pulse (rejected): a screen of blinking blocks looks cheap.

## Applying it now
- **`Skeleton` building block** in `src/ui/`: `Skeleton({ width, height, radius })`,
  `SkeletonText({ variant, width })` (height from the text style), `SkeletonRow` (an InsetGroup
  row placeholder), plus a delay hook so nothing shows for the first 300 ms.
- **App start:** native splash (static drawing) → launch animation (above) → first screen.
  No spinner.
- **Settings:** the email row shows at once (it comes from the login). The Units rows and the
  Subscription value show skeletons until the profile loads, instead of an empty list and
  "Free (testing)".
- **Docs:** the three rules in `CLAUDE.md`; this note amends the app UI design.

## Testing
- `Skeleton`: hidden before 300 ms, then visible; static (no animation) with Reduce Motion;
  labelled for screen readers as "Loading" and hidden individually.
- Settings: skeletons while the profile is loading, real rows after; never "Free (testing)"
  before the profile arrives.
- App start: no spinner; the launch animation shows until both it has finished and the
  session is known; Reduce Motion uses the fade; it doesn't replay on resume.
- `useProfile` through the cache: second open shows cached data with no skeleton; sign-out
  clears it.
- Browser screenshots of Settings loading in light and dark.

## Left for later
Skeleton layouts for each new screen are built with that screen (milestone 2 onwards).
