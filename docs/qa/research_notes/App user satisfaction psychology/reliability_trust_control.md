# Reliability, errors, trust and sense of control in apps that run a physical device

Context: plant-care companion app (Expo / React Native) for a self-watering saucer module (about 705 ml tank and pump, moisture stake, Wi-Fi, battery). The module waters on its own. The app shows moisture, water left, battery, last check-in and a status ("Needs you" / "Doing well"). A fault stops watering and asks the user to check the stake and tap "Resume watering". Errors show a short message plus "Try again". A failed load with no cache shows "—".

Research done 2026-11-19 in 16 tool calls. Several primary papers (Lee & See 2004 full text, Dzindolet 2003 full text, Sarter & Woods) could only be read at abstract or secondary-summary level. This is flagged wherever it applies.

## 1. How strongly do crashes, ANRs and failed actions drive ratings, uninstalls and churn?

### Takeaway
The firmest evidence is platform policy. Google Play treats a user-perceived crash rate above 1.09% or an ANR rate above 0.47% (per daily active user, 28-day average) as "bad behaviour", and may then show the app less and put a warning on its store listing. In peer-reviewed review-mining studies, functional errors and crashes are the most common complaints in 1- and 2-star reviews. The precise "crash-free rate → star rating" thresholds come only from a vendor with an undisclosed method, so they are weak evidence.

