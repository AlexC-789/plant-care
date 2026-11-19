# Onboarding friction, cognitive load and emotional design as drivers of mobile app satisfaction

Research notes, 2026-11-19. Scope: evidence for the planned first run ("Model A": Welcome -> photo -> identification -> Name and place -> "Keep {name}" account sheet -> optional health check -> module offer -> connect module -> fill tank -> notifications permission -> Plants home) and for everyday use. Evidence strength is flagged on each item: **[primary]** = peer-reviewed paper or platform-owner documentation; **[practitioner]** = named company insider / research firm (no published method); **[vendor]** = company selling the tool in question (treat as marketing); **[unverified]** = known citation not fetched in this session, check before quoting.

## 1. Delayed registration ("value before sign-up"): effect on activation and retention, and risks

### Takeaway
The best public data point is Duolingo: moving sign-up after a first lesson gave "about a 20% increase in DAUs", and later soft-wall/hard-wall tuning another 8.2%. It is a practitioner report with no published sample sizes, and no rigorous published A/B data on retention after a deferred account wall was found. The risks that are documented are wording and wall design: a "discard my progress" framing did worse than a quiet "Later", and hard walls did worse without soft walls first.

### Cited Findings
- Duolingo let users try a lesson before signing up. Gina Gotthilf (VP Growth): "Simply moving the sign-up screen back a few steps led to about a 20% increase in DAUs." She says this test was "before my time", so it is second-hand inside the company. **[practitioner]** — [First Round Review: The Tenets of A/B Testing from Duolingo's Master Growth Hacker](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker)
- Follow-ups: a large red "Discard my progress" button on the sign-up screen was replaced by a subtle "Later" button, which improved results. Duolingo then used three skippable "soft walls" and a "hard wall" after several lessons. "Without those soft walls priming a sign-up as they're ignored, those hard walls perform significantly worse." Combined, the wall tuning gave an 8.2% DAU increase, measured about three years after the original test on a much larger user base. **[practitioner]** — [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker)
- The article gives no sample sizes, test durations or significance levels. **[practitioner]** — [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker)
- A widely repeated "sign-up rate 10% -> 12%" figure for this test could not be traced to a primary Duolingo source. Pages at datainterview.com and dataford.io that "analyse" Duolingo's delayed sign-up use simulated or hypothetical data and are not evidence. — [Taplytics blog (secondary)](https://taplytics.com/blog/duolingo-ab-test-onboarding); [datainterview.com (simulated)](https://www.datainterview.com/ab-testing-lab/delayed-signup)
- The claim that delayed sign-up is "likely the best way to ensure retention" is a blogger's inference, not Duolingo data. — [Medium, Product Breakdown](https://medium.com/product-breakdown/product-breakdown-3-learnings-from-the-duolingo-app-7cb4a2e15cb3)
- Form-length evidence that applies to the account sheet: Baymard (2024) finds most checkouts need only 8 form fields, yet the average was 11.3 (12.7 in 2019). 17% of US online shoppers say they abandoned an order in the past quarter because of a "too long / complicated checkout". Baymard also finds that total field count matters more than step count. **[practitioner, large-sample usability research]** — [Baymard checkout usability benchmark](https://baymard.com/research-articles/ecommerce-checkout-usability-report-and-benchmark); [Baymard: reduce cart abandonment](https://baymard.com/learn/reduce-cart-abandonment); [Baymard: from 16 fields to 8](https://baymard.com/blog/checkout-optimization-from-16-fields-to-8)

### Inferences
- Model A's order (scan and identify first, account after "Name and place") matches the Duolingo pattern. The sheet should feel like keeping something already made ("Keep {name}"), not like a gate. The Duolingo button result suggests the decline option should be a neutral "Later"/"Not now", not a loss-framed "Discard".
- The main risk is guest data loss: a plant made before sign-up must survive app close, sign-up and sign-in on the same device (local draft or anonymous session, then linked). If it is lost at the wall, the value-first benefit turns into a negative peak (see section 4).
- One field (email) plus Apple/Google keeps the sheet well under Baymard's 8-field "needed" count. Email confirmation is ON in this project (sign-up -> confirm -> sign-in). That adds a context switch to the mail app right after the user has invested effort, which makes it the likeliest abandonment point in Model A. It should be measured, not assumed away.
- Duolingo's hard wall only worked after soft walls had primed it. Model A has a single wall. If "Keep {name}" can be skipped, a second soft ask (e.g. at module pairing, which needs a server account anyway) mirrors the soft-then-hard pattern.

### Gaps
- No peer-reviewed or published A/B data found on delayed registration's effect on D7/D30 retention (as opposed to DAU or sign-up rate). Airbnb, Appcues and Reforge case data on this were not found in the time available. Appcues/Reforge material would be vendor/practitioner in any case.
- No published data found on guest-data-loss rates or account-wall abandonment for mobile apps specifically.
- Apple's HIG Onboarding page (https://developer.apple.com/design/human-interface-guidelines/onboarding) did not render through the fetch tool (JavaScript page). Its guidance on deferring sign-in is commonly summarised as "let people experience the app before requiring an account", but this wording is **[unverified]**: check the live page before quoting it.

## 2. Permission priming and timing (notifications, camera)

### Takeaway
The best controlled study (473 participants, 30 mock apps) finds that asking in context raises grant rates whether or not a rationale is shown. Rationales also raise grant rates, and their effect is strongest when the request comes upfront, i.e. "explanation beats context". Platform guidance from Google and Material, and NN/g, says: ask when the user invokes the feature, explain the value first, and never imitate the system dialog. Opt-in percentages from push vendors are marketing-grade and conflict with each other.

### Cited Findings
- Elbitar et al., USENIX Security 2021, "Explanation Beats Context: The Effect of Timing & Rationales on Users' Runtime Permission Decisions": 473 MTurk participants, 120 variants of 30 interactive mock-up apps, about 1,800 permission decisions. 2x2 within-subjects design: upfront vs in context, with vs without rationale. Results: "rationales increase grant rates and have a positive effect on users' perception of their decisions… this effect is stronger when rationales are added upfront rather than in context"; "requesting permissions in context always has a positive effect on grant rates, regardless of the presence of rationales"; in context also improves how users rate their decision when no rationale is shown. Decisions vary by person: "there is no one-size-fits-all permission request strategy". **[primary]** — [Elbitar et al., USENIX Security 2021 (PDF)](https://group.cispa.io/bugiel/publication/elbitar-usenix-21/elbitar-usenix-21.pdf)
- The same paper's crawl of 7,998 top Google Play apps found 2,569 runtime permission requests. 70% were shown upfront and only 16% had a rationale. Camera requests were in context 32% of the time. **[primary]** — [Elbitar et al. 2021](https://group.cispa.io/bugiel/publication/elbitar-usenix-21/elbitar-usenix-21.pdf)
- NN/g, citing Tan et al. (15 apps): users were "12% more likely to grant a permission request" when given a reason, even a fairly poor one. In a party-planning app built for the study, the most compelling reason produced an "81% lift" in grants over the least compelling. NN/g's advice: ask for noncritical permissions after delivering value; avoid bulk requests at install ("request fatigue"); after a denial, explain what is missing and deep-link to the exact setting; avoid dark patterns (e.g. disguised dialogs, "Recommended" labels, no decline option). **[primary-derived / practitioner]** — [NN/g: Permission Requests](https://www.nngroup.com/articles/permission-requests/)
- Android: apps installed on Android 13+ start with notifications off and must request `POST_NOTIFICATIONS`. Google suggests asking in context, explaining what the notifications are for, and tying the request to a user action. It also suggests the option of waiting until users are familiar with the app. **[primary]** — [Android: Notification runtime permission](https://developer.android.com/develop/ui/views/notifications/notification-permission)
- Android runtime-permission guide: if a rationale is needed, show it in your UI before the system prompt, and "clearly explain what data your app is trying to access and what benefits the app can provide". Android vitals: unusually high denial rates suggest users don't think the benefit is worth the exposure. **[primary]** — [Android: Request runtime permissions](https://developer.android.com/training/permissions/requesting); [Android vitals: Permission denials](https://developer.android.com/topic/performance/vitals/permissions)
- Material (v1) permissions pattern: wait until the user invokes a feature before asking for its non-critical permissions. **[primary, older guideline]** — [Material Design: Permissions pattern](https://m1.material.io/patterns/permissions.html)
- Baseline opt-in rates (Airship data relayed by a marketing agency): Android median push opt-in fell from 71.3% (2023) to 59.5% (2024) and 53.3% (2025); iOS stayed around 49%. Plotline reports 67.5% overall and 54% on iOS. The sources conflict. **[vendor]** — [admiral.media (citing Airship)](https://admiral.media/push-notification-strategy-mobile-apps/); [Plotline](https://www.plotline.so/blog/how-to-improve-push-notification-opt-in-rates)
- Claims that pre-permission priming gives "2-3x higher opt-in", or 70–85% contextual opt-in, appear in vendor content without data. **[vendor, unverified]** — [ContextSDK](https://contextsdk.com/solutions/use-cases/push-notification-opt-in-rate); [OneSignal docs](https://documentation.onesignal.com/docs/en/prompt-for-push-permissions.md)

### Inferences
- Camera: Model A asks for it at "photo capture" right after the user taps "Scan a plant". That is in context and user-initiated, the strongest case in Elbitar et al. A one-line purpose (iOS usage string, Android rationale) adds the rationale effect.
- Notifications: asking only after module setup is in context. The value ("we'll tell you when the tank is low") becomes concrete right after "fill the tank". A short custom pre-screen explaining that value, followed by the system dialog, fits both Android guidance and the rationale evidence. It must not copy the system dialog's look, and "Not now" must not trigger the system prompt, so the one-shot iOS prompt is kept for later.
- Users who skip the module offer should not get the notification ask in the first run; there is nothing to notify about yet. Ask later, when a watering or tank event first happens.
- Measure the custom pre-screen accept rate and the OS grant rate separately. Vendor sources and Android vitals both treat denial rate as the health signal.

### Gaps
- No primary field (non-mock) A/B data found comparing launch-time vs in-context notification prompts with real opt-in rates. The Elbitar study uses mock apps and MTurk.
- Apple HIG "Privacy" / "Requesting permission" (https://developer.apple.com/design/human-interface-guidelines/privacy) did not render through the fetch tool. Its commonly cited rules (request at the moment of need, never show a custom screen whose button looks like it grants access, iOS shows the notification prompt only once) are **[unverified]** here and should be checked on the live page.

## 3. Number of steps, progress indicators, goal-gradient, Hick's law / choice overload, cognitive load in mobile forms

### Takeaway
Progress bars do not reliably reduce drop-off. A meta-analysis of 32 randomized experiments found they can increase it, especially when early progress looks slow. Total field and decision count matters more than step count. Choice overload is near zero on average and only appears under specific moderators: complex sets, hard tasks, unclear preferences. That favours few, simple choices with defaults over fewer screens.

### Cited Findings
- Villar, Callegaro & Yang (2013), "Where Am I? A Meta-Analysis of Experiments on the Effects of Progress Indicators for Web Surveys", Social Science Computer Review 31(6): 32 randomized experiments. The findings "question the common belief that progress indicators help reduce drop-off rates". Constant-speed indicators increased drop-off when a small incentive was promised. Slow-to-fast indicators (early progress looks slow) increased drop-off, while fast-to-slow ones decreased it. **[primary, web surveys not apps]** — [Villar et al. (Durham repository)](https://durham-repository.worktribe.com/OutputFile/2163855); [Irrational Labs summary](https://irrationallabs.com/blog/knowledge-cuts-both-ways-when-progress-bars-backfire/)
- A 2025 lab study found that attention to goal-progress information "increased steeply near a goal state", which supports the goal-gradient mechanism. **[primary]** — [Devine et al. 2025 (PDF)](https://otto.lab.mcgill.ca/papers/devine_et_al_2025.pdf)
- Baymard: "the number of steps matters less than the total number of fields". A one-page checkout with 30 fields is often worse than a three-step checkout with well-designed forms. **[practitioner]** — [Baymard checkout benchmark](https://baymard.com/research-articles/ecommerce-checkout-usability-report-and-benchmark)
- Choice overload: Scheibehenne, Greifeneder & Todd (2010) meta-analysis, 63 conditions from 50 experiments, N = 5,036: "a mean effect size of virtually zero but considerable variance between studies". In their 2011 reply, sensitivity subsets gave D = 0.04 and 0.07. **[primary]** — [Scheibehenne et al. 2010 (PDF)](https://abcwest.cogs.indiana.edu/pmwiki/pdf/scheibehenne.options.2010.pdf); [Scheibehenne et al. 2011 reply (PDF)](https://abcwest.cogs.indiana.edu/pmwiki/pdf/scheibehenne.reply.2011.pdf)
- Chernev, Böckenholt & Goodman (2015), 99 observations, N = 7,202: once four moderators are taken into account (choice-set complexity, decision-task difficulty, preference uncertainty, decision goal), the effect of assortment size on choice overload is significant. **[primary]** — [Chernev et al. 2015 record](https://vufind-test.katalog.k.utb.cz/SummonRecord/FETCH-LOGICAL-c5373-70ae2e6347848385bf9476552c3afd7fa54acd274975d20e58ce012ae97619d43)
- Goal-gradient in consumer behaviour: Kivetz, Urminsky & Zheng (2006, Journal of Marketing Research 43(1)), coffee-card and web-rating field studies; people speed up as they near a reward. Endowed progress: Nunes & Drèze (2006, Journal of Consumer Research), a 10-stamp card with 2 pre-filled stamps was completed more often than an equivalent 8-stamp card. **[primary, unverified this session]** — [Kivetz et al. 2006, DOI](https://doi.org/10.1509/jmkr.43.1.39); [Nunes & Drèze 2006, DOI](https://doi.org/10.1086/500480)

### Inferences
- The existing `StepProgress` indicator (4 steps in today's add flow) is not by itself evidence-backed for completion. If kept, the early steps should look like fast progress: count a completed photo as visible progress, endowed-progress style. Avoid a denominator that suddenly grows (a 4-step bar that turns into 10 screens). Model A has about 10 screens. Showing the plant part ("Add plant 1–3") and the module part ("Set up module 1–3") as separate short sequences avoids a long, slow bar.
- The Welcome screen with exactly two options, "Name and place" with a few room chips, and three light levels are low-complexity choice sets with clear preferences. Choice overload is unlikely there. The risk is preference uncertainty: users may not know their light level. A default plus a one-line hint ("Bright = near a window") targets the Chernev moderator.
- Sweller's cognitive load theory (extraneous load) translates into concrete checks: one decision per screen, defaults pre-filled from identification (species name as default name), no free-text fields where chips work, and no information the user must remember across screens.

### Gaps
- Sweller (1988) and Hick (1952)/Hyman (1953) were not fetched this session. Their original findings concern learning tasks and reaction time, not mobile forms. I found no primary study applying either quantitatively to mobile onboarding, so their use here is analogy.
- No app-onboarding (as opposed to web-survey) randomized evidence on progress indicators was found.
- The pooled effect size for Chernev et al. 2015 was not retrieved.

## 4. Peak-end rule and memorable moments in software / UX

### Takeaway
Peak-end is strong in the pain and hedonic literature but **equivocal in interactive software**. The direct HCI tests (Cockburn, Quinn & Gutwin) found the predicted preference in only one of three form-filling conditions. Their follow-up found that recency (the end) significantly influences preferences, while primacy does not. A good ending ("The tank is full") is a reasonable bet. A broken middle is not rescued by it.

### Cited Findings
- Kahneman et al. (1993), the cold-water experiment: people preferred the longer trial that ended less painfully, the origin of peak-end. **[primary, unverified this session]** — [Kahneman et al. 1993, Psychological Science, DOI](https://doi.org/10.1111/j.1467-9280.1993.tb00589.x); background summary at [Coglode](https://www.coglode.com/research/peak-end-rule)
- CHI 2004 late-breaking paper (21 participants): summary ratings of perceived usability seemed to track the most recent part of the session rather than the whole episode. The authors suggest measuring usability repeatedly during a session. **[primary, small sample]** — [RWTH Aachen CHI 2004 PDF](https://hci.rwth-aachen.de/materials/conferences/CHI2004/2p1283.pdf)
- Cockburn, Quinn & Gutwin, "Examining the Peak-End Effects of Subjective Experience", CHI 2015, DOI 10.1145/2702123.2702139. Their later IJHCS paper says direct tests of peak-end in interactive settings "have produced equivocal results, with hypothesised preferences observed in only one of three conditions involving form-filling interfaces". **[primary]** — [researchr: CHI 2015 entry](https://researchr.org/publication/CockburnQG15); [Cockburn et al. 2017, accepted version (IJHCS)](https://ir.canterbury.ac.nz/bitstream/10092/14654/2/accepted-version.pdf)
- Cockburn et al. 2017, "The effects of interaction sequencing on user experience and preference" (IJHCS 108, DOI 10.1016/j.ijhcs.2017.07.005): recency effects significantly influenced preferences; primacy effects were not shown to. **[primary]** — [Accepted version](https://ir.canterbury.ac.nz/bitstream/10092/14654/2/accepted-version.pdf)
- Gutwin et al., CHI 2016, casual games: recollection of challenge was strongly influenced by peak-end effects, but results for fun, enjoyment and wanting to play again were mixed. **[primary]** — [researchr: Peak-End Effects on Player Experience in Casual Games](https://researchr.org/publication/GutwinRCML16/related)
- The rule "does not mean only two moments matter"; baseline friction still adds up. **[practitioner opinion]** — [Think Insights](https://thinkinsights.net/strategy/peak-end-rule)

### Inferences
- In Model A the natural high points are the first successful identification (an early positive peak) and "The tank is full" (end of setup). The recency evidence supports making the last setup screen clearly successful and calm. The final screen the user reaches is "Plants home" with their plant on it, so that should not open on a skeleton or an empty state.
- Negative peaks matter as much: a low-confidence identification with no clear way forward, a pairing-code failure, or losing the plant at the account wall. Each needs a recovery path that keeps the user's work.
- Because the software evidence is equivocal, peak-end should guide tie-breakers (where to spend polish), not replace removing friction.

### Gaps
- The CHI 2015 paper's full method and effect sizes were not retrieved (behind ACM DL). No evidence found linking a single "success moment" in an onboarding flow to retention.

## 5. Delight vs reliability: Kano, aesthetic-usability effect, where delight backfires

### Takeaway
Attractive design correlates strongly with users' *expected* ease of use (r ≈ 0.59 in Kurosu & Kashimura, replicated by Tractinsky). The causal "beautiful is usable" direction is weaker: Tractinsky et al. 2000 mainly showed that unusable systems are rated less beautiful. Kano research shows that delighters decay into expected features over time. Motion should stay short (about 100–500 ms, shorter the more often it is seen).

### Cited Findings
- Kurosu & Kashimura (CHI 1995): 26 ATM layouts rated by 252 subjects; aesthetics vs apparent usability r = 0.59. Tractinsky (CHI 1997) replicated this in Israel and found "very high correlations" between perceived aesthetics and a priori perceived ease of use. **[primary]** — [Tractinsky, CHI 97 paper](https://chi1997.acm.org/proceedings/paper/nt.html)
- Tractinsky, Katz & Ikar (2000), "What is beautiful is usable", Interacting with Computers 13(2): manipulating usability showed that less usable systems were rated less beautiful. This supports "usable is beautiful" but not the reverse. Critiques: early studies rated products participants had not used; correlation does not establish that aesthetics causes perceived usability. **[primary + critique]** — [Tractinsky et al. 2000 (PDF, Aalto course copy)](https://mycourses.aalto.fi/pluginfile.php/1645430/mod_folder/content/0/Tractinsky%20%282000%29.pdf); [Monk & Lelos, HOIT 2007](https://www-users.york.ac.uk/~am1/HOIT07MonkLelos.pdf); [UXPA Journal: boundary conditions of aesthetics on perceived usability](https://uxpajournal.org/?p=4392)
- Kano life cycle: attributes move from indifferent to attractive to one-dimensional to must-be. Nilsson-Witell & Fundin (2005) found an online ticketing service already seen as one-dimensional or must-be by its first users. Löfgren, Witell & Gustafsson (2011) found attributes moving over time, and in different directions. **[primary via review]** — [Tontini, POMS paper](https://pomsmeetings.org/ConfProceedings/043/FullPapers/FullPaper_files/043-0560.pdf); [Kano, Life Cycle and Creation of Attractive Quality](https://paperingest.jspadams.duckdns.org/download/Kano%20-%20Life%20Cycle%20and%20Creation%20of%20Attractive%20Quality.pdf)
- NN/g: most UI animations should be about 100–500 ms; about 100 ms for simple feedback, 200–300 ms for larger screen changes. Animations run too long far more often than too short, and the more often an animation is seen, the subtler and shorter it should be. **[practitioner, research-based]** — [NN/g: Animation duration](https://nngroup.com/articles/animation-duration)
- For components seen many times a day, initial delight fades and animation slows users down; "frequently seen animations may benefit most from having no animation at all". **[practitioner opinion]** — [read.jamesst.one](https://read.jamesst.one/1757563989.pdf); [Lordicon blog](https://lordicon.com/blog/from-delight-to-annoyance-when-too-much-animation-hurts-ux)

### Inferences
- For a device that waters plants, reliability (correct moisture and "water left", no false alarms, pump safety) is a must-be Kano attribute. Its absence causes dissatisfaction that no polish can offset. Polish supports first impressions and expected usability, and is a good bet for the first run and the Welcome screen.
- The launch animation (~0.7 s draw + 0.5 s rest, once per run) is above NN/g's 500 ms range but is a once-per-run brand moment, not repeated UI motion. The risk is repeat users on cold starts. Watch that it never delays the first usable frame, and that Reduce Motion shortens or skips it.
- Everyday screens (Plants home, plant detail) are high-frequency. Motion there should be ≤ 150–300 ms or absent. The project's 150 ms `FadeIn` fits.

### Gaps
- No primary study found that measures novelty decay of UI animation or delight in mobile apps over weeks. The evidence is practitioner opinion plus the Kano life-cycle literature on product attributes.

## 6. Accessibility as a satisfaction driver (large text, screen readers, Reduce Motion)

### Takeaway
No primary data was found in this session that quantifies accessibility's effect on satisfaction, or how many non-disabled users enable larger text. The platform guidance requirements are well established, but no figures were collected here. Treat accessibility as a must-be (Kano) attribute for affected users rather than citing an effect size.

### Cited Findings
- NN/g's animation guidance says to be "mindful of accessibility issues" when animating. **[practitioner]** — [NN/g: UX Animations video page](https://nngroup.com/videos/ux-animations)
- Android's permissions guidance and NN/g both require that a denied feature be explained and recoverable. This matters most for screen-reader users, who can't see visual cues that a feature is disabled. **[primary / practitioner]** — [NN/g: Permission Requests](https://www.nngroup.com/articles/permission-requests/)

### Inferences
- Model A's capture step (camera framing), the pairing-code entry and the room chips are the places most likely to fail for VoiceOver/TalkBack and at the largest Dynamic Type sizes. Chips must wrap, and the code field must announce format and errors.
- The project already forbids capping font scaling and makes the shimmer static under Reduce Motion (CLAUDE.md). These are the checkable baseline.

### Gaps
- Not found: the share of iOS/Android users who change the default text size; controlled studies linking accessibility fixes to satisfaction or retention in general-audience apps; Apple HIG Accessibility and Material accessibility specifics (not fetched). Needs a follow-up search, e.g. Apple/Google accessibility usage statistics or WebAIM screen-reader surveys.

## 7. What can be checked automatically or semi-automatically

### Takeaway
Most of the principles above reduce to countable properties of a scripted first run: screens, taps and fields to the first identification and to Plants home; when each permission request fires relative to the triggering tap; whether progress denominators change; animation durations; and accessibility scans. The sources give targets for some (Baymard field counts, NN/g durations, in-context permission timing). The others need a baseline from this app's own runs.

### Cited Findings
- Android vitals tracks permission denial rates as a quality signal; unusually high denial means users don't see enough value. **[primary]** — [Android vitals: Permission denials](https://developer.android.com/topic/performance/vitals/permissions)
- The CHI 2004 peak-end study recommends measuring usability repeatedly during a session, not only at the end. That supports in-flow micro-ratings in moderated tests. **[primary, small sample]** — [CHI 2004 PDF](https://hci.rwth-aachen.de/materials/conferences/CHI2004/2p1283.pdf)
- Measure the custom pre-prompt accept rate and the OS grant rate as separate metrics. **[vendor guidance]** — [OneSignal docs](https://documentation.onesignal.com/docs/en/prompt-for-push-permissions.md)
- Field-count targets: about 8 fields as the needed checkout maximum (Baymard). Animation duration range 100–500 ms (NN/g). — [Baymard](https://baymard.com/research-articles/ecommerce-checkout-usability-report-and-benchmark); [NN/g](https://nngroup.com/articles/animation-duration)

### Inferences (proposed checks for this repo)
- **Scripted first-run test** (Playwright on Expo web, like the existing `apps/mobile/e2e/m2-security.mjs`, or a device runner such as Maestro/Detox). Record: screens and taps from Welcome to first identification result; from Welcome to Plants home with and without the module; text fields typed; time-on-task with stubbed network. Assert ceilings and fail on regression. Suggested starting ceilings: ≤ 3 taps to the camera; 1 required text field before the account sheet; ≤ 2 fields on the account sheet.
- **Permission timing assertions** (Jest/RNTL with mocked `expo-camera` / `expo-notifications`): the camera request is called only after the "Scan a plant" press; the notification request is never called before module setup completes, never on the skip path, and never at mount; the "Not now" button on the pre-screen does not call the OS request.
- **Progress-indicator invariant**: `StepProgress` total is constant within a sequence, and step 1 shows non-zero progress.
- **Guest-data survival**: create a plant, kill and restart the app, sign up, confirm, sign in; the plant still exists. Checked in e2e.
- **Error/recovery paths**: low-confidence identification, wrong pairing code and offline each leave a visible next action and keep entered data. Scriptable with mocked function responses.
- **Motion budget**: grep motion tokens (`src/theme/motion.ts`) for durations > 500 ms outside the launch animation; a unit test asserts Reduce Motion short-circuits them.
- **Accessibility**: RNTL queries by role/label (every touchable has an accessible name; chips expose selected state); a render test at the largest font scale checks no truncation of key labels; manual passes with Xcode Accessibility Inspector, Android Accessibility Scanner, and VoiceOver/TalkBack walkthroughs of the first run (semi-automatic).
- **Field metrics (after launch)**: funnel per screen; OS-permission grant rate; account-sheet completion and email-confirm completion; D1/D7 return. Product analytics would be a new dependency, so ask first under the project's no-new-deps rule.

### Gaps
- No published benchmark found for "good" taps-to-value or time-to-first-value in consumer mobile onboarding. Targets above are proposals and must be baselined on this app.
- Tool docs for Maestro/Detox/Accessibility Scanner were not fetched this session; their suitability for this Expo SDK 58 setup is unverified.
