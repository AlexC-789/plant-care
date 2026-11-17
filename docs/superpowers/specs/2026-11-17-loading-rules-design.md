# Loading rules and skeleton shimmer: design (small change)

Date: 2026-11-17
Status: Draft for approval
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

## Shimmer (owner chose the gentle sweep; amends "nothing loops")
- A soft light band sweeps across skeletons once every 1.6 s. Every skeleton on screen shares
  one timing, so a list reads as one surface.
- Faint: new tokens `skeleton` (base) and `skeletonHighlight` (band), light and dark.
- Shown only after 300 ms, so fast loads never flash. Content cross-fades in over 150 ms.
- Reduce Motion on → static skeletons, no sweep.
- Runs on the UI thread (Reanimated). Soft band edge via `expo-linear-gradient`.
- This is the only looping motion allowed in the app.

## Approaches
- **Gentle sweep (chosen):** reads as "working" and fits the ceramic-glaze world.
- Static (rejected): can look frozen on slow loads.
- Opacity pulse (rejected): a screen of blinking blocks looks cheap.

## Applying it now
- **`Skeleton` building block** in `src/ui/`: `Skeleton({ width, height, radius })`,
  `SkeletonText({ variant, width })` (height from the text style), `SkeletonRow` (an InsetGroup
  row placeholder), plus a delay hook so nothing shows for the first 300 ms.
- **App start:** keep the native splash screen up while the saved login is read (usually under
  100 ms) instead of showing a spinner, then show the real screen.
- **Settings:** the email row shows at once (it comes from the login). The Units rows and the
  Subscription value show skeletons until the profile loads, instead of an empty list and
  "Free (testing)".
- **Docs:** the three rules in `CLAUDE.md`; this note amends the app UI design.

## Testing
- `Skeleton`: hidden before 300 ms, then visible; static (no animation) with Reduce Motion;
  labelled for screen readers as "Loading" and hidden individually.
- Settings: skeletons while the profile is loading, real rows after; never "Free (testing)"
  before the profile arrives.
- App start: no spinner; the splash stays up until the session is known.
- Browser screenshots of Settings loading in light and dark.

## Left for later
Skeleton layouts for each new screen are built with that screen (milestone 2 onwards).