### Cited Findings
- Android vitals bad-behaviour thresholds: user-perceived crash rate 1.09% overall, 8% for any single phone model, 4% per watch model. User-perceived ANR rate 0.47% overall, 8% per phone model, 5% per watch model. Excessive partial wake locks 5%. — [Android vitals (developer.android.com)](https://developer.android.com/topic/performance/vitals)
- Above a threshold, "Play may reduce the visibility of your title. Play may also show users a warning on your store listing." Play uses the last 28 days of data and checks daily. Problems that affect devices for more than 7 days are flagged as "emerging issues", which leaves 21 days to fix them. — [Android vitals](https://developer.android.com/topic/performance/vitals)
- Vitals rates are per daily active user, not per session. A user who has one crash in three sessions in a day counts as a 100% crash rate in vitals, but 33% in Crashlytics. So a 1.09% vitals rate is stricter than a "98.9% crash-free sessions" figure would suggest. — [Android vitals FAQ](https://developer.android.com/topic/performance/vitals)
- New in the docs: from **February 2027**, memory usage, bitmap memory usage and DEX code optimisation may also affect store visibility. Thresholds for memory: 2.00–4.25 GB foreground, depending on the RAM tier. Bitmap memory: 200 MB for user-perceived services and background. — [Android vitals](https://developer.android.com/topic/performance/vitals)
- Khalid, Shihab, Nagappan, Hassan, "What Do Mobile App Users Complain About?" (IEEE Software 32(3), 2015/2014). The authors hand-tagged 6,390 one- and two-star reviews of 20 free iOS apps into 12 complaint types. The most frequent were functional errors, feature requests and app crashes. Privacy/ethical issues and hidden costs hurt ratings the most. About 11% of reviews blamed a recent update, which the authors read as an argument for regression testing. (These details come from a search summary and the abstract; I did not read the full text.) — [UWaterloo SWAG publication page](https://swag.uwaterloo.ca/publications/what-do-mobile-app-users-complain-about.html); [PDF](https://www.swag.uwaterloo.ca/www/assets/other/papers/khalid-ieeesw-2014.pdf); [ICSE 2013 version](https://2013.icse-conferences.org/content/identifying-user-complaints-ios-apps.html)
- Hu, Bezemer, Hassan (EMSE 2018) studied 1- and 2-star reviews of cross-platform top free apps. Functional errors were the top complaint on both Android and iOS. In 59% of the apps, users complained more often about crashing on iOS than on Android. — [Queen's SAIL PDF](https://sail.cs.queensu.ca/data/pdfs/EMSE2018_StudyingTheConsistencyOfStarRatingsAndTheComplaintsIn1&2StarUserReviewsForTopFreeCrossPlatformAndroidAndIOSApps.pdf)
- Vendor benchmark (Luciq, formerly Instabug, "Mobile App Stability Outlook 2025", based on 2024 data from apps on its platform; no sample size given). It names a "critical stability threshold" of about 99.7% crash-free sessions for a 3-star rating and about 99.85% to exceed 4.5 stars. Apps under 3 stars still have a median of 99.82% crash-free sessions. The overall median is 99.95% (iOS 99.91%, Android 99.80%; P25 99.77%, P75 99.99%). Median ANRs are 2.62 per 10k sessions, with a suggested threshold of about 10 per 10k. OOMs (out-of-memory crashes) show no clear link to ratings. **Weak evidence:** the method is undisclosed and the vendor has a commercial interest. — [Luciq stability outlook 2025](https://www.luciq.ai/mobile-app-stability-outlook-2025)
- A peer-reviewed Google Play study (Bavota et al., ESEC/FSE 2013, 7,097 apps) links lower ratings to apps that use fault-prone and change-prone APIs. This is an indirect proxy, not a measure of crash rate. — [ESEC/FSE 2013 PDF](https://people.lu.usi.ch/bavotg/papers/ESECFSE_2013.pdf)

### Inferences
- The Luciq medians suggest that even 99.8% crash-free sessions is below the median. A realistic target for a small app is ≥ 99.9% crash-free sessions and comfortably < 1.09% user-perceived crash rate / < 0.47% ANR rate per DAU on Android.
- In review mining, "functional error" is a larger category than crashes. For this app, a failed "Resume watering", a stale reading presented as current, or a plan that did not run will probably be reviewed as "doesn't work", even though nothing crashed. Silent failures of the device count as app failures to the user.
- Regressions after updates show up in reviews, so tests for error and empty states belong in CI, not only in a one-off QA pass.

### Gaps
- I found no peer-reviewed study that directly regresses star rating or uninstall rate on measured crash rate. The widely quoted "X% of users uninstall after one crash" survey figures could not be traced to primary studies, so they are left out.
- I found no data specific to companion apps for IoT or consumer hardware that links app crashes to device returns or churn.

## 2. Error messages and recovery: wording, blame, recovery paths, keeping user input, fear of losing data

### Takeaway
The guidance agrees across sources: put the error where it happened; use plain language with no codes; say exactly what went wrong; offer a concrete fix; never blame the user; keep the user's input so they repair only the faulty part; make actions reversible, because reversibility "relieves anxiety". This is expert and heuristic guidance (NN/g, Shneiderman), not effect-size data.

### Cited Findings
- NN/g "Error-Message Guidelines" (Neusesser & Sunwall, 14 May 2023):
  - Visibility. "Display the error message close to the error's source"; "never use exclusively color or animation to indicate errors"; "Design errors based on their impact" (modals only for serious errors); "Avoid prematurely displaying errors."
  - Communication. "Use human-readable language"; show error codes "for technical diagnostic purposes only"; "Provide descriptions of the exact problems"; "Merely stating the problem is also not enough; offer some potential remedies"; "Take a positive tone and don't blame the user"; "Avoid humor since it can become stale if users encounter the error frequently."
  - Efficiency. "Safeguard against likely mistakes"; "Preserve the user's input"; "Let users correct errors by editing their original action instead of starting over"; "If possible, guess the correct action and let users pick it from a small list of fixes"; "Concisely educate on how the system works."
  - — [NN/g Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/)
- Shneiderman's Eight Golden Rules:
  - Rule 5, "Prevent errors": "If users make an error, the interface should offer simple, constructive, and specific instructions for recovery … users should not have to retype an entire name-address form if they enter an invalid zip code, but rather should be guided to repair only the faulty part. Erroneous actions should leave the interface state unchanged, or the interface should give instructions about restoring the state."
  - Rule 6, "Permit easy reversal of actions": "This feature relieves anxiety, since users know that errors can be undone, and encourages exploration of unfamiliar options."
  - — [Shneiderman, Eight Golden Rules (UMD)](https://www.cs.umd.edu/users/ben/goldenrules.html)
- Smart-home diary study (NN/g, 2026). Vague error text and generic alerts ("Motion detected") forced users to open the app to find out what happened. Users wanted messages that name the event, the time frame and the action needed. — [NN/g, Designing Useful Smart Home Notifications (Kenderova & Neusesser, 20 Feb 2026)](https://www.nngroup.com/articles/smart-home-notifications/)

### Inferences
- The app's pattern of "short message + Try again" meets the "offer a remedy" rule only when retrying can actually fix the problem. For device faults (stake out of soil, empty tank), the message should name the specific physical check, as the "check the stake" copy already does. A generic retry there would be an unhelpful remedy.
- "Erroneous actions should leave the interface state unchanged" maps to optimistic updates. A failed mutation (rename, resume watering, delete) must roll the UI back to the true server state and keep anything the user typed.
- Humour in error text is discouraged for repeated errors. Connectivity errors on a device app will repeat.

### Gaps
- I found no controlled study that measures how much blame-free wording or input preservation raises satisfaction scores. The evidence here is heuristic and qualitative.
- I found no primary research on "data-loss anxiety" as a measured construct in mobile apps. The only support is Shneiderman's "relieves anxiety" claim, which is design wisdom, not an experiment.

## 3. Trust in automation and IoT: calibration, automation surprises, alert fatigue, status information, honest uncertainty

### Takeaway
The goal is calibrated trust, not maximum trust (Lee & See 2004). Users should trust the device as much as it deserves, and no more. Trust is built from performance, process and purpose. It drops after visible failures, but holds up better when users know why the automation might fail (Dzindolet et al. 2003). Unexpected autonomous actions ("automation surprises") and noisy or late alerts erode trust. Users then disable notifications, and that is hard to undo. Smart-home users also want to be told when things recover, not only when they fail.

### Cited Findings
- Lee & See, "Trust in Automation: Designing for Appropriate Reliance", *Human Factors* 46(1):50–80, 2004. The paper argues that automation often fails because people rely on it inappropriately, either by misuse (over-reliance) or disuse (rejecting automation that works). It "identifies design, evaluation, and training approaches to promote appropriate trust and reliance." Trust guides reliance most when complexity makes it impractical to fully understand the automation. — [PubMed abstract](https://pubmed.ncbi.nlm.nih.gov/15151155/); [SAGE DOI](https://journals.sagepub.com/doi/10.1518/hfes.46.1.50_30392)
- The three bases of trust in Lee & See are performance (what it does), process (how it works) and purpose (why it exists). The design targets are calibration (trust matches trustworthiness), resolution (changes in trustworthiness show up as changes in trust) and specificity (users can tell which component is trustworthy). These come from secondary summaries; I could not fetch the full PDF. — [Arxiv 2204.13828, Designing for Responsible Trust in AI Systems](https://arxiv.org/pdf/2204.13828) (search-snippet level); [Arxiv 2311.06305 systematic review](https://arxiv.org/pdf/2311.06305)
- Dzindolet et al. 2003 (*IJHCS* 58:697–718), three studies. Telling participants why an automated aid might make mistakes raised their trust and reliance, even when that trust was not warranted. Later reviews cite this as evidence that explaining possible errors maintains trust and use. (Abstract and secondary level only.) — [Search summary of Dzindolet 2003 / review](https://journals.sagepub.com/doi/10.1177/0018720814547570); [DTIC related report](https://apps.dtic.mil/sti/pdfs/ADA390225.pdf)
- Automation surprise and mode awareness (Sarter & Woods 1995, "How in the world did we get into that mode?"; Sarter, Woods & Billings 1997). Losing awareness of what the automation is doing, and will do next, was identified as one of the most critical problems in glass-cockpit aviation. Woods frames the practitioner's questions as "What's it doing? Why is it doing that? What will it do next?" — [Wikipedia: Automation surprise](https://en.wikipedia.org/wiki/Automation_surprise); [Woods slides (UK gov)](https://assets.publishing.service.gov.uk/media/5a7f1f6aed915d74e6228865/Prof_David_Woods__Ohio_State_University.pdf)
- Chiang et al., CHI 2020 (smart-home routine assistants, user-enactment study). Without clear communication, users may hold unrealistic expectations or be frustrated by errors, "potentially leading to the abandonment of these technologies". The authors suggest that early on the assistant should ask permission before acting, to respect autonomy and build trust. — [Chiang et al. CHI 2020 PDF](https://people.cs.nycu.edu.tw/~armuro/pubs/chiang-et-al-2020-chi.pdf)
- Halvachi et al. (arXiv 2307.05512): web experiments with 324 participants in a 3D smart-home simulation. Acceptance of automated environments fell when automation failures and interaction conflicts were present. (Preprint.) — [arXiv 2307.05512](https://arxiv.org/pdf/2307.05512)
- Henkel et al., IMWUT 2025 (a lab study with 48 participants, then 16 interviews, on a safety smart home). False-positive alarms and unwanted automatic actions must be handled carefully, "to avoid mistrust, users feeling a loss of control, and damage through unwanted executions". — [Henkel et al. 2025 PDF](https://www.peasec.de/paper/2025/2025_HenkelHaeslerAlNajmiHesselReuter_HouseThatSavesMe_IMWUT.pdf)
- Yarosh et al., CHI 2017 (feature interactions in smart homes). No participant correctly predicted every case of how conflicting rules would resolve. Automation logic that users cannot predict is common. — [search summary, Yarosh lab](https://lanayarosh.com/?p=854)
- Brush et al., CHI 2011, "Home automation in the wild" (home visits to 14 households). The barriers found were high cost of ownership, inflexibility, poor manageability and difficulty achieving security. Reliability was not among the barriers named in the abstract. — [researchr](https://researchr.org/publication/BrushLMASD11); [MSR page](https://www.microsoft.com/en-us/research/?p=160967)
- NN/g smart-home notification diary study (2 weeks; number of participants not stated, 20 Feb 2026):
  - Delayed alerts reduced trust. False alarms and a battery warning that stayed after the battery was replaced made users distrust the system ("Last night I got 99 notifications").
  - Repeated alerts led a user to turn off a whole category. When every alert looked the same, users either ignored them or worried about each one.
  - Users wanted to be told when a device came back online.
  - Recommendations: tie alerts to thresholds the user can act on and escalate them; be specific; use distinct urgency cues; let users set thresholds and frequency; auto-clear resolved alerts and "announce when normal operation resumes"; offer snooze.
  - "The goal is not to communicate more but to communicate better." Once users disable notifications, their trust is hard to win back.
  - — [NN/g Designing Useful Smart Home Notifications](https://www.nngroup.com/articles/smart-home-notifications/)
- Claims that "71% uninstall because of too many notifications" come from notification-vendor blogs with no primary study, so they are **weak evidence**. Braze's own uninstall write-up calls itself "totally unscientific". — [Braze](https://www.braze.com/blog/app-uninstalls-totally-unscientific-look-makes-customers-pull-plug/); [SuprSend](https://www.suprsend.com/post/alert-fatigue)

### Inferences
- **Status information that supports calibrated trust**, mapped to Lee & See's three bases:
  - Performance: last watering (when, how many ml) and recent moisture history. This is "show past performance".
  - Process: what the module will do next, and why it is not watering now (moisture above threshold, daily cap reached, tank low). This answers Woods's "what will it do next?".
  - Purpose: the safety limits in plain words (≤ 40 ml per dose, ≤ 150 ml per 24 h, stops on low tank), which match the CLAUDE.md watering limits.
  - These three sit behind the plant row as an optional detail. The top-level status stays one word ("Doing well" / "Needs you"), so users don't feel pushed to micromanage.
- **Honest uncertainty.** Showing "—" when there is no data, instead of a guessed value, follows calibration: a fabricated value would make the trust users place in the readings wrong. The same reasoning supports a staleness indicator. A reading older than the expected check-in interval should look stale (for example "Last check-in 9 h ago") and must not show as a live "Doing well". Otherwise users over-trust a module that may be offline.
- **Fault → "Resume watering"** fits the NN/g recommendations: the alert is actionable, specific and tied to a threshold. Two additions are suggested by the "announce recovery" finding. Confirm when watering has actually resumed, and auto-clear the "Needs you" state once the device reports healthy. Following Dzindolet, a one-line reason ("Watering paused: moisture didn't rise after 2 doses — the stake may be out of the soil") should help keep trust after a fault.
- **Alert fatigue risk.** A low-battery or low-tank warning that keeps firing after the user has fixed the problem is the exact failure NN/g observed. Alerts must clear when the condition clears.
- **Automation surprise risk.** Watering while the user is away is expected. Watering that does not happen when the user expected it, with no reason shown, is the surprise. Make the "why not" visible.

### Gaps
- I could not read the full text of Lee & See 2004. Its list of design guidelines (commonly cited as "design for appropriate trust, not greater trust", "show the past performance", "show the process", "show the purpose", "simplify the algorithms") is known only from secondary sources and could not be verified verbatim. The writer should either cite it as "per secondary summaries" or check against the paper itself (doi 10.1518/hfes.46.1.50_30392).
- The Dzindolet 2003 results are from the abstract or secondary sources only.
- I found no study of trust calibration specific to garden or plant automation, or to low-stakes home devices. Most evidence is from aviation, decision aids and security or safety smart homes, where stakes are higher. How far it transfers to a self-watering pot is an inference.
- I found no primary study on how users read "—" placeholders or staleness badges, compared with interpolated or last-known values.

## 4. Sense of control and predictability: internal locus of control, undo, confirmations, and their measured effect on satisfaction

### Takeaway
Shneiderman's rules ("keep users in control", "permit easy reversal", "prevent errors") are the standard heuristics. Smart-home studies show that unwanted or unpredictable automatic actions produce a felt loss of control and lower acceptance. However, I found no study that puts a number on how much undo or confirmations raise satisfaction.

### Cited Findings
- Shneiderman, Rule 7, "Keep users in control" (the current wording; the older edition's phrase "support internal locus of control" no longer appears on the page): "Experienced users strongly desire the sense that they are in charge of the interface and that the interface responds to their actions. They don't want surprises or changes in familiar behavior, and they are annoyed by tedious data-entry sequences, difficulty in obtaining necessary information, and inability to produce their desired result." — [Shneiderman, Eight Golden Rules](https://www.cs.umd.edu/users/ben/goldenrules.html)
- Rule 3, "Offer informative feedback": "For every user action, there should be an interface feedback … for infrequent and major actions, the response should be more substantial." Rule 6, reversal, "relieves anxiety". — [same](https://www.cs.umd.edu/users/ben/goldenrules.html)
- NN/g recommends modal dialogs (and therefore confirmations) only for errors with high impact ("Design errors based on their impact"). — [NN/g](https://www.nngroup.com/articles/error-message-guidelines/)
- Smart-home acceptance falls when automation failures or conflicts are present (n=324, preprint). Unwanted executions are linked to "users feeling a loss of control" (IMWUT 2025). Chiang et al. recommend asking permission early on to respect user autonomy. — [arXiv 2307.05512](https://arxiv.org/pdf/2307.05512); [Henkel et al. 2025](https://www.peasec.de/paper/2025/2025_HenkelHaeslerAlNajmiHesselReuter_HouseThatSavesMe_IMWUT.pdf); [Chiang et al. CHI 2020](https://people.cs.nycu.edu.tw/~armuro/pubs/chiang-et-al-2020-chi.pdf)
- Koshy et al., CHI 2021. Household members who configure the smart home ("pilots") end up with more control than "passengers". Perceived control is unevenly spread in shared homes. — [Stanford HCI](https://hci.stanford.edu/publications/paper.php?id=400)

### Inferences
- **Destructive actions in this app**, such as deleting a plant (which removes its scans and photos), deleting a photo and unpairing a device, are high impact and cannot be undone. Each should have one confirmation that names what will be lost. Low-impact actions should not be confirmed; they should be reversible or simply fast.
- **"Resume watering"** is a major, infrequent action that starts a pump. Following Rule 3, it deserves substantial feedback: immediate acknowledgement, then confirmation once the module picks up the command on its next check-in. The user should not be left wondering whether it worked.
- **Predictability.** The app should never change the watering behaviour silently (for example, a new plan from the backend) without a visible "what changed" entry. That would be the "changes in familiar behavior" Shneiderman warns about.

### Gaps
- I found no quantitative study (effect size on SUS, NPS or ratings) for undo, confirmations or locus of control in mobile apps.
- I did not study the trade-off between confirmations and habituation, where users click through confirmations automatically. The search budget ran out.

## 5. Which criteria can be checked automatically?

### Takeaway
The stability criteria can be checked directly from platform telemetry (Android vitals; App Store Connect / Xcode Organizer crash metrics; a crash SDK). Most of the error, recovery and honest-uncertainty criteria above can become deterministic Jest/RNTL tests and simple static checks. Trust and control outcomes need user research (surveys, review mining) and cannot be fully automated.

### Cited Findings
- Android vitals provides user-perceived crash and ANR rates per DAU, per-device breakdowns, email alerts and the Play Developer Reporting API for pipeline integration. It flags issues lasting more than 7 days. — [Android vitals](https://developer.android.com/topic/performance/vitals)
- Crash-free sessions and ANR or OOM rates per 10k sessions are the industry-standard SDK metrics. Vendor-suggested targets are ≥ 99.95% crash-free sessions and < 10 ANRs per 10k sessions (weak evidence, vendor). — [Luciq 2025](https://www.luciq.ai/mobile-app-stability-outlook-2025)
- Regression after updates causes about 11% of complaints in 1- and 2-star reviews (Khalid et al., per summary). This supports automated regression tests of error paths. — [Khalid et al.](https://swag.uwaterloo.ca/publications/what-do-mobile-app-users-complain-about.html)

### Inferences
These are proposed checkable criteria for this app. They are derived from the findings above; they are not sourced rules.

| # | Criterion | How to check automatically |
|---|---|---|
| R1 | Android user-perceived crash rate < 1.09% and ANR rate < 0.47% (per DAU, 28-day); no phone model > 8% | Play Developer Reporting API / vitals alerts; release gate |
| R2 | Crash-free sessions ≥ 99.9% on both platforms (stretch goal 99.95%) | Crash SDK or App Store Connect metrics; release gate |
| E1 | Every query or mutation error state renders a human message plus a recovery action (Try again, or a specific physical step); no raw error, stack or status code text | Jest/RNTL: mock Supabase to reject for each screen hook; assert that a "Try again" role=button exists and that no text matches `/error|exception|\d{3}|stack/i` |
| E2 | A failed mutation leaves the UI equal to server state and keeps typed input | RNTL: type a value, reject the mutation, assert the input value persists and the optimistic change rolls back |
| E3 | No cache plus failed load shows "—" for every numeric field, never 0 or a guess | Jest: for each reading field, render with a query error and empty cache; assert "—" |
| E4 | Error text is defined in one module (like `authErrors.ts`) | Lint or grep check that user-facing error strings come from a shared map; snapshot test of the map against forbidden words ("invalid", "you failed", "oops") |
| T1 | Stale-data indicator: a reading older than N × expected check-in interval is shown as stale, and the plant status cannot be "Doing well" while stale | Unit test of the status function with fake clocks (`jest.useFakeTimers`) at boundary ages |
| T2 | Every "Needs you" state has an explanation and an action; it auto-clears when the device reports healthy | Unit-test the status mapper for every fault code: reason text is not empty, action is defined, and a healthy reading returns "Doing well" |
| T3 | "Resume watering" gives immediate acknowledgement plus a later confirmation of pickup; a pending state is visible | RNTL plus the sim (`node sim/sim.ts`) end to end: press, assert pending, advance the sim check-in, assert resumed |
| T4 | No duplicate alerts for an unchanged condition; alerts clear when the condition clears | Unit test of the notification or event dedupe logic over a sequence of readings |
| C1 | Every irreversible destructive action (delete plant, delete photo, unpair) shows one confirmation that names what is lost; reversible actions have none | RNTL: press delete, assert a dialog with an object name, cancel, assert nothing was called |
| C2 | Offline or chaos behaviour: airplane mode, Supabase 500s, timeouts and a module offline > 2 intervals all yield the correct states | Jest with a network-failure mock matrix; sim flag for dropped check-ins; Playwright web run with offline emulation |

- Not automatable: whether users trust the device appropriately (calibration), whether they feel in control, and whether alerts feel like noise. Measure these with in-app micro-surveys, beta interviews and periodic mining of 1- and 2-star reviews for "functional error / doesn't water / wrong reading" themes.

### Gaps
- I found no published "every error has a recovery action" lint rule for React Native. It would be custom (see E1/E4).
- iOS has no public equivalent of the vitals thresholds with ranking consequences. I did not research the specifics of App Store Connect crash metrics.
