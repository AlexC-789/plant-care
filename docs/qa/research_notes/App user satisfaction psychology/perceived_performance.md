# Perceived performance and response-time psychology in mobile apps

Research notes, 2026-11-19. Scope: evidence-based thresholds and techniques for making the plant-care app
(Expo / React Native, iOS + Android + web) feel fast, and which of them a QA pipeline can check automatically.
App rules under review: full layout rendered immediately; skeletons only after 300 ms (`LoadingGroup`);
arriving content fades in over 150 ms; cached TanStack Query data shown instantly (24 h) and refreshed in the
background; ~1.2 s launch animation (pot draw ~0.7 s + 0.5 s rest + fade) once per app run; no full-screen spinners.

Evidence quality legend used below: **[primary]** platform docs or peer-reviewed paper read this session;
**[secondary]** summary of a primary source I could not open; **[weak]** blog / vendor claim / folklore.

## 1. Established response-time thresholds and how well they hold on mobile

### Takeaway
The canonical 0.1 s / 1 s / 10 s limits (Miller 1968, Card et al. 1991, Nielsen 1993) are old, desktop-era,
and rest on expert synthesis rather than modern mobile experiments, but every current platform standard
(Google RAIL, Core Web Vitals INP 200 ms, Android vitals frame/ANR limits, Apple's 400 ms first frame) still
lands on the same three bands. The Doherty "400 ms" figure is widely repeated but its primary text could not be
verified; treat it as folklore-adjacent.

### Cited Findings
- **0.1 s** = feels instantaneous, no feedback needed beyond showing the result; **1.0 s** = flow of thought
  uninterrupted though the delay is noticed; **10 s** = limit for keeping attention, needs feedback with an
  expected finish time (percent-done for > ~10 s). For 2-10 s waits, a busy indicator suffices. Source dated
  1 January 1993 (excerpt of *Usability Engineering*), attributing the limits to Miller (1968) and Card et al.
  (1991); a 2014 update re-applies them to web apps and adds "show the system is working" above 1 s. [primary, old]
  — [NN/g, Response Times: The 3 Important Limits](https://www.nngroup.com/articles/response-times-3-important-limits/)
- **Google RAIL**: Response — finish user-initiated transitions within 100 ms, process input in 50 ms; Animation —
  produce each frame in ≤ 10 ms (16 ms budget minus ~6 ms browser overhead); Idle — background work in ≤ 50 ms
  chunks; Load — interactive within 5 s on a mid-range phone on slow 3G for first load, < 2 s for subsequent
  loads. Perception bands: 0-16 ms motion smoothness; 0-100 ms immediate; 100-1000 ms still a continuous flow;
  1000+ ms users lose focus; 10 000+ ms frustration and abandonment. The page notes users tolerate longer waits on
  mobile, and that **Core Web Vitals is now the recommended approach over RAIL**. [primary]
  — [web.dev, RAIL](https://web.dev/articles/rail)
- **INP** (successor to FID; observes all click/tap/keyboard interactions): good ≤ 200 ms, needs improvement
  200-500 ms, poor > 500 ms, assessed at the 75th percentile of page loads, segmented by mobile and desktop.
  [primary] — [web.dev, INP](https://web.dev/articles/inp)
- **Doherty threshold**: Doherty & Thadani, "The Economic Value of Rapid Response Time" (IBM, 1982) is widely
  credited with setting 400 ms instead of the earlier 2 s standard, but the 400 ms figure could not be confirmed
  in the primary text; a Computer History Museum archive copy of IBM material only shows that transactions per
  hour rise noticeably as response time falls. Popular figures (e.g. ~180 transactions/h at 3 s vs ~371 at 0.3 s)
  are unverified. A 1983 NYU follow-up (Barber & Lucas) found productivity fell as response time rose and errors
  rose above 12 s. [secondary/weak] — [Laws of UX, Doherty Threshold](https://lawsofux.com/doherty-threshold/);
  [Computer History Museum archive PDF](https://archive.computerhistory.org/resources/access/text/2024/03/102751398-05-01-acc.pdf);
  [NYU archive, Barber & Lucas record](https://archive.nyu.edu/handle/2451/14592?mode=full)
- Note that the 1982 IBM work measured mainframe terminal productivity (transactions per hour), not consumer
  satisfaction on phones. [secondary] — [Laws of UX](https://lawsofux.com/doherty-threshold/);
  [Kent Beck, "The Precious Eyeblink"](https://newsletter.kentbeck.com/p/the-precious-eyeblink?open=false)
- **Apple**: WWDC 2019 session 423 "Optimizing App Launch" sets the goal of rendering the first frame within
  400 ms; the system uses ~100 ms, leaving the app ~300 ms. The figure is tied to the length of the launch zoom
  animation (a 2012 WWDC session gave 400-500 ms for the same reason). It is a target, not an OS kill limit.
  [primary via secondary summary] — [WWDC19 423](https://developer.apple.com/videos/play/wwdc2019/423/);
  [Emerge Tools docs](https://docs.emergetools.com/docs/startup-flame-chart);
  [Antoine van der Lee](https://www.avanderlee.com/optimization/launch-time-performance-optimization/)
- **Android frame budget**: 16 ms per frame for 60 fps, 11 ms for 90 fps, 8 ms for 120 fps; missing the window
  by 1 ms drops the whole frame (Choreographer), perceived as stutter ("jank"). [primary]
  — [Android Developers, Slow rendering](https://developer.android.com/topic/performance/vitals/render)

### Inferences
- The bands are robust as engineering conventions because independent bodies converge on them (100 ms
  immediate, ~1 s flow, ~10 s attention), even though the original evidence is old and desktop-based. Use them as
  budgets, not as proven satisfaction curves.
- For a phone app the useful QA numbers are: input feedback ≤ 100 ms; a tap that navigates should show the next
  screen's layout within ~100-200 ms (the app's "UI before data" rule already targets this); data waits < 1 s
  need no indicator; 1-10 s need a skeleton/indicator; > 10 s need progress with an estimate.
- The "400 ms Doherty" number should not be presented as an empirical finding in QA docs; Apple's 400 ms
  first-frame target is the better-sourced 400 ms figure.

### Gaps
- No modern peer-reviewed study was found that re-validates 0.1/1/10 s specifically on touch phones.
- Could not open the Doherty & Thadani primary text (IBM report GE20-0752-0 cited by one source).
- WWDC19 transcript itself was not fetched; the 400 ms / 100 ms split comes from secondary summaries of it.

## 2. Skeleton screens vs spinners vs blank vs progress bars; the 300 ms delay and 150 ms fade

### Takeaway
Controlled evidence on skeletons is thin and contradictory: Mejtoft et al. (2018, ECCE) found skeletons rated
faster/easier than spinners, while Viget's online test (n = 136) found skeletons perceived as *slowest*. Expert
guidance (NN/g) agrees on duration bands: nothing under ~1 s, skeleton/spinner for 2-10 s, progress bar > 10 s.
A 200-500 ms delay before showing a loader is a common, sensible convention (no controlled study found), and
the matching rule "once shown, keep it at least ~400 ms" is worth adding. 150 ms fade-in is within normal UI
motion durations but no study tests it specifically.

### Cited Findings
- **Mejtoft, Långström & Söderström (2018)**, "The effect of skeleton screens: Users' perception of speed and ease
  of navigation", Proc. 36th European Conference on Cognitive Ergonomics (ECCE'18): user test on a fictional news
  site, skeleton version vs spinner version; the skeleton version scored higher on average for perceived speed
  and ease of navigation. Sample size and statistics could not be verified. [secondary]
  — [search summary via uxdesign.cc](https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a?gi=333c21cddca9);
  cited by [NN/g, Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/)
- **Viget (2017)**, "A Bone to Pick with Skeleton Screens": 136 participants, blank vs spinner vs skeleton; the
  skeleton performed worst on all metrics, mean perceived wait 2.82 s (skeleton) vs 2.41 s (spinner) vs 2.29 s
  (blank). [secondary — page returned HTTP 429, numbers from search snippet; small online study, single trial]
  — [Viget](https://viget.com/articles/a-bone-to-pick-with-skeleton-screens);
  [Medium mirror](https://medium.com/viget-collection/a-bone-to-pick-with-skeleton-screens-eb006536ca1c)
- **NN/g, "Skeleton Screens 101"** (Tankala, 4 June 2023, reviewed 2 Sep 2026): under 1 s, skeletons and spinners
  are generally unnecessary and "a quick flash of a placeholder can make users feel they can't keep up"; 2-10 s,
  spinner for a single module, skeleton for full-page loads; > 10 s, progress bar ("anything above 10 seconds
  requires an explicit estimation of duration"). Skeletons "create the illusion of a shorter wait" and don't
  replace optimisation. Animated (shimmer/pulse) skeletons can be distracting or cause accessibility problems;
  frame-display skeletons (header/footer only) are not recommended — equivalent to a spinner and can look broken.
  [primary, expert guidance not experiment] — [NN/g](https://www.nngroup.com/articles/skeleton-screens/)
- **Progress bars**: Harrison, Amento, Kuznetsov & Bell, "Rethinking the Progress Bar" (UIST 2007): non-linear
  progress behaviours change perceived duration with the real duration unchanged. Harrison, Yeo & Hudson, "Faster
  Progress Bars" (CHI 2010, Best Paper Honorable Mention): backwards-moving, decelerating ribbing reduced perceived
  duration by 11%. [primary-adjacent, old] — [Chris Harrison, Progress Bars](https://www.chrisharrison.net/index.php/Research/ProgressBars);
  [Faster Progress Bars](https://www.chrisharrison.net/index.php/Research/ProgressBars2)
- **Loader delay conventions** (design systems, not experiments): Learning Equality's design system waits 300 ms
  before showing a loader and keeps it visible at least 400 ms once shown, because a loader on fast operations
  "can cause visual disruption resulting in worse experience than showing nothing at all"; Inertia.js uses
  250-500 ms; Oracle APEX's `delayLinger` exists to stop indicators flashing. [weak — conventions]
  — [Learning Equality design system](https://design-system.learningequality.org/loaders);
  [Inertia.js](https://legacy.inertiajs.com/progress-indicators);
  [Oracle APEX delayLinger](https://docs.oracle.com/en/database/oracle/apex/24.2/aexjs/apex.util.delayLinger.html);
  [Phoenix/Fly.io, delayed loading indicator](https://fly.io/phoenix-files/make-your-liveview-feel-faster/)
- Android: animate drawing properties (translation, rotation, alpha) rather than layout properties to avoid
  dropped frames. [primary] — [Android Developers, Slow rendering](https://developer.android.com/topic/performance/vitals/render)
- Secondary sources quote inconsistent NN/g skeleton windows (2-10 s, 400 ms-3 s, 500 ms); only the NN/g article
  itself (above) is reliable. [weak] — [NN/g video](https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/)

### Inferences
- The app's 300 ms skeleton delay is consistent with NN/g's "don't flash a placeholder for sub-second loads" and
  with common design-system practice. Evidence for exactly 300 ms (vs 200 or 500) does not exist; it is a
  defensible convention. A complementary **minimum display time (~400 ms) once a skeleton appears** is the usual
  partner rule and prevents a 300-350 ms load from producing a 50 ms skeleton flash (check whether `LoadingGroup`
  already does this).
- The mixed skeleton evidence suggests skeletons are not magic; their benefit is mainly "the layout is already
  there and nothing jumps". The app's "full layout immediately" rule matters more than the skeleton style. A
  layout-shift check (skeleton and final content occupy the same boxes) is the testable version of this.
- NN/g's warning about shimmer being distracting supports the app's rule that shimmer is static under Reduce
  Motion and only runs while a skeleton is mounted.
- 150 ms fade-in: short enough to stay near the 100 ms "instant" band, long enough to avoid a hard pop; it uses
  opacity (a cheap, native-driver property). Reasonable, but evidence-free in the strict sense.
- No full-screen spinners is consistent with NN/g (spinners for single modules, not pages).

### Gaps
- Facebook and LinkedIn skeleton "reports" and the "Bill Chung" study were not found in primary form; the
  frequently quoted numbers about them could not be verified and should be treated as folklore.
- Mejtoft et al.'s sample size, effect sizes and DOI could not be retrieved.
- Material 3 motion duration tokens page did not render (JS-only); could not cite platform motion durations for
  the 150 ms fade.
- No controlled study found comparing loader delays (e.g. 0 vs 300 vs 1000 ms).

## 3. Optimistic UI, instant cached data, stale-while-revalidate: perceived speed and trust

### Takeaway
No controlled study was found on optimistic UI or stale-while-revalidate and perceived speed or trust; available
material is engineering opinion. The consistent practitioner position: show cached data instantly, use optimistic
updates only where rollback is rare and harmless, and avoid them for destructive or consequential actions.

### Cited Findings
- Optimistic updates trade perceived speed against rollback complexity and "erosion of user trust when a
  previously-confirmed action visibly fails"; a rollback is "jarring and potentially damaging to trust". [weak]
  — [skill-wiki, Optimistic Update Tradeoff](https://skill-wiki.github.io/atom/frontend-design/fact-optimistic-update-tradeoff);
  [OpenReplay blog](https://blog.openreplay.com/optimistic-updates-make-apps-faster/)
- Use optimistic updates where rollback risk is low and the speed reward high; avoid them for financial or
  destructive actions. [weak] — [DEV Community](https://dev.to/hassantayyab/why-your-app-feels-slow-and-how-optimistic-updates-fix-it-18m9);
  [oneuptime blog](https://oneuptime.com/blog/post/2026-01-15-react-optimistic-updates-react-query/view)
- Figures like "immediate feedback reduces perceived wait by up to 40%" or "2-3x faster" circulate without a
  cited study. [weak — treat as folklore] — [DEV Community](https://dev.to/samuel_ochaba_eb9c875fa89/optimistic-ui-updates-why-your-app-feels-slow-when-its-actually-fast-3o19)
- Android startup guidance: "Load and display your UI with placeholder data first, and then later update visual
  properties", i.e. render first, fill later. [primary] — [Android Developers, App startup time](https://developer.android.com/topic/performance/vitals/launch-time)
- Android splash guidance: "Introducing an incomplete interface can be jarring for users and might give an
  impression of unpredictability or lack of polish." [primary]
  — [Android Developers, Splash screens](https://developer.android.com/develop/ui/views/launch/splash-screen)

### Inferences
- For this app, instant cached data is the strongest perceived-speed lever (0 ms to content on revisit). The trust
  risk is specific: device state (moisture, water left, battery) that is hours old but looks live. Stale values
  that later jump could mislead watering decisions. A visible "updated X min ago" for device readings is the
  usual mitigation; the existing rule "failed load with no cache shows '—', never a guessed value" is consistent.
- Watering commands and deletes are exactly the "consequential / destructive" class where optimistic UI is
  discouraged; confirm-then-show is the safer pattern there.
- Testable: on a warm cache, the screen shows cached values in the first rendered frame (no skeleton); background
  refresh must not shift layout; a changed value replaces in place.

### Gaps
- No peer-reviewed study found on SWR / cached-data trust or on optimistic-UI rollback effects on trust.
- Daniel Eden's "Optimistic UI" (Facebook, 2016) was referenced secondhand and not opened.

## 4. App start-up tolerance, and whether launch/splash animations help or hurt

### Takeaway
Android vitals flags cold start ≥ 5 s, warm ≥ 2 s, hot ≥ 1.5 s as excessive (measured to first frame, TTID);
Apple targets the first frame within 400 ms. Android states user research shows animated splash screens lower
perceived startup time, but recommends the icon animation not exceed 1,000 ms on phones and that it be
skippable when the app is ready early. A fixed ~1.2 s branded animation on every cold start exceeds Google's
duration recommendation and adds unconditional time to content; it is a moderate risk.

### Cited Findings
- Android vitals excessive startup: cold ≥ 5 s, warm ≥ 2 s, hot ≥ 1.5 s, using TTID (time to first frame).
  These are "this is a problem" thresholds, not targets; a splash screen can score well on TTID while the app is
  unusable for seconds longer. Play Console data comes from Android 10+. [primary + secondary]
  — [Android Developers, App startup time](https://developer.android.com/topic/performance/vitals/launch-time);
  [Luciq](https://www.luciq.ai/blog/understanding-cold-hot-and-warm-app-launch-time);
  [Newly guide](https://newly.app/guides/app-startup-time); [Embrace](https://embrace.io/blog/why-should-you-care-about-your-mobile-apps-startup-time/)
- TTID = first frame; TTFD = app usable (primary content loaded), signalled by `reportFullyDrawn`. "Both are
  equally important... If either of these is too long, the user might exit your app before it even fully loads."
  Optimise assuming a cold start. [primary] — [Android Developers, App startup time](https://developer.android.com/topic/performance/vitals/launch-time)
- Apple: first frame within 400 ms (WWDC19 423). [secondary of primary] — [WWDC19 423](https://developer.apple.com/videos/play/wwdc2019/423/)
- Android splash screens: "User research shows that perceived startup time is less when viewing an animation"
  (study not linked). Icon animation: "we recommend not exceeding 1,000 ms on phones"; delayed start ≤ 166 ms;
  if startup > 1,000 ms consider a looping animation. "App launch gives you the option to skip the sequence in
  cases where the app is ready earlier... make sure the motion can be comfortably skipped." The splash is
  dismissed when the app draws its first frame. The splash never shows on a hot start. Design guidelines
  recommend against a branding image. [primary] — [Android Developers, Splash screens](https://developer.android.com/develop/ui/views/launch/splash-screen)
- Splash screens should last only as long as needed, ideally under 2 s, with no artificial delays. [weak]
  — [UXPin](https://www.uxpin.com/studio/blog/splash-screen/)
- The "animation/skeleton reduces perceived wait by up to 15%" claim has no source. [weak/folklore]
  — [UXPin](https://www.uxpin.com/studio/blog/splash-screen/)
- No peer-reviewed study on branded launch animations and perceived launch time was found.

### Inferences
- The app's launch sequence: native splash (TTID) → `LaunchAnimation` ~0.7 s draw + 0.5 s rest + fade → first
  screen. Effective time-to-content on cold start ≈ TTID + ~1.2-1.4 s, regardless of whether data is ready.
  Google's "user research" supports an animation that *covers* real wait, not one that *adds* wait.
- Risk assessment: the 0.7 s draw alone is within Google's 1,000 ms guidance; the 0.5 s rest plus fade pushes
  the total past it and is pure added latency. Because "once per app run" equals every cold start (Android/iOS
  kill backgrounded apps often), returning users pay it repeatedly. Options to consider (owner decision): make it
  skippable on tap, end it as soon as the first screen is ready after the draw, drop or shorten the rest, or play
  it only on first launch / after an update.
- QA budget proposal: cold start TTID ≤ 2 s on a mid-range Android (well inside the 5 s excessive line), first
  frame ≤ 400 ms aspiration on iOS, and time-to-interactive first screen (TTFD) ≤ TTID + 1.5 s including the
  launch animation.

### Gaps
- The Android "user research" behind the animated-splash claim is unpublished.
- No data on how often returning users cold-start this kind of app (depends on OS memory pressure).
- Apple's current (2025-2026) launch guidance was not re-checked beyond WWDC19; a WWDC26 session exists on a
  related topic (camera deferred start) but was not read.

## 5. Jank and frame drops

### Takeaway
Android defines slow frames as > 16 ms (at 60 Hz) and frozen frames as > 700 ms, with ANR at > 5 s of no input
response; "no frames in your app should ever take longer than 700 ms". The link from jank to satisfaction is
asserted by platforms (stutter is perceived) but no quantitative satisfaction study was found.

### Cited Findings
- Slow frames 16-700 ms (visible as abrupt list scrolling, broken animations); frozen frames 700 ms-5 s (typically
  at startup and screen transitions; app "appears to be stuck and is unresponsive to user input for almost a full
  second"); ANR > 5 s without responding to input. "No frames in your app should ever take longer than 700 ms to
  render." First frame on startup / screen transition is expected to exceed 16 ms, which is why frozen frames are
  tracked separately. Fix order: ANRs first, then kill 700 ms frozen frames. [primary]
  — [Android Developers, Slow rendering](https://developer.android.com/topic/performance/vitals/render)
- Frame windows: 16 ms at 60 fps, 11 ms at 90 fps, 8 ms at 120 fps. [primary] — same source
- Third-party RUM tools (Datadog, Sentry) use the same 700 ms frozen-frame cutoff. [secondary]
  — [Datadog mobile vitals](https://docs.datadoghq.com/real_user_monitoring/android/mobile_vitals/);
  [Sentry mobile vitals](https://docs.sentry.io/product/performance/mobile-vitals)
- Android recommends automated instrumentation tests on the primary scrolling UI to catch slow render times.
  [primary] — [Android Developers, Slow rendering](https://developer.android.com/topic/performance/vitals/render)

### Inferences
- QA numbers: zero frozen frames (> 700 ms) in scripted flows (launch, plant list scroll, add-plant steps, photo
  viewer); slow-frame share on list scroll well under 50% at 60 Hz on a mid-range Android; JS FPS during the launch
  animation and skeleton shimmer ≥ ~55 on that device. Running animations on the native driver (already a rule)
  keeps them smooth even when the JS thread is busy.
- Play Console's exact "bad behaviour" percentages for slow/frozen sessions were not retrieved; use the frame
  definitions above as the hard limits.

### Gaps
- Exact Play Console bad-behaviour thresholds (share of sessions with slow/frozen frames) not retrieved.
- No study found quantifying satisfaction or retention loss per % janky frames.

## 6. What can be measured automatically, and with which tools

### Takeaway
Most of the app's perceived-performance rules can be checked automatically: Jest/RNTL (+ Reassure) for render
behaviour and timings in the component tree; Playwright on the web build for real-browser timings, layout shift
and Core Web Vitals; Flashlight (Android only) plus a Maestro flow for FPS/CPU on a device; Android vitals /
`adb` / Macrobenchmark-style TTID for startup; Xcode metrics for iOS launch. Field data (Play vitals, Xcode
Organizer) needs real users and cannot gate a PR.

### Cited Findings
- **Reassure** (Callstack): performance regression testing for React Native in CI or locally; measures render
  time with React.Profiler, reuses React Native Testing Library tests, and applies statistical analysis to flag
  significant changes in CI reports. [primary-adjacent] — [Callstack blog](https://www.callstack.com/blog/performance-regression-testing-react-native);
  [Reassure methodology](https://callstack.github.io/reassure/docs/methodology)
- **Flashlight**: "Lighthouse for mobile apps", produces a performance score; runs against a plugged-in Android
  device (`flashlight measure`, `flashlight test` for automated runs); measures are non-deterministic, so run
  several iterations and automate user behaviour. iOS is not mentioned. [primary] — [Flashlight docs](https://docs.flashlight.dev/);
  claim that `flashlight test` can fail CI on score drops is third-party only — [dev.co](https://dev.co/observability/open-source/flashlight)
- **Android TTID/TTFD**: TTID from Logcat `Displayed` line or `adb shell am start -S -W` (`TotalTime`); TTFD
  requires calling `reportFullyDrawn`; Perfetto shows the "Android App Startups" slice; FrameTimeline in Perfetto
  tracks slow/frozen frames; `FrameMetricsAggregator` for field frame metrics. [primary]
  — [Android Developers, App startup time](https://developer.android.com/topic/performance/vitals/launch-time);
  [Android Developers, Slow rendering](https://developer.android.com/topic/performance/vitals/render)
- **Web build**: INP good ≤ 200 ms at p75 (lab proxy needed since INP is a field metric). [primary]
  — [web.dev INP](https://web.dev/articles/inp). RAIL's 100 ms response / 10 ms frame budgets as lab targets.
  [primary] — [web.dev RAIL](https://web.dev/articles/rail)
- **Sentry / Datadog mobile vitals** report app start, slow and frozen frames in the field for RN apps. [secondary]
  — [Sentry mobile vitals](https://docs.sentry.io/product/performance/mobile-vitals);
  [Expo, app startup time](https://expo.dev/articles/app-performance-and-reliability/app-startup-time)

### Inferences — proposed automatable checks for this app
| Rule / threshold | Basis | How to check automatically |
|---|---|---|
| Layout renders before data (no blank screen, no full-screen `ActivityIndicator`) | NN/g; app rule | Jest/RNTL: first render with pending query shows screen chrome; lint/grep for `ActivityIndicator` outside busy buttons |
| Skeleton not shown for loads < 300 ms; shown after 300 ms | NN/g "no flash < 1 s"; design-system convention | Jest fake timers: advance 299 ms → no skeleton; 300 ms → skeleton + single "Loading" announcement |
| Skeleton, once shown, stays ≥ ~400 ms (proposed) | Learning Equality convention | Jest fake timers (only if rule adopted) |
| Content fade-in 150 ms, opacity only, native driver | Android "animate draw properties" | Jest: assert `Animated.timing` config `duration: 150`, `useNativeDriver: true` |
| Cached data shown on first frame, no skeleton | TanStack Query rule | Jest: seed query cache → first render shows values, no `Skeleton` |
| No layout shift when data arrives | NN/g skeleton purpose | Playwright on web build: Layout Instability API / CLS ≈ 0 for skeleton→content swap |
| Tap feedback ≤ 100 ms; navigation shows next layout ≤ ~200 ms | Nielsen 0.1 s; RAIL; INP | Playwright trace on web build: input → next paint; Event Timing API interaction duration ≤ 200 ms |
| Render-time regressions in key screens | Reassure | Reassure tests for Home, plant list, plant detail; fail on statistically significant regressions |
| Cold start TTID ≤ 2 s mid-range Android (excessive at ≥ 5 s) | Android vitals | `adb shell am start -S -W` repeated N times on CI device/emulator, median `TotalTime` |
| Time to first usable screen incl. launch animation ≤ TTID + 1.5 s | Android splash ≤ 1,000 ms guidance | Maestro flow timing to first-screen element, or Flashlight run |
| Zero frozen frames (> 700 ms) in scripted flows; low slow-frame share | Android vitals | Flashlight / Perfetto FrameTimeline over a Maestro flow (Android) |
| Reduce Motion: shimmer static, launch animation respects it | NN/g accessibility caveat; app rule | Jest with mocked `useReduceMotion` |
| iOS first frame ≤ 400 ms (aspirational) | WWDC19 423 | Xcode Instruments App Launch / XCTest `XCTApplicationLaunchMetric` (manual or Mac CI only) |

- Lab timings on emulators/CI are noisy; use medians over repeated runs and relative regression gates rather than
  absolute single-run limits.

### Gaps
- Did not verify Flashlight's iOS status, Maestro integration syntax, or CI fail-on-threshold flags in official
  docs.
- Lighthouse / LCP and CLS thresholds were not re-fetched this session (commonly LCP ≤ 2.5 s, CLS ≤ 0.1 —
  verify at web.dev before using as gates). Lighthouse targets page loads; for an Expo web SPA it mainly
  measures the initial bundle load.
- Did not verify XCTest `XCTApplicationLaunchMetric` details or Xcode Organizer launch thresholds.
- Did not check whether the app's `LoadingGroup` already enforces a minimum display time.
