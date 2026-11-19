# Measuring and predicting user satisfaction, and what a QA/CI pipeline can automate

Scope: map satisfaction frameworks to automated checks for an Expo / React Native app (iOS, Android, web build
under Playwright), Supabase backend, Jest unit tests, Node device simulator. Goal of the owner: a pipeline
estimate of "projected user satisfaction" = everything works and nothing feels slow.
Research date: 2026-11-19. Evidence quality is flagged inline: [primary] = paper / official docs fetched or
confirmed; [secondary] = vendor blog, aggregator or search-result summary only; [preprint] = not peer reviewed.

## 1. Which satisfaction instruments predict satisfaction best, and which behavioural proxies can a scripted test measure without real users?

### Takeaway
Attitude instruments (SUS, UMUX-Lite / UX-Lite, SEQ) need real people; scripts cannot produce them. What a script
*can* measure are the behavioural inputs those instruments correlate with: task completion, task time and
errors (the "Task success" leg of Google HEART). The link is real but only moderate (SEQ explains ~28-44% of
task-level variance; study-level SUS explains only 3-6% of observed completion/time/error variance), so a green
pipeline is a necessary, not sufficient, condition for satisfaction. NPS is the weakest choice as a predictor.

### Cited Findings
- **UMUX-Lite vs SUS:** in a MeasuringU study (n = 64, five-point versions) UMUX-Lite correlated with SUS at
  r = .87 (alpha .89) and with likelihood-to-recommend (the NPS item) at r = .81 [primary, MeasuringU] —
  [MeasuringU](https://measuringu.com/?p=28615). A secondary guide quotes r = .81 with SUS (Finstad 2013); the
  figure differs by study and version — [UI/UX Atlas](https://uiux-atlas.pages.dev/lessons/research/surveys-and-standardized-questionnaires).
- **UX-Lite (successor of UMUX-Lite):** 2023 MeasuringU study of ~60 products: alpha 0.89 (SUS) and 0.70
  (UX-Lite); correlations between SUS, UX-Lite, mTAM, overall experience, LTR and behavioural intention ranged
  0.468-0.800 (all p < .01) — [MeasuringU PDF](https://measuringu.com/wp-content/uploads/2023/10/2023_EffectOfPerceivedEaseOfUseAndUsefulnessOnUXAndBehavioralOutcomes.pdf);
  [MeasuringU article](https://measuringu.com/effect-of-perceived-ease-of-use-and-usefulness-on-ux-metrics/).
- MeasuringU does **not** recommend the regression adjustment for estimating SUS from UMUX-Lite (it
  underestimates SUS at high usability) — [MeasuringU](https://measuringu.com/?p=28615).
- **SEQ (Single Ease Question, 7-point post-task item):** across 250+ task experiences, SEQ predicted about 44%
  of completion-rate variation and 28% of task-time variation — [MeasuringU](https://measuringu.com/why-collect-task-and-study-metrics/).
  A companion post reports r = .66 with completion and ~29% of task-time variance — [MeasuringU](https://measuringu.com/?p=502).
  An earlier summary gives r ~ .5 and warns no single usability metric replaces another — [MeasuringU](https://measuringu.com/?p=140).
- Users who **fail a task yet rate it very easy** occur about 14% of the time — [MeasuringU](https://measuringu.com/?p=502).
- **Study-level vs task-level:** study-level metrics like SUS capture on average only 3-6% of the variability of
  observed completion rates, time and errors — [MeasuringU](https://measuringu.com/why-collect-task-and-study-metrics/).
  Evolution/wording of SEQ — [MeasuringU](https://measuringu.com/evolution-of-seq).
- **Google HEART:** Rodden, Hutchinson & Fu, CHI 2010 (pp. 2395-2398, DOI 10.1145/1753326.1753687): five
  categories Happiness, Engagement, Adoption, Retention, Task success, chosen per product via a
  Goals -> Signals -> Metrics process — [Google Research PDF](https://research.google.com/pubs/archive/36299.pdf);
  [Google Research page](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/).
  HEART is meant to complement PULSE (page views, uptime, latency, seven-day active users, earnings) rather than
  replace it [secondary] — [Rework summary](https://resources.rework.com/libraries/growth-frameworks/heart-framework).
- **NPS criticism:** Keiningham, Cooil, Andreassen & Aksoy (2007), *Journal of Marketing* 71:39-51, used 21
  firms and 15,500+ interviews (Norwegian Customer Satisfaction Barometer) and found NPS does not outperform the
  ACSI or other recommend/satisfaction measures at predicting firm revenue growth — [Koc University record](https://research.hub.ku.edu.tr/entities/publication/6c8605c0-154e-4020-bcd9-2e7e3e1f1550/full);
  [Ipsos summary](https://www.ipsos.com/en-us/node/137616). Note: the full text was not retrieved; figures are
  from abstracts/summaries. Advocacy pieces on both sides exist (e.g. strongly critical [marketingscience.info](https://marketingscience.info/net-promoter-score-nps-does-not-predict-growth-its-fake-science)).

### Inferences
- Best attitude instruments for a small app team: **UMUX-Lite/UX-Lite** (two items, cheap in-app, tracks SUS
  closely) at study/product level and **SEQ** after key tasks (add plant, pair device). NPS can stay as a
  marketing number but should not drive QA decisions.
- **Behavioural proxies a scripted test can measure without users** (HEART "Task success" + PULSE latency):
  1. Task completion (pass/fail of each E2E journey: sign in, add plant via photo, pair device with the sim,
     see moisture / water left / battery, receive a watering plan).
  2. Time-on-task for the scripted path (wall-clock per flow, per step) and step count / taps (a proxy for
     efficiency: more taps than the designed path = friction).
  3. Error rate: unhandled errors, red screens, failed network calls, error toasts shown, console errors.
  4. Responsiveness: time from tap to visible feedback, cold start, screen-to-content time, dropped frames.
  These are inputs to satisfaction, not satisfaction itself; HEART's Happiness/Retention need real users.
- Because SUS-level measures explain so little observed behaviour, a "projected satisfaction" score from CI should
  be presented as a **quality gate (pass/fail + budgets)**, not as a predicted SUS number. Any mapping of CI
  metrics to a predicted SUS/UX-Lite value would be invented unless calibrated against real survey data later.

### Gaps
- No published validated model was found that converts automated task metrics (time, errors, frame drops) into a
  predicted SUS/UMUX-Lite/SEQ score. Calibration would require collecting in-app UX-Lite/SEQ responses after
  launch and regressing them on telemetry.
- Did not retrieve full text of the HEART paper or Keiningham 2007; detailed claims beyond abstracts unverified.
- No SEQ-vs-UMUX-Lite or SEQ-vs-NPS correlation found.

## 2. Automated usability evaluation: heuristics, automated GUI analysis, LLM/vision evaluation and simulated users — how accurate vs humans?

### Takeaway
Multimodal LLMs (2025-2026 studies) agree well with experts on **visual** qualities (aesthetics, layout,
consistency) but miss most **interaction/efficiency** problems and systematically rate usability too
generously. They find some extra issues humans missed but overlap with experts is low (~21% in one study).
LLM "simulated users" (UXAgent) are useful for generating hypotheses, but no study found validates that their
behaviour matches real users. Use them as a non-blocking advisory reviewer, never as a gate.

### Cited Findings
- **GPT-4o vs human heuristic evaluators** (Guerino et al., arXiv 2506.16345, June 2025, CC BY, cs.HC)
  [preprint]: only **21.2%** of issues identified by human experts were also found by GPT-4o, while it reported
  27 new issues; it did better on "aesthetic and minimalist design" and "match between system and real world",
  and struggled with "flexibility", "user control" and "efficiency" heuristics — [arXiv](https://arxiv.org/pdf/2506.16345)
  (figures from search-result summary; PDF text could not be extracted in this session).
- **Multimodal LLMs vs expert ratings on 1,000 mobile screens (UICrit dataset)**, testing GPT-5, Claude 4 Sonnet,
  Gemini 2.5 Pro and Qwen-3 VL: on Aesthetics / Design Quality, three models reached near-perfect agreement
  (kappa >= 0.81) zero-shot; on Usability / Learnability / Efficiency they **overestimated** by median +1 to +3
  points (p < 0.001); few-shot prompting generally made agreement **worse**; authors conclude MLLMs are
  unreliable for interaction-dependent judgments from static screenshots — [Springer chapter](https://link.springer.com/chapter/10.1007/978-3-032-30549-7_12)
  (summary from search result; peer-reviewed conference chapter).
- **Synthetic heuristic evaluation** (arXiv 2507.02306) [preprint]: GPT-4 performed best of three LLM platforms;
  synthetic evaluation sometimes failed to recognise/understand some UI elements — [arXiv](https://arxiv.org/pdf/2507.02306).
- **Recommending usability improvements with MLLMs** (arXiv 2604.25420, 2026) [preprint]: a pipeline using screen
  recordings + Nielsen heuristics; a secondary summary says it uncovered 33% additional usability issues in a
  95-participant study, and that structured heuristic-guided feedback helped engineers without usability
  expertise — [arXiv](https://arxiv.org/html/2604.25420v1); [Emergent Mind summary, secondary](https://www.emergentmind.com/papers/2604.25420).
  The 33% figure is secondary; verify in the paper.
- **UXBench** (arXiv 2606.13192, 2026) [preprint]: 2,000-sample benchmark of mobile UX reasoning; mainstream MLLMs
  "remain fundamentally limited"; authors' model 0.7963 accuracy vs 0.6550 for Claude 4.5 Sonnet — [arXiv](https://arxiv.org/pdf/2606.13192).
- **UXAgent** (arXiv 2504.09407) [preprint]: LLM agents with generated personas run usability tests on a web
  design via a browser connector; evaluated by asking UX researchers (16 in one version, 5 in another) whether
  the traces were useful — it did **not** validate agent behaviour against real participants; mobile listed as
  future work — [arXiv](https://arxiv.org/html/2504.09407v3).

### Inferences
- Practical automated layers, from most to least trustworthy:
  1. Deterministic rule checks (accessibility rules, contrast, touch-target size, labels, font scaling not
     capped) — already partly enforced in this repo by lint (raw colours, `maxFontSizeMultiplier`).
  2. Scripted task success / timings (section 1 proxies).
  3. LLM-on-screenshot review for visual consistency against the design spec (where evidence shows good
     agreement) — advisory comment on PRs.
  4. LLM agent "first-time user" walkthroughs (goal-only prompts on the web build via Playwright) to flag where an
     agent gets lost — hypothesis generation only; known bias toward leniency and low recall of
     efficiency/control problems.
- Because LLMs overrate usability, a "the model says it's fine" result has little value; treat LLM output as a
  source of candidate issues for a human to triage.

### Gaps
- Classic (pre-LLM) automated GUI usability analysis literature (e.g. rule-based mobile GUI linters, Android
  Accessibility Scanner studies) was not researched in this session.
- No study found on LLM agents driving *native mobile* apps for usability (as opposed to web) with accuracy vs
  real users.
- Nielsen's 10 heuristics themselves not re-sourced here (well known; cite nngroup.com directly if needed).

## 3. Tooling for React Native / Expo in CI, and costs/limits of simulators/emulators on GitHub Actions

### Takeaway
A workable stack: Jest + **Reassure** for render-time regressions (cheap, runs on Linux), **Maestro** flows for E2E
task success (on EAS Workflows or GitHub Actions emulators), **Flashlight** wrapping Maestro for an Android perf
score, **Playwright + Lighthouse CI (+ axe)** on the web build. iOS simulators need macOS runners (~10x Linux
price); Android emulators run on Linux x64 runners with KVM enabled (not on arm64 runners).

### Cited Findings
- **Reassure** (Callstack): measures React component render time with `React.Profiler`, compares current branch
  vs baseline (base branch) **on the same machine, one after another**; default 10 runs per test (first is
  effectively warm-up); splits results into significant / non-significant changes; `reassure check-stability`
  runs the same code twice — under 5% random change is normal, 10%+ means the machine needs tuning; raising runs
  to 20/50/100 smooths noise at the cost of time; don't use the CI agent for other work during perf tests —
  [Reassure methodology](https://oss.callstack.com/reassure/docs/methodology). Requires React Native Testing
  Library for `measureRenders()`; `measureFunction()` for plain JS; designed to run with Danger to post PR
  comments — [npm](https://www.npmjs.com/package/reassure); [Callstack blog](https://www.callstack.com/blog/performance-regression-testing-react-native).
  No published measured CI flakiness figures were found.
- **Flashlight** (BAM): Lighthouse-style performance score for Android apps (iOS "in progress"), aggregates
  metrics (FPS, CPU incl. per-thread, RAM), no app changes needed, works on production builds;
  `flashlight test --bundleId <id> --testCommand "maestro test flow.yml"` repeats a scenario (default 10
  iterations, 3 retries) and averages; `flashlight cloud` runs on real devices —
  [GitHub](https://WWW.GITHUB.COM/bamlab/flashlight); [docs](https://docs.flashlight.dev/test/api).
  Limitations: memory is RSS only, not PSS — [WaveMaker docs](https://docs.wavemaker.com/learn/react-native/flashlight-performance-tool);
  scores are not deterministic between runs — [Theodo](https://www.theodo.com/blog/measuring-react-native-performance-with-flashlight).
  Claim that it can fail builds on score drop only seen on a secondary site; unverified.
- **Maestro on EAS Workflows** (Expo official): an `e2e-test` build profile produces an unsigned APK (Android) and a
  simulator build (iOS); a workflow in `.eas/workflows/` builds per platform in parallel, then a `maestro` job
  runs flows on Android Emulator / iOS Simulator; can trigger on pull requests or by label —
  [Expo docs](https://docs.expo.dev/eas/workflows/examples/e2e-tests.md); [reference](https://docs.expo.dev/eas/workflows/reference/e2e-tests/);
  [tutorial](https://docs.expo.dev/tutorial/cicd/e2e-tests/). EAS pricing for these jobs was not found in the
  docs pages fetched. Third-party Maestro clouds: DeviceCloud ($25 base subscription, $20 free credit) [vendor] —
  [devicecloud.dev](https://devicecloud.dev); Maestro Cloud enterprise is custom-priced [vendor] —
  [TestingBot comparison](https://testingbot.com/maestro-cloud-alternative).
- **GitHub Actions runner prices (2026, secondary sources, not verified on GitHub's page):** Linux 2-core x64
  $0.006/min, arm64 2-core $0.005/min — [craci.com](https://craci.com/compare/github-actions-runner-providers);
  macOS standard 3/4-core $0.062/min, 12-core Intel $0.077/min, 5-core M2 Pro $0.102/min —
  [Macswarm](https://macswarm.com/blog/github-actions-macos-runner-cost-2026/);
  [macyou](https://macyou.co/blog/ios-cicd-github-actions-mac); 8-core Linux $0.022/min —
  [gitera](https://gitera.io/tools/github-actions-cost-calculator). A planned $0.002/min self-hosted platform fee
  was reported as postponed — [StackTrack](https://stacktrack.com/posts/understanding-github-actions-runner-costs-in-2026/).
- **Android emulator on GitHub-hosted runners:** use `reactivecircus/android-emulator-runner`; hosted Ubuntu
  runners need a udev rule step to give access to `/dev/kvm`; HAXM no longer needed — [README](https://github.com/ReactiveCircus/android-emulator-runner).
  `ubuntu-24.04-arm` runners have **no** `/dev/kvm`, so the cheaper arm runners cannot host accelerated emulators
  [secondary] — [ProAndroidDev](https://proandroiddev.com/how-to-run-an-android-emulator-on-github-actions-0fafb96e568a).
- **Lighthouse (web build) variability:** biggest sources are page nondeterminism, local network, client hardware
  and resource contention; the median of 5 runs is "twice as stable" as 1 run (`lhci collect -n 5`); use >= 2
  dedicated cores (4 recommended), 2 GB RAM (4-8 GB recommended), never run Lighthouse reports concurrently on
  one machine, avoid burstable/shared-core instances; simulated throttling mitigates more variance than DevTools
  throttling — [Lighthouse variability doc](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md).

### Inferences
- Cost shape for this project: Jest + Reassure + Playwright + Lighthouse CI + `sim:test` all run on cheap Linux
  minutes. Android Maestro/Flashlight fits on Linux x64 with KVM (several minutes per run including emulator
  boot). iOS Maestro is the expensive one (~10x per minute on macOS); run it nightly or on labelled PRs rather
  than every push.
- The device simulator (`sim/`) lets E2E flows include "device paired / reading arrives / plan executes"
  journeys without hardware — a task-success check unique to this product.
- Detox is an alternative to Maestro but needs native build integration (gray-box); Maestro is the path Expo
  documents for EAS Workflows (see Gaps).

### Gaps
- Detox current status/version, Expo compatibility and CI cost: not researched in this session.
- axe-core coverage figures (share of WCAG issues detectable automatically) and `@axe-core/playwright` usage: not
  fetched; check deque.com docs.
- Playwright performance APIs / tracing for web timing metrics: not fetched.
- EAS Workflows per-job pricing and whether its iOS simulator jobs are cheaper than GitHub macOS minutes: not found.
- GitHub's own pricing page was not fetched; runner prices above are from secondary 2026 sources that agree
  with each other.
- Maestro / Flashlight / Reassure version numbers as of late 2026 not checked.

## 4. Performance budgets and regression gates: how teams set and enforce them; flakiness and stabilisation

### Takeaway
Gates work when they compare **relative** change against a baseline measured on the same machine in the same job
(Reassure's model) or use the **median of several runs** with dedicated hardware (Lighthouse's model). Absolute
budgets suit stable, user-facing thresholds (web vitals, store vitals); relative gates suit render counts and
timings. Check noise first, then set the gate above it.

### Cited Findings
- Reassure: baseline and current on the same machine back-to-back; noise < 5% acceptable, >= 10% too high;
  increase run count to stabilise; dedicate the agent during perf tests — [Reassure methodology](https://oss.callstack.com/reassure/docs/methodology).
- Lighthouse: median of 5 runs, dedicated >= 2-core machines, no concurrency, simulated throttling, localhost or
  same-network targets, no extensions/antivirus — [Lighthouse variability](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md).
- Flashlight averages 10 iterations by default with 3 retries; results still vary run to run —
  [docs](https://docs.flashlight.dev/test/api); [Theodo](https://www.theodo.com/blog/measuring-react-native-performance-with-flashlight).
- Absolute external thresholds teams can align budgets to: Android vitals bad-behaviour thresholds —
  user-perceived crash rate 1.09% and ANR rate 0.47% overall, 8% per phone model; exceeding them may reduce Play
  visibility and show a store-listing warning — [Android vitals](https://developer.android.com/games/optimize/vitals);
  [Google Play support](https://support.google.com/googleplay/android-developer/answer/9844486);
  [Android Developers blog 2022](https://android-developers.googleblog.com/2022/10/raising-bar-on-technical-quality-on-google-play.html?hl=id).

### Inferences
- Suggested gate design for this app:
  - **Blocking:** E2E task success (Maestro/Playwright flows pass), no unhandled JS errors in flows, Reassure
    "significant" regressions on key screens (Home, plant detail, add flow) beyond a % set after
    `check-stability`, Lighthouse CI assertions on the web build (median of 5) for performance and accessibility
    categories, axe violations = 0 for serious/critical.
  - **Non-blocking / trend only:** Flashlight score, emulator wall-clock timings, LLM UI review comments.
- Emulator timings on shared CI runners are noisier than Jest-in-Node timings; keep them as trends rather than
  hard gates unless measured on dedicated/real devices.

### Gaps
- No primary source found with measured flakiness rates for mobile performance tests in CI.
- Web Vitals "good" thresholds (LCP / INP / CLS) and RAIL response budgets not re-verified in this session
  (background knowledge: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 at p75 — verify at web.dev before using).
- No source found on how mobile teams set absolute app-start / screen-load budgets (beyond vitals thresholds).

## 5. Real-user signals after launch and closing the loop with pre-release checks

### Takeaway
After launch, satisfaction becomes directly measurable: crash-free / ANR rates (Play vitals thresholds are
public), store ratings, in-app review prompts (rate-limited by both stores, must not be gated by a "do you like
the app?" question on Android), and in-app UX-Lite/SEQ surveys. Closing the loop means feeding field regressions
back into new CI flows and recalibrating budgets.

### Cited Findings
- Android vitals definitions: user-perceived crash rate = % of daily active users who experienced at least one
  noticeable crash; thresholds 1.09% crash / 0.47% ANR overall, 8% per phone model; consequences include reduced
  visibility and store warnings — [Android vitals](https://developer.android.com/games/optimize/vitals);
  [developer.android.com/vitals](https://developer.android.com/vitals).
- **Play In-App Review API:** trigger after the user has experienced enough of the app; don't prompt excessively;
  must not ask any question before/while showing the card (no "Do you like the app?", no "Would you rate 5
  stars"); don't modify or overlay the card; time-bound quota (calling more than once in e.g. less than a month
  may show nothing; exact quota undisclosed and may change); don't attach the API to a button — link to the Play
  Store instead — [Android Developers](https://developer.android.com/guide/playcore/in-app-review).
- **iOS (StoreKit):** the request is shown at most 3 times in 365 days for a user who hasn't rated on that device;
  for users who already reviewed, only if the version is new and > 365 days since their last review; may not show
  an alert, so don't call it from a button — [Apple requestReview(in:)](https://developer.apple.com/documentation/storekit/skstorereviewcontroller/requestreview(in:).md);
  [Apple forum thread quoting docs](https://developer.apple.com/forums/thread/81703);
  [Apple ratings & reviews](https://developer.apple.com/app-store/ratings-and-reviews/). One forum thread reports the
  limit misbehaving — [Apple forum](https://developer.apple.com/forums/thread/827331).
- HEART's Happiness / Engagement / Adoption / Retention categories are by design measured on real usage at scale
  (logs + surveys) — [Rodden et al. 2010](https://research.google.com/pubs/archive/36299.pdf).

### Inferences
- Loop for this app: (1) pre-release CI gates (sections 3-4); (2) field telemetry (crash/ANR, screen load times,
  API error rates, device sync failures); (3) short in-app UX-Lite after ~1-2 weeks of use and SEQ after
  add-plant / pair-device; (4) store review prompt only after a success moment (e.g. first successful automatic
  watering), never after an error, never behind a sentiment question on Android; (5) every field regression gets a
  new Maestro/Playwright flow or Reassure test; (6) after enough survey data, regress UX-Lite on telemetry to
  learn which CI-measurable metrics actually move satisfaction for this product.
- Privacy note for this project: session replay and RUM SDKs add third-party data flows and new dependencies;
  CLAUDE.md requires asking before adding dependencies and keeping secrets out of the app.

### Gaps
- Sentry, Firebase Performance Monitoring, Expo's own insights, and session-replay tools (features, RN/Expo SDK
  support, pricing, privacy) were not researched in this session.
- No primary data found on the best timing of in-app rating prompts (beyond store guidelines) or on the
  correlation between crash-free rate and star ratings.
- App Store Connect / Xcode Organizer equivalents to Android vitals thresholds were not researched.
