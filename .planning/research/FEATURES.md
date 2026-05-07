# Feature Research

**Domain:** Crowdsourced egocentric (head-mounted) video / audio / IMU data collection app for embodied-AI training, paid-per-task, distributed via clan-chief network in India + Brazil
**Researched:** 2026-05-07
**Confidence:** MEDIUM-HIGH (HIGH on competitor feature presence, MEDIUM on competitor implementation specifics, LOW on India-specific contributor expectations)

---

## Executive Summary

The relevant competitor cluster splits into three strands:

1. **Paid-microtask / data-labeling apps** — Sapien, Surge AI, Outlier (Scale), Remotasks (Scale), Toloka, Clickworker, Appen, Karya. Mostly desktop-or-mobile annotation. They define the **payout-trust** and **quality-feedback** patterns.
2. **Field-data / mystery-shopper gig apps** — Premise, Streetbees, Field Agent, BeMyEye. Mobile-native, photo-based, physical-action paid gigs. Define **task-discovery**, **earnings-ledger**, and **referral** patterns.
3. **Egocentric / embodied-AI data collection apps** — Micro1 (the closest analogue, used by Tesla/Figure-adjacent contractors), DoorDash Tasks, Vader/EgoPlay, Project Aria, Karya video pipeline, academic Ego4D recruitment flow. These directly map onto Homelander's job.

**The closest published analogue is Micro1's iPhone-on-forehead workflow** (MIT Technology Review, April 2026): contributors strap iPhones to their heads, record household chores, and submit videos that are reviewed by AI + human and either accepted or rejected at $15/hour. Micro1 is the apples-to-apples comparison. The article also confirms that **DoorDash Tasks** (March 2026) and **Vader/EgoPlay** (token-based) operate in this exact lane.

**Verdict on the locked feature set:** Solid for the *capture-quality-first* MVP thesis. But there are ~6 table-stakes features the locked set is missing (in-app feedback channel, app-version display, troubleshooting deep-link, storage-warning persistence, pull-to-refresh, network-state surfacing) that even a barebones recording app should ship — most are sub-day work and were probably oversights, not deliberate cuts. The deliberate exclusions (notifications, async-QA UI, payouts UI, retention loops) are defensibly out of scope for MVP given the "ship flat, learn first" thesis, but **payout-trust** is the single largest known retention risk and deserves a thin-slice treatment even at MVP — see anti-feature analysis below.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist on a paid mobile app. Missing these = product feels broken or untrustworthy.

| Feature | Why Expected | Status in Locked Set | Complexity | Evidence |
|---------|--------------|---------------------|------------|----------|
| Splash + branded logo | Universal mobile pattern | LOCKED §5.1 | LOW | All competitors |
| Sign-up via OAuth (Google) | Standard 2026 mobile auth | LOCKED §5.2 | LOW | Outlier, Sapien, Toloka, Karya all use Google/SSO |
| Permission priming (camera/mic/location) | Required for capture; users expect "why we need this" copy | PARTIAL — permissions requested at first feature use but no priming screen documented | LOW | Industry standard per Android dev guidelines; competitor flows almost always pre-explain camera/mic |
| Device compatibility check | Capture-quality apps universally check before letting user record | LOCKED §5.4 | MEDIUM | Project Aria SDK does this; Karya runs Android-version checks; Ego4D had hardware shipped + Zoom training |
| Onboarding tutorial | Users expect to be shown how to use a paid app | LOCKED §5.5 (rig + 60s practice) | LOW-MED | Remotasks bootcamps, Outlier training courses, Sapien gamified onboarding |
| Task list / catalog | Core "what can I do today" surface | LOCKED §5.7 (65 tasks, 10 categories) | MED | All competitors have this; Sapien/Outlier add filters by skill/tier |
| Task search | Users in 65+ task catalogs expect search | LOCKED §5.7 (server semantic + lexical) | MED | Universal pattern for catalogs >20 items |
| Recording surface (camera preview, record/stop) | Core function | LOCKED §5.8 | HIGH | Micro1, AoE, DoorDash Tasks |
| Auto-save / never-lose-work | Users panic about lost recordings | LOCKED (fragmented MP4 30s flush, foreground service, hash-verify-then-delete, queue preservation on logout) | HIGH | Industry-standard for any capture app post-2020; the locked set is unusually robust here |
| Background upload | Users expect uploads to continue when they background the app | LOCKED §7.4 | HIGH | DoorDash, BeMyEye, Sapien all do this |
| Upload progress visibility | Anxiety reducer for "is my data safe?" | LOCKED §5.6 (Pending uploads tile) + §5.9 | LOW | Universal post-2018 |
| Upload state in History | Users want to see what's done vs in-flight vs failed | LOCKED §5.10 (state chips per row) | LOW | All competitors |
| In-app playback of own recordings | Users expect to verify their work | LOCKED §5.10 (in-app player while local exists) | MED | Standard for any video-capture app |
| Profile (name, age, avatar) | Standard account pattern | LOCKED §5.11 | LOW | Universal |
| Logout | Universal expectation | LOCKED §5.11 | LOW | Universal |
| Delete account | Required by GDPR / DPDP / LGPD; app-store policy | LOCKED §5.11 (30-day soft delete + DELETE-typed gate) | MED | Standard since 2023 |
| Help Center / FAQs | Users need self-serve help | LOCKED §5.12 (Instructions / FAQs / Troubleshooting accordions) | LOW | Karya, Sapien, BeMyEye all have this in-app |
| Forced upgrade gate | Standard for apps with backend dependencies | LOCKED §9 | LOW | Standard 2024+ pattern; Firebase Remote Config or static JSON |
| Crash reporting (silent) | Users implicitly expect the app not to crash; you can't fix what you can't see | LOCKED §12 (Crashlytics) | LOW | Universal |
| Privacy policy + Terms link | Legal + app-store required | LOCKED §5.2 (consent text) + §13 (stub link) | LOW | Universal |
| Coarse location consent | Required before capture stream metadata | LOCKED §5.3 | LOW | Universal |
| Sensors / IMU access | Required for the capture spec | LOCKED §5.3 (manifest-only) | LOW | Universal |

#### Table-stakes features MISSING from the locked set

These are universal-enough that contributors will notice their absence. Most are sub-day work — likely oversights rather than deliberate scope cuts. Each is annotated with how to handle it.

| Missing Feature | Why Expected | Complexity | Evidence | Recommendation |
|---|---|---|---|---|
| **In-app feedback / "Report a problem" button** | Mobile-app standard since ~2018; the only current channel is `[EMAIL_ADDRESS]` mailto in Help Center which is a friction step (open mail app → write → recall device model → recall what they did). Contributors who hit a bug at 11pm on cellular will not email, they'll uninstall. | LOW (1-day) | Instabug/Luciq/Gleap is the de-facto mobile pattern; Apple Feedback Assistant + Android Beta Feedback set the OS-level expectation; LogRocket calls in-app feedback "the standard". | **Add for MVP.** Single screen: pre-filled with device model + app version + recent logs (already captured by Crashlytics) + free-text field. Posts to a single backend endpoint. Reduces support load far more than it costs. |
| **App version display** | Users on Play Store builds expect to see their version number for support requests | LOW (30-min) | Universal pattern; required to make Help Center support workflow function | **Add for MVP.** Footer of Profile or Help Center: `v1.0.3 (build 142)`. Trivial. |
| **Pull-to-refresh on Tasks / History / Home tiles** | Universal mobile pattern since ~2010 | LOW (per surface, 1-2 hours) | Industry-universal; missing it makes a list feel "frozen" | **Add for MVP.** Default RN behavior when wired. |
| **Network-state surfacing** when offline | Users blame the app when uploads stall on cellular; explicit "you're offline, queued" copy reduces support load | LOW (1-day) | Karya specifically built for "no internet"; standard pattern in upload-heavy apps | **Add for MVP.** A subtle banner in Pending Uploads tile / Upload Queue screen when `NetInfo` reports offline. The Help Center already documents this behavior in copy (see help-center §3 "Uploads aren't progressing") so the UI gap stands out. |
| **Storage-warning **after** compatibility check** (not just at compat) | Compat is one-time. Users record for weeks / months and run out of storage in real use; the locked set warns once then never again | LOW (1-day) | Standard for any video-recording app; iOS Photos / Google Photos / DoorDash Tasks all surface persistent storage warnings | **Add for MVP.** Re-evaluate `getAvailableBytes()` before each recording start; show non-blocking warning banner in recording entry if <5 GB. The compat-time check already has the threshold logic. |
| **Recovery from compat-fail** | The locked compat-check shows which checks failed but the user cannot proceed. There is no path forward for genuine failures (e.g., user has a non-ultrawide phone) — the app becomes a brick. The Help Center hints at "try a different qualifying device" but there's no in-app affordance for "what now?" | LOW (copy only) | Standard pattern: clear next-steps page when device fails | **Add for MVP.** On compat-fail, show a "Why your phone failed + what to do" page with clear copy: device requirement list + a "Contact support" link (which, combined with the in-app feedback channel above, gives them a path). The Compat-fail page is implied by §5.4 "show which checks failed" but the *what now* layer is missing. |
| **Internet-required gates** | Sign-up / compat / upload require internet, but no offline-aware UX is documented | LOW | Standard for backend-dependent apps | **Add for MVP.** "Connect to the internet to continue" state on screens that require it. Likely already implicit but should be explicit in design-spec. |
| **Locale fallback for TTS** when Indian English female voice is not installed on the device | The locked spec calls for `en-IN` female voice with documented fallback chain — but the fallback chain is referenced as "documented" without being concretely listed; if the user's Pixel 7a has only `en-US` male, what plays? | LOW | TTS is unreliable across OEMs; ROM-specific gaps are common on Indian/Brazilian budget Android | **Decide and document for MVP** (likely already covered by §4 active "documented voice fallback chain" — but verify the fallback chain is actually written down somewhere downstream, not just promised). |

These additions are all defensible at MVP; total estimated work is ~5-7 days.

---

### Differentiators (Competitive Advantage; v2 Considerations)

These are NOT table stakes — competitors don't all have them — but the best-in-class do, and they're where Homelander could compete after the capture-quality moat is shipped. Most map onto strategic-suggestions.md §1-11 already, but with concrete competitor evidence.

| Feature | Value Proposition | Complexity | Best-in-class Evidence |
|---|---|---|---|
| **Estimated-earnings ledger** ("Estimated earnings: ₹X — payout window opens [date]") | Single largest known retention risk — competitors with paid-deferred models all offer running ledgers. Without one, "Payments coming soon" copy is dead weight. Sapien shows running point-balance from day 1; Outlier dashboard "shows detailed earnings information…what you earned for each task, including the time spent and the rate applied"; BeMyEye reviews repeatedly cite "secure, direct" payment as the trust anchor. | MED (backend ledger schema + Profile UI) | Sapien (continuous reputation+points), Outlier (per-task earning row), BeMyEye (PayPal direct, transparent), DoorDash Tasks (compensation displayed upfront per task). Strategic-suggestions.md §2 calls this out explicitly. |
| **Per-recording QA-status surface** (locked, unrevealed in v1) | Async-QA feedback is the second-largest known retention risk. Toloka's #1 worker complaint is "rejected without feedback"; Outlier's review workforce explicitly cites "no feedback process, nor an opportunity to correct wrong feedback". Even a binary "Accepted / Rejected" chip on a History row would dwarf competitor UX. | MED (depends on QA backend) | Toloka has rejection-rate metric (worker-visible); Sapien has continuously-updated reputation score; Surge AI has "real-time dashboards … per-worker trust ratings". Locked set reserves a "Feedback (coming soon)" button on History rows §5.10 — leverage that slot. |
| **Streaks / daily quests / first-X badges** | Every successful contributor app post-2020 uses streaks. Sapien's "daily missions, point streaks, achievements, leaderboards" is its acquisition narrative. Trophy.so research: streak features lift average streak length 5.69 vs 4.25 days; Duolingo's gamification raised engagement 60%. | MED | Sapien (mission-streaks-achievements-leaderboards), Trophy (industry research), Duolingo (the canonical model). Strategic-suggestions.md §5 already lists this. |
| **Clan-leaderboards (and clan identity)** | Acquisition is hierarchical (clan-chief → clan); the app is single-user-flat. Surfacing clan identity unlocks both retention and natural referral. Sapien has tier-based leaderboards; Toloka has skill-tier-based task access. | MED-HIGH (touches data model + UI) | Strategic-suggestions.md §6 explicit. |
| **Per-tier task access / reputation system** | Sapien's 4-tier system (Trainee 0-199 / Contributor 200-599 / Expert 600-799 / Master 800-1000) gates access to higher-paying tasks behind quality thresholds; Toloka uses "quality score: better accuracy → more tasks → higher earning"; Appen runs project-based qualification tests. This is the competitor-standard answer to "how do I keep contributors quality-pushing rather than volume-pushing?" | HIGH | Sapien (4 reputation tiers, full litepaper), Toloka (quality-score-gated task access), Appen (project qualification tests). Almost universal in mature paid-data platforms. |
| **In-app referral mechanic** (chief-to-clan, member-to-member) | Compounds the K-Quests acquisition channel. Clickworker, Toloka, BeMyEye, Outlier, Prolific, Crypto.com all run referral-link programs; BeMyEye specifically pays $1 per referral + 10% of first month. | MED | Universal in gig data apps. Strategic-suggestions.md §7 already lists. |
| **Localization (Hindi, Portuguese, Spanish)** | Karya specifically wins on regional-language inclusion (60% women, 95% marginalized communities). Target geos cover Hindi/Tamil/Telugu/Bengali/Marathi (India), Portuguese (Brazil). | MED (one round of i18n + 4-6 language packs) | Karya is the proof-of-concept in India. Strategic-suggestions.md §8. |
| **Wi-Fi-only upload toggle + monthly data ceiling** | India / Brazil are heavy cellular markets; 1.2 GB per 20-min recording is meaningful at a ₹150/month plan. Eventually a complaint vector. | LOW | Standard since 2020 in any upload-heavy app; YouTube, Spotify, Strava, Zoom Mobile all expose Wi-Fi-only toggles. Strategic-suggestions.md §9. |
| **Per-upload Play Integrity attestation** | Sign-in-only attestation is the floor. Industry-standard fraud floors include device-attest-per-submission. TELUS Digital's "defense in depth" model lists "continuous identity, location, and task accuracy monitoring". Critical once payout-fraud volume justifies it. | MED | Google Play Integrity API supports per-call attestation; iOS App Attest is the analog. Strategic-suggestions.md §3 + idea-brief §11 explicitly mark this deferred. |
| **Server-side perceptual-hash duplicate detection** | Catches the "same task recorded 20×" abuse pattern, the "TV/YouTube screen recording" pattern, and AI-generated frames. Industry-standard for any paid-content network. | MED-HIGH (server-side; pHash + faiss/Annoy) | TELUS Digital "anti-fraud framework"; Sightengine commercial product; standard for stock-photo and content-licensing platforms. Strategic-suggestions.md §3 + deferred-decisions.md. |
| **Random in-frame liveness gesture** | Lightweight per-recording challenge ("show 3 fingers then 5 fingers" or "look at left then right"). Catches looped clips and stale-recording replays. | MED | TELUS Digital "live video verification"; banking-grade liveness via Onfido / Persona / Stripe Identity. Strategic-suggestions.md §3 + deferred-decisions.md. |
| **Server-side IMU liveness fraud check** | Scaling IMU tells you whether the phone was actually being worn (head-mount has a distinctive IMU signature; static phone or screen-recording playback has none). Backend-only — no app changes needed. | MED (backend ML) | imu-liveness-check.md design exists; strategic-suggestions.md §3. Already a v2 plan. |
| **One-account-per-device binding** | Counters account-farming. Industry-standard for paid networks (TikTok Shop, ByteDance ad networks, BeMyEye implicit via PayPal). | MED | TELUS Digital, Sapien (via blockchain wallet binding). Strategic-suggestions.md §3. |
| **Bystander consent UI** (in-app secondary subject confirmation) | Current consent text punts liability to the recording user and is fragile under DPDP / LGPD / GDPR. Long-term legal blocker for v2. | HIGH (legal + UX) | None of the studied competitors have a clean answer; this is greenfield UX work. Strategic-suggestions.md §4 — flagged as v2 legal blocker. |
| **MVP success-metrics dashboards** | Acquisition / activation / engagement / quality / economics / retention / funnel-friction metrics. Currently zero quant gates. | LOW (Firebase Analytics already in scope; just configure dashboards) | Sapien, Outlier, Karya all run internal funnels. Strategic-suggestions.md §1 explicitly out of scope but cheap to set up via existing telemetry. |
| **Brand narrative around "training the future workforce"** | Strategic-suggestions.md §11 — currently the brand line ("Real Humyns. Real Intelligence.") is generic; the work itself has a real ethical narrative ("you are training what will eventually replace human labor, and getting paid to") that competitors don't own. Marketing differentiator more than feature, but appears in app onboarding tone, Help Center copy, payout transparency framing. | LOW | None — this is a positioning differentiator. |
| **Hardware tracking / "where is my rig"** | Ego4D Zoom-trained contributors; Project Aria has rolling application + research-kit shipping; Aria glasses use a Companion App tied to hardware. Homelander ships head rigs externally; nothing in-app tracks rig status, return, or replacement. | MED | Project Aria research-kit application flow, Aria Companion App. See dedicated section "Head-Rig Onboarding" below. |
| **Task-request status visibility** | Locked set has Send Request form but explicitly hides status (§5.7 "User does **not** see request status"). Workers want to know if their request was reviewed. | LOW | BeMyEye, Outlier, Toloka all surface request/qualification status. |

---

### Anti-Features (Deliberately NOT Building, with Reasoning)

These are features competitors offer that we should consciously **not** build. Each is paired with the reason and the alternative.

| Anti-Feature | Why Tempting | Why We Don't Build | Alternative / Reasoning |
|---|---|---|---|
| **Notifications (FCM/APNs/local)** | Industry-standard for retention; Karya, Sapien, BeMyEye all use them | Opt-in design isn't done; brand-trust risk if first-touch is "we'd like to send you notifications" before user has even recorded; iOS 17+ has push-permission cliff that's hard to recover from. | Defer per idea-brief §4. **Reasoning is sound.** Re-evaluate post-MVP once we have engagement data showing where re-engagement actually matters. |
| **In-app payments / payouts UI** | Users want to see what they've earned and cash out. Outlier, BeMyEye, Sapien all do this. | Regulatory + operational surface area is large; KYC, PCI, payment-processor integration, dispute resolution, refund handling. Defer per idea-brief §4. | **Partially correct.** *Payment processing* is correctly deferred. *Earnings ledger* (read-only, no cash-out) is a much smaller surface and should ship earlier — see strategic-suggestions §2 + Differentiators table above. The locked "Payments coming soon" copy is too thin and is a known retention risk. |
| **Async-QA feedback UI ("Why was my recording rejected?")** | Toloka / Sapien / Outlier reviews repeatedly complain about no-feedback rejections; competitor user-base knows this matters. | QA pipeline isn't shipping at MVP; surfacing fake or stale signals is worse than silence. | Defer per idea-brief §4. **Reasoning sound for v1.** But the History row already reserves a "Feedback (coming soon)" button — keep that hook live and ship the surface in v1.1 the moment QA produces signal. |
| **Manual upload cancel** | Standard expectation; users want control | Users will cancel uploads thinking they don't need them, then realize too late. Idea-brief §10 explicit: "logout cancels in-flight but preserves the queue." | **Reasoning sound.** Keep. |
| **User-side recording delete** (local or server) | Standard expectation; users want control | Dataset integrity; payout-dispute and dataset-management complexity. Idea-brief §4. | **Reasoning sound.** Keep. Help Center FAQ already explains this. |
| **Programmatic Do Not Disturb during recording** | Quality concern: incoming notifications break recordings | Requires `ACCESS_NOTIFICATION_POLICY` + Settings deep-link; out of scope per idea-brief §5.8 | **Reasoning sound.** Help Center already explains this in copy ("notifications behave per device settings"). |
| **Continuous on-device hands-in-frame enforcement** (cue loop / auto-stop on absence) | QA quality lift | Thermal / battery / skin-tone-bias risks not yet validated. Idea-brief §4. | **Reasoning sound.** One-shot pre-record gate stays in MVP. |
| **Real-time framing guides** (rule-of-thirds, horizon level, motion-too-fast) | QA quality lift | Not justified until QA data shows the lift. Idea-brief §4. | **Reasoning sound.** Defer until QA telemetry shows the failure mode. |
| **Mobile dark mode for non-recording surfaces** | Modern standard; battery saver | Tokens future-proofed but not yet validated; light-only with one dark surface (recording) at MVP. | **Reasoning sound.** Light-only is fine for MVP given target hardware (₹30K phones, OLED uncommon at this tier). |
| **Streaming uploaded recordings back from server after local delete** | "Why can't I see my old recordings?" — Help Center already addresses but it's a complaint vector | Signed-URL playback adds backend surface; minimal MVP value (user already uploaded — what action would they take?) | **Reasoning sound.** Help-Center copy ("This recording has been securely uploaded. Local copy cleared.") is the right answer. |
| **Multi-account on a single device** | Family / shared-phone scenarios; idea-brief §3.3 explicitly mentions secondary recorders sharing phones | Complicates session management; account-switching introduces upload-queue ownership ambiguity. Idea-brief §4. | **Reasoning sound.** Idea-brief §3.3 says "primary user signs in with own account" pattern — secondary recorders re-sign-in. |
| **Editable Google profile fields beyond name/age/gender** | Standard profile-edit pattern | Avatar editing adds an upload surface; email editing creates account-recovery complexity. | **Reasoning sound.** |
| **App success metrics blocking phase completion** | Industry-standard "ship-with-numbers" practice | Explicit choice: ship-by-vibe at MVP. | **Defensible** for MVP given the "learn first, layer later" thesis, but instrumentation should be in place via existing Firebase Analytics so metrics exist when the team is ready to look. The only thing skipped is the dashboards — not the events. |

---

## Specifically: How Other Apps Handle the Five Hard Problems

The brief calls out five questions that need explicit treatment. Each answered with concrete competitor evidence, then an opinionated recommendation for Homelander.

### 1. Payouts trust ("when do I get paid?" anxiety)

**Competitor patterns observed:**

| Approach | Examples | Tradeoffs |
|---|---|---|
| Upfront-displayed price per task | DoorDash Tasks, BeMyEye ("£5 for 10 min"), Field Agent ($3-15) | High trust, requires backend pricing already in place |
| Running earnings ledger updated per accepted task | Outlier dashboard, Sapien points-to-tokens, Karya pay-as-you-go | High trust if displayed honestly; requires server-side ledger |
| Reputation tier with stake / unlock thresholds | Sapien 4-tier (Trainee→Master), Toloka quality-score | Sets expectations for *future* earning, not just current |
| Token + crypto payout | Sapien (USDC + SAPIEN), Vader/EgoPlay (VADER tokens) | Modern but adds custody complexity + market risk |
| PayPal / direct bank within X days | BeMyEye (~48h review), Remotasks (weekly Tuesdays), Outlier (PayPal/Airtm/ACH weekly) | The default; simplest |
| "Coming soon" with vague timing | **Homelander current locked copy** | Lowest trust; biggest abandonment vector |

**Recurring complaint pattern across Glassdoor / Indeed reviews of Outlier, Micro1, Toloka, DoorDash:** workers cite payout confusion as the #1 reason to leave. Micro1 review: *"Extremely Low Pay and No Transparency"*. Outlier: *"discrepancies and poor communication"*. Toloka: *"rejected without any feedback"*. Even BeMyEye, which pays well, gets praised specifically for "secure, direct payment"; the reverse complaints dominate the negative-review skew.

**Recommendation for Homelander:**

The locked "Payments coming soon" copy is the single largest known retention bomb. The brief asks not to ship in-app payments — that's correct. But there's a four-feature ladder of payout-trust treatments that don't ship cash, only ship transparency:

1. **Show recording-eligible time accumulating in-app** — already partially covered by the contribution tile, but it's framed as "duration" not "earnings". Keep framing neutral until rates are decided.
2. **Show a tentative rate-per-hour** in the Help Center / Profile / Onboarding once the rate is set, with copy: *"You're earning approximately ₹X per QA-passing hour. Final rate locked at payout window."*
3. **Show a published payout-window date** (e.g., "First payout window: Aug 31, 2026") instead of vague "soon".
4. **Pilot payouts to clan chiefs first** (per strategic-suggestions §2) — clan chiefs tell their clans the money is real. Word-of-mouth carries a lot more than in-app copy.

Treatments 1 + 3 are <1 day of UI work each. Treatment 2 requires a rate decision. Treatment 4 is operational. None of them ship payment processing.

**Locked-set fix:** Update the Profile §5.11 payments card and Help Center §1 Payouts copy. The current copy *"Your earnings will start reflecting in the app soon"* is the worst possible thing to ship — it makes the user wait for an event with no defined trigger. Even just adding *"Payouts begin [date]"* unlocks it.

---

### 2. Quality feedback to contributors when QA is async

**Competitor patterns observed:**

| Approach | Examples | Tradeoffs |
|---|---|---|
| Per-submission accept / reject with optional reason | Toloka rejected-tasks metric, BeMyEye 48h review with status, Remotasks per-task feedback | Universal expectation; competitors who don't do this get savaged in reviews |
| Continuous reputation / quality score updated server-side | Sapien (0-1000 reputation), Toloka (quality score), Outlier (per-tier ratings), Surge AI (per-worker trust) | Requires QA backend that produces per-recording signal |
| Tier promotion / demotion with thresholds | Sapien 4-tier with quality gates (90% / 98% / 99%), Outlier tiered task access | Excellent retention lever once QA is producing signal |
| Periodic emailed quality report | Appen (manual), Surge AI (occasional) | Low-frequency, lower friction |
| **No feedback at all** | Toloka (per worker reviews), Outlier (per Indeed reviews) | Universal worst-rated competitor pattern |

**Quote from Toloka Trustpilot reviewers (2/5 rating):** *"workers receive only a 'failed' notification without score details or reasons for failure"* — this is exactly the model we are about to ship if we don't carve out a v1.1 surface.

**Recommendation for Homelander:**

Strategic-suggestions.md §3 already has this in v2 backlog under anti-fraud framing, but quality-feedback is a **separate** retention concern. The locked History rows already reserve a *"Feedback (coming soon)"* button per row §5.10 — that hook is the right architectural move. To unlock it:

1. **MVP:** Keep the disabled "Feedback (coming soon)" button on History rows. Ensure the backend is **already** storing per-recording QA outcomes (accept/reject + reason code) even though no UI exposes them. Crucial: the data must exist when v1.1 ships, otherwise v1.1 is gated on backend QA + storage + UI all at once.
2. **V1.1 (post-MVP, sequenced first):** Surface per-recording status chip on History rows: `Accepted` / `Rejected: <reason>` / `Under review`. Keep reason codes terse: *"video too dark"*, *"hands not in frame"*, *"phone not in landscape"*, *"task not matched"*. Three to seven canonical codes max.
3. **V1.2:** Emit accumulated-quality stat in Profile (*"Acceptance rate: 84% of last 30 recordings"*).
4. **V2:** Reputation tier system (Sapien-style 4-tier) gating premium-rate task access.

The MVP move is cheap (zero UI; just don't lose the data on the backend). It buys all subsequent treatments.

---

### 3. Onboarding without asking the user to install special hardware (the head-rig problem)

**Competitor patterns observed:**

| Approach | Examples | Tradeoffs |
|---|---|---|
| Ship hardware first, app afterwards | Ego4D (cameras shipped, Zoom training), Project Aria (rolling application + research-kit shipping), Pupil Labs (research kit) | High friction, high quality, low scale |
| Use phone alone, no rig | DoorDash Tasks (phone only), Vader/EgoPlay (phone only), BeMyEye (phone only) | Low friction, lower quality, no head-mount POV |
| Phone + DIY-style mount instructions | AoE arxiv paper (chest-mount, ergonomic neck mount, <$20 assembly) | Medium friction, contributor decides mount quality |
| Phone + provided rig (Homelander, Micro1) | Micro1 (iPhone-on-forehead per MIT TR), Homelander | Hardware logistics + app must validate the rig is being used |

**Closest analogue is Micro1**, which the MIT Technology Review (April 2026) describes as the iPhone-strapped-to-forehead workflow used for Tesla / Figure-adjacent contracting. The article doesn't disclose Micro1's app-side handling of rig delivery / activation / loss / replacement; this is a gap in publicly-available evidence.

**Project Aria** has the most mature hardware-tied app pattern: research applications, shipped device, Companion App (on Android + iOS) controls the device, Calibration in-app. Aria is a research program, not a paid network, so the model doesn't fully transfer — but the **Companion App + device-pairing-state** pattern is informative.

**What Homelander locked-set has:**

- **Tutorial Rig Screen** §5.5.1 — *"You'll need a head rig"* + line-art illustration. Single full-page takeover.
- That's it.

**What's missing:**

| Gap | Symptom | Recommendation |
|---|---|---|
| Rig didn't arrive yet — what does the contributor do? | Sign-up, compat-pass, runs into rig screen, no rig in hand. Currently the user can press Next and proceed past the rig screen with no rig. They'll record handheld, get terrible footage, footage gets QA-rejected, they uninstall. | Add a soft-CTA pair on the rig screen: *"Already have a rig"* (Next) / *"Don't have a rig yet"* (link to Help Center "How to get your rig" with chief contact info). MED — depends on chief-network rig distribution flow. |
| Rig is broken / lost — is it replaceable? | No in-app channel; only mailto. | The "Report a problem" / "Request a rig replacement" form belongs in Help Center alongside Send Request. LOW. |
| Rig is being used incorrectly (mounted wrong, loose, falling off mid-recording) | Affects QA. Help Center "Before you record" addresses this in copy: *"if it shakes / shifts while you move, the recording isn't usable."* But there's no in-app validation. | The hand-detection gate is the closest signal: if hands aren't framing properly, mount likely wrong. Could add a subtle "If your hands aren't lining up: check rig mount" tooltip inside the gate's reset state. LOW. |
| Multi-rig households (idea-brief §3.3 — primary lends to secondary) | Currently no UX problem because rig isn't tracked, but if v2 adds rig tracking the multi-user case needs a model. | Defer to v2 / rig-tracking work. |

**Recommendation for MVP:** Don't deeply engineer the head-rig flow yet — the locked tutorial screen is enough as long as we add (a) a "Don't have a rig yet" off-ramp on the rig screen + (b) a clear in-Help-Center channel to request rig support. Both ~half-day each. Bigger work (rig-pairing, rig-tracking, replacement flows) is v2-scoped.

**The genuinely novel feature we could add for MVP** is a **rig-mount validation step** in the tutorial: ask the user to put the rig on, look down at hands, and pass the existing hand-detection gate. If they pass, rig is mounted reasonably. This is a 1-2 day extension of the existing hand-gate logic and dramatically de-risks the "first real recording is bad because rig was wrong" failure mode. It maps to the existing Practice Recording §5.5.3 — already enters the recording flow with `practice = true`. The tutorial already does most of this work; just framing it as "verify your rig" copy is enough.

---

### 4. Network distribution (referrals, leaderboards, milestones)

**Competitor patterns observed:**

| Approach | Examples | Lift |
|---|---|---|
| Referral code + dashboard | Outlier, Toloka, Clickworker, BeMyEye, Prolific, Crypto.com, Remotasks | Universal |
| Per-referral cash bonus | BeMyEye ($1 + 10% of first month), Clickworker discount, Toloka credit | Direct $-incentive |
| Milestone bonuses (1st referral, 5th, 10th) | GrowSurf templates, SparkLoop, Crypto.com tiered referral | Compounds the standard referral |
| Daily / weekly streaks | Sapien, Duolingo (canonical), Trophy industry research lift | 25-60% engagement uplift |
| Leaderboards (tier or social) | Sapien tier-based, Toloka skill-tier-based access | Strong retention; clan-fit at Homelander |
| Quests (daily/weekly) | Sapien daily missions, Duolingo daily quests | 25% DAU lift per Trophy.so research |
| Badges / achievements | Sapien achievements, Strava, Duolingo, Sapien | 30% completion lift per industry research |

**Brief specifically asks** about retention loops on top of K-Quests acquisition. The strategic-suggestions.md §5/§6/§7 list of streaks, leaderboards, milestone celebrations, daily quests, clan visibility, in-app referrals is exactly the standard pattern.

**Homelander specifics that change the tradeoffs:**

- Acquisition is hierarchical (clan-chief → clan member). This is a structural advantage that no studied competitor has. Sapien has token economics; Homelander has clan structure already encoded in the network. Surfacing clan in-app is essentially free retention because the network already exists offline.
- Target users (18-35, India + Brazil) heavily over-index on gamified experiences (mobile gaming penetration is ~60% in India in this cohort).

**Recommendation:**

These are correctly out-of-scope for v1. **The order of v2 deployment matters** and isn't documented anywhere yet:

1. **First (most leverage, lowest cost):** Streaks ("4-day streak — keep it going"). Trivial to implement on top of the existing day-grouped History. Single Firebase event + Profile UI element.
2. **Second:** Clan identity + clan-leaderboard. Re-uses existing user data. Requires KGeN cross-reference — biggest dependency. ~2-3 weeks.
3. **Third:** Milestone celebrations (first hour recorded, 10 hours, 50, 100). Retention-anchor moments. ~1 week.
4. **Fourth:** In-app referral mechanic with milestone bonuses (chief → member, member → member). Requires payout-trust to be solid first. ~2 weeks.
5. **Fifth:** Daily / weekly quests. Requires content-management surface. ~3 weeks.
6. **Sixth:** Reputation tiers (Sapien-style). Requires QA pipeline producing reliable signal. v3-ish.

---

### 5. Anti-fraud beyond sign-in attestation (what's standard?)

**Competitor patterns observed:**

| Approach | Examples | Stake |
|---|---|---|
| Sign-in device attestation only | **Homelander current locked-set** (Play Integrity at sign-in only) | Lowest |
| Per-call / per-submission attestation | Industry standard for paid networks; Google Play Integrity API supports | Standard |
| Server-side perceptual-hash duplicate detection | Stock photo (Shutterstock), content licensing, TELUS Digital "anti-fraud framework", Sightengine | Standard for paid-content |
| In-frame liveness gestures (random) | TELUS Digital live video verification, Onfido, Persona | Standard for KYC-grade |
| Server-side IMU liveness | imu-liveness-check.md design, deferred to v2 | Novel, valuable for head-mount |
| Behavioral / IP / location anomaly detection | TELUS Digital "continuous identity, location, and task accuracy monitoring" | Standard |
| Account-per-device binding | Sapien (wallet-tied), TikTok Shop (device hash) | Standard |
| Rate limits per user / clan / IP | TELUS Digital "real-time event tracking" | Trivial server-side |
| AI / human review pipeline | Micro1 (AI + human review), Surge AI ("low quality labels automatically reassigned") | Standard for paid |
| Qualification tests / quality gates | Appen, Toloka, Sapien (tier thresholds) | Reduces fraud surface upstream |

**The TELUS Digital framing** of "defense in depth" is the most useful: no single defense; many imperfect layers. The Homelander locked floor (Play Integrity at sign-in only) is the **first** layer; almost every named competitor has 4-6 layers.

**Recommendation:**

Strategic-suggestions.md §3 already lists the v2 fraud roadmap. Homelander's specific situation:

- **Capture spec is fraud-friendly already.** The locked spec collects IMU at ≥100 Hz with ±1 ms drift figures. This single detail rules out screen-recordings of TVs (no IMU motion correlated with video), looped clips (drift figures will repeat), AI-generated frames (no IMU at all), and most account-farms (IMU signature is per-device-per-rig). The IMU liveness check (imu-liveness-check.md, deferred to v2) is **the single highest-leverage anti-fraud move available** because it requires zero app-side changes.
- **Server-side rate limits per user / per IP** is trivial and should ship MVP. Backend Fastify can enforce in <1 day. Catch the 100-recordings-per-hour clan-farm.
- **Server-side perceptual-hash duplicate detection** is medium-cost (~1-2 weeks for an MVP-grade pHash + locality-sensitive-hash search) and high-value. Should be the first v1.1 feature once base ships.

The full anti-fraud ladder, ordered:

| Tier | Cost | Value | When |
|---|---|---|---|
| Sign-in Play Integrity | Done | Low | Locked MVP |
| Server-side rate limits per user / IP | Trivial | High | **Add to MVP backend** |
| Server-side IMU liveness check | Medium | Very high | V1.1 (data already collected) |
| Server-side perceptual-hash dup detection | Medium | High | V1.1 |
| Per-upload Play Integrity attestation | Medium | High | V2 |
| Account-per-device binding | Medium | Medium | V2 |
| Random in-frame liveness gesture | Medium | High | V2 (only if abuse demands) |
| Behavioral / location anomaly ML | High | Medium | V3 |
| Bystander-consent UI | High (legal) | Medium | V2 (legal driver) |

The locked MVP fraud floor is genuinely sparse but **the IMU-rich capture spec is the strategic moat**: the data needed for the highest-leverage detector is already being collected. Server-side rate limits should be added to the locked active list; everything else can stay deferred without much risk for the early-user APK rollout.

---

## Feature Dependencies

```
Capture pipeline (Camera2 + MediaCodec + IMU + audio)
    └──requires──> Compatibility check
    └──requires──> Permissions
    └──enables───> Recording surface
    └──enables───> Tutorial Practice recording

Recording surface
    └──requires──> Hand-detection gate
    └──requires──> Thermal monitor
    └──enables───> History
    └──produces──> Local MP4 + IMU CSV + metadata JSON
    └──feeds─────> Upload pipeline

Upload pipeline (S3 multipart presigned)
    └──requires──> Backend (Fastify + Postgres + S3)
    └──requires──> Hash-verify cycle (pre-upload + post-upload)
    └──enables───> Pending uploads tile
    └──enables───> History upload-state chips
    └──enables───> Local file deletion (gated on `verified` event)

Backend (Fastify + Postgres + S3)
    └──requires──> Auth (Google + Play Integrity)
    └──enables───> Tasks endpoint (with pgvector + ts_vector search)
    └──enables───> Contributions / time-series
    └──enables───> Forced upgrade gate
    └──enables───> Telemetry ingest
    └──enables───> [v1.1] Per-recording QA status
    └──enables───> [v1.1] Earnings ledger
    └──enables───> [v1.1] IMU liveness fraud check
    └──enables───> [v1.1] Perceptual-hash dedup

Tasks
    └──requires──> Task taxonomy (65 tasks × 10 categories — locked)
    └──requires──> Task icon mapping (lucide-react — locked)
    └──requires──> Backend tasks endpoint
    └──enables───> Task search (semantic + lexical)
    └──enables───> Send Request flow
    └──enables───> Task Details Universal-rules block

Profile
    └──requires──> Backend /me + /me/restore
    └──enables───> Logout
    └──enables───> Delete account (30-day soft delete)
    └──enables───> Help Center entry
    └──enables───> [v1.1] Earnings ledger surface
    └──enables───> [v1.1] Per-recording QA acceptance rate

Help Center
    └──requires──> Verbatim help-center-content.md copy
    └──requires──> Contact Support email config
    └──ENHANCED-BY──> [missing] In-app feedback form
    └──ENHANCED-BY──> [missing] App version display
```

### Dependency Notes

- **Capture pipeline → Compatibility check:** Cannot record without verifying device meets capture spec. Compatibility re-runs on app/OS update or new device per idea-brief §5.4.
- **Tutorial → Capture pipeline:** Practice recording uses the live capture pipeline with `practice = true` flag. Cannot ship tutorial before capture pipeline.
- **Backend `verified` event → Local file deletion:** Hash-verify supersedes naive upload-success-200 trigger. This is a safety dependency: ship backend hash-verify before client-side delete logic.
- **In-app feedback (proposed missing) → Crash logs / device info:** Reuses Crashlytics-collected device info for pre-fill. Free dependency.
- **Earnings ledger (v1.1) → Backend `verified` event + accept/reject signal:** Cannot show earnings until QA can accept. The backend hash-verify is necessary but not sufficient — needs an accept/reject layer above it.
- **Streaks / clan / quests (v2) → User identity persistence + analytics events:** All retention loops require existing-user data; ensure analytics events ARE captured at MVP even though dashboards aren't built (per strategic-suggestions §1).

### Conflicts

- **Continuous hands-in-frame enforcement (anti-feature)** ⊕ **One-shot hand-gate (locked MVP):** Continuous gate would invalidate the one-shot decision — pick one. MVP picks one-shot.
- **Manual upload cancel (anti-feature)** ⊕ **Hash-verify-then-delete pipeline:** Manual cancel would create local-file orphan + ledger ambiguity. Locked: no manual cancel.
- **Multi-account on a single device (anti-feature)** ⊕ **Logout-preserves-queue:** Multi-account would require per-account upload-queue isolation. Locked: one account at a time.

---

## MVP Definition

### Launch With (v1)

The locked active list from PROJECT.md, plus the seven table-stakes additions identified above:

**From locked active list (verbatim — already detailed in PROJECT.md §Active):**

- [ ] Capture pipeline (Camera2 + MediaCodec, IMU, audio, hash-verify pipeline)
- [ ] Onboarding & gating (Splash → Sign-up → Permissions → Compat → Tutorial)
- [ ] Recording surface (landscape lock, hand-gate, thermal/battery alerts, segment cuts)
- [ ] Tasks (65×10 catalog, semantic search, Send Request, Universal rules block)
- [ ] Upload pipeline (S3 multipart, foreground service, hash-verify-then-delete)
- [ ] Home / Tasks / History / Profile / Help Center / Forced upgrade
- [ ] Backend (Fastify + Postgres + S3, all listed endpoints)
- [ ] Observability (Firebase Crashlytics + Analytics)
- [ ] Cross-platform iOS analogues (≤2 weeks after Play Store)

**Additions to the active list (sub-day to 1-2 day work each):**

- [ ] **In-app feedback form** ("Report a problem" → Help Center entry → device-info-prefilled form → backend) — replaces or supplements the mailto-only Contact Support
- [ ] **App version display** in Profile or Help Center footer (`v1.0.3 (build 142)`)
- [ ] **Pull-to-refresh** on Tasks / History / Home tile filters
- [ ] **Network-state surfacing** (subtle banner in Pending Uploads when offline)
- [ ] **Recurring storage check** before each recording start (not just one-time at compat)
- [ ] **Compat-fail "what now" page** with Help Center link
- [ ] **Don't-have-a-rig-yet off-ramp** on tutorial Rig Screen
- [ ] **Server-side rate limits per user / IP** (backend; trivial; catches early farming)
- [ ] **Updated Payouts copy** with explicit window date (replaces *"earnings will start reflecting … soon"*)

These nine items plus the locked-set are still a coherent MVP.

### Add After Validation (v1.x)

Triggered by: data showing where users drop off or fraud rates becoming significant.

- [ ] **Per-recording QA-status chip on History rows** — when QA backend reliably produces accept/reject signal
- [ ] **Earnings ledger** (read-only) — when payout schedule is set and rate is decided
- [ ] **Perceptual-hash duplicate detection (server-side)** — when fraud volume justifies
- [ ] **IMU liveness fraud check (server-side)** — high-leverage; can ship as soon as backend ML capacity exists; no app changes
- [ ] **Acceptance-rate in Profile** — once accept/reject signal is reliable
- [ ] **Streaks** — when retention data shows daily-cadence opportunity
- [ ] **Wi-Fi-only upload toggle + monthly data ceiling** — when cellular-data complaint volume exists
- [ ] **Localization** (Hindi, Portuguese; later Spanish) — when geo-mix justifies
- [ ] **Per-upload Play Integrity attestation** — when fraud volume justifies

### Future Consideration (v2+)

Defer until product-market fit and known retention failure modes.

- [ ] **Clan identity + clan-leaderboards** — requires KGeN cross-reference; biggest dependency
- [ ] **Reputation tiers** (Sapien-style) — once QA produces reliable per-user signal
- [ ] **In-app referral mechanic with milestone bonuses** — once payout-trust is solid
- [ ] **Daily / weekly quests** — requires content-management surface
- [ ] **In-app payments / cash-out** — requires KYC + payment-processor + dispute resolution
- [ ] **Random in-frame liveness gesture** — only if perceptual-hash + IMU liveness leak fraud signal
- [ ] **Bystander consent UI** — DPDP / LGPD legal driver
- [ ] **Continuous on-device hands-in-frame enforcement** — once thermal / bias risk is validated
- [ ] **Real-time framing guides** — once QA shows the lift
- [ ] **Streaming uploaded recordings back from server** — only if a clear user need emerges
- [ ] **Notifications channel** — once opt-in design is done
- [ ] **Mobile dark mode for non-recording surfaces** — once usage data justifies
- [ ] **Web / PWA / desktop / tablet** — capture flow needs sensors that web can't reliably hit; may never ship
- [ ] **Editable avatar** — adds upload surface; defer
- [ ] **Multi-account per device** — complicates session management with no clear value
- [ ] **Brand narrative shift** ("training the future workforce") — positioning work, not engineering

---

## Feature Prioritization Matrix

Restricting to features not in the locked set (the locked set is all P1 by definition).

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| In-app feedback form (replacing mailto-only) | HIGH | LOW | **P1 (MVP)** |
| App version display | MED | LOW | **P1 (MVP)** |
| Pull-to-refresh | MED | LOW | **P1 (MVP)** |
| Network-state surfacing | MED | LOW | **P1 (MVP)** |
| Recurring storage check | MED | LOW | **P1 (MVP)** |
| Compat-fail "what now" page | HIGH | LOW | **P1 (MVP)** |
| Don't-have-a-rig-yet off-ramp | HIGH | LOW | **P1 (MVP)** |
| Server-side rate limits | HIGH | LOW | **P1 (MVP)** |
| Updated payouts copy with window date | HIGH | LOW | **P1 (MVP)** |
| Per-recording QA-status chip | HIGH | MED (depends on QA) | **P2** |
| Earnings ledger | HIGH | MED | **P2** |
| IMU liveness fraud check | HIGH | MED (backend-only) | **P2** |
| Perceptual-hash dedup | HIGH | MED-HIGH | **P2** |
| Streaks | MED | LOW-MED | **P2** |
| Wi-Fi-only upload toggle | MED | LOW | **P2** |
| Localization | HIGH | MED | **P2** |
| Per-upload Play Integrity | MED | MED | **P2** |
| Clan identity + leaderboards | HIGH | MED-HIGH | **P3** |
| Reputation tiers | MED | HIGH | **P3** |
| Referral mechanic | HIGH | MED | **P3** |
| Daily quests | MED | MED-HIGH | **P3** |
| In-app payments / cash-out | HIGH | HIGH | **P3** |
| Random in-frame liveness | MED | MED | **P3** |
| Bystander consent UI | LOW (legal yes; UX no) | HIGH | **P3** |
| Notifications channel | MED | MED (opt-in design needed) | **P3** |

---

## Competitor Feature Analysis

Restricted to features Homelander makes deliberate decisions about.

| Feature | Sapien | Outlier (Scale) | Toloka | Karya | BeMyEye | DoorDash Tasks | Micro1 | EgoPlay/Vader | **Homelander** |
|---|---|---|---|---|---|---|---|---|---|
| Mobile-native | Y | Hybrid | Y (mobile app) | Y (offline-first) | Y | Y | Y (iPhone) | Y | **Y (Android-first, RN)** |
| Auth | Wallet | Email | Email + phone | Phone | Email | DoorDash SSO | Email | Wallet | **Google + Play Integrity** |
| Hardware shipped | N | N | N | N | N | N | iPhone (some) | N | **Head rig** |
| Capture-quality compat check | N | N | N | Android-version only | N | N | Phone-side checks | N | **Strict ≥110° dFOV / IMU 100Hz / REALTIME / etc** |
| Hand-detection / liveness | N | N | N | N | N | N | Unknown | N | **One-shot pre-record gate** |
| Earnings ledger | Y (continuous) | Y (per-task row) | Y | Y (immediate) | Y (PayPal direct) | Y (upfront) | Y | Y (token) | **No (locked)** |
| Per-task QA feedback | Continuous reputation | Per-task rating | Accept/reject (no reason) | Pay-or-not | 48h review | Rejected if poor | AI+human review | Y | **Locked OUT for v1** |
| Reputation / tier system | 4-tier 0-1000 | Tier 1+ | Quality score | N | N | N | Quality-graded | Y (token-tier) | **None** |
| Streaks / quests | Daily missions, streaks | N | N | N | N | N | N | "EgoPlay" gamified | **None (locked)** |
| Leaderboards | Y (tier) | N | Y (skill) | N | N | N | N | Y | **None** |
| Referral program | Y | Y (in dashboard) | Y (link + code) | N | Y ($1 + 10%) | N | N | Y (token) | **None (locked)** |
| Localization | EN | Multi | Multi | 6 Indian langs | EN + EU | EN+ES | EN | EN | **EN-only (locked)** |
| Notifications | Y | Y | Y | Y | Y | Y | Y | Y | **None (locked)** |
| Background uploads | N (text-based) | N (text-based) | N | Y | Y | Y | Y | Y | **Y (foreground service)** |
| Manual upload cancel | n/a | n/a | n/a | Y | Y | Y | Unknown | Y | **N (locked anti-feature)** |
| User-side delete | n/a | n/a | n/a | Y | Y | Y | Unknown | Y | **N (locked anti-feature)** |
| In-app help / FAQs | Y | Y | Y | Y | Y | Y | Y | Y | **Y (3 accordions, locked)** |
| In-app feedback / report-bug | Y | Y | Y | Y | Y | Y | Unknown | Y | **No (mailto only) — RECOMMEND ADD** |
| Force-upgrade gate | Y | Y | Y | Y | Y | Y | Y | Y | **Y (`GET /app/version`)** |
| Privacy policy in-app | Y | Y | Y | Y | Y | Y | Y | Y | **Y (link, stub)** |
| Anti-fraud (sign-in) | Wallet | KYC | Phone verify | Phone verify | Phone verify | DoorDash account | Email + selfie | Wallet | **Play Integrity** |
| Anti-fraud (per-submission) | Stake + reputation | AI quality check | Quality score | Manual review | 48h human review | AI + human | AI + human | Token-stake + AI | **None (locked) — RECOMMEND server-side rate limits + V1.1 IMU liveness** |
| Liveness | N | N | N | N | N | N | "AI + human" review | N | **None (locked) — flagged for v2** |
| Perceptual-hash dedup | N (text) | N (text) | N (text) | Y (audio) | Possibly | Probably | Yes per MIT TR | Probably | **None (locked) — flagged for v1.1** |

The standout observation: **Homelander's locked MVP is unusually strict on capture quality and unusually lean on retention loops compared to all studied competitors.** Both choices are deliberate per the brief; both have known retention costs that are addressable in v1.1.

---

## Confidence and Open Questions

**HIGH confidence:**
- Sapien's gamified 4-tier system (sourced direct from their litepaper)
- BeMyEye, Outlier, Toloka, Clickworker, Karya feature presence (multi-source verified)
- Industry-universal patterns (in-app feedback, version display, pull-to-refresh, force-upgrade)
- Strategic-suggestions.md alignment with broader competitor patterns

**MEDIUM confidence:**
- Specific implementation details of Outlier / Toloka / Sapien dashboards (only one or two sources each, no direct demo access)
- DoorDash Tasks app feature set (still new, March 2026 launch — limited public review data)
- Vader/EgoPlay specifics (one source went down during research; couldn't get full litepaper)
- MIT Technology Review descriptions of Micro1 (single source; no direct access to Micro1's app)

**LOW confidence:**
- India-specific contributor expectations beyond Karya's published research
- Brazil-specific contributor expectations (no studied competitor has substantial Brazil presence)
- Whether Homelander's locked spec is *unusually* strict or *appropriately* strict for the target geo's hardware mix — would need cohort testing
- Specific rates that competitors actually pay for video data (most published numbers are aggregate / range, not per-task)

**Open questions for the team:**
- What is the published payout-window date that should replace "Payments coming soon"?
- Who owns the rig-distribution / rig-replacement flow operationally? Is it the clan chief?
- What QA accept/reject signal is the backend going to expose, and on what schedule?
- Is the in-app feedback channel additive to the email mailto, or replacing it?
- Are the 6-7 added table-stakes items (in-app feedback form, version display, pull-to-refresh, network state, storage re-check, compat-fail copy, rig off-ramp) acceptable to add to MVP scope?

---

## Sources

### Direct competitor analysis
- [Getting Started as a Data Labeler with Sapien](https://www.sapien.io/blog/getting-started-as-a-data-labeler-with-sapien) — Sapien's gamified daily missions, point streaks, achievements, leaderboards, reputation tiers, the Forge premium board
- [Sapien — Proof of Quality](https://www.sapien.io/) — overall Sapien positioning
- [GAMIFIED AI TRAINING EXPERIENCE | Sapien](https://docs.sapien.io/sapien-litepaper/gamified-ai-training-experience) — 4-tier reputation system 0-1000 with quality thresholds
- [Sapien Review – Gamified AI Data Labeling At Scale](https://aichief.com/ai-data-management/sapien/) — independent review
- [Outlier — Train the Next Generation of AI as a Freelancer](https://outlier.ai/faq) — Outlier dashboard, weekly Tuesday payments, PayPal/Airtm/ACH, referrals from dashboard
- [Outlier dashboard](https://app.outlier.ai/dashboard) — earnings dashboard pattern
- [Surge AI](https://surgehq.ai/) — real-time dashboards, gold-standard accuracy, per-worker trust ratings, automatic reassignment
- [Toloka rejected-tasks docs](https://toloka.ai/en/docs/guide/concepts/efficiency-metrics/rejected-tasks) — 2-day rejection-rate metric
- [Toloka Trustpilot reviews (2/5)](https://www.trustpilot.com/review/toloka.ai) — recurring "rejected without feedback" complaints
- [Toloka Review 2026 — Pay Rates, Task Types](https://westafricatradehub.com/reviews/toloka/) — quality-score-gated task access
- [Karya — We solve data needs](https://www.karya.in/) — pay-as-you-go, royalty model, 30K+ workers, 60% women
- [Conversational Data and Call Center Data Collection (Karya case study)](https://www.karya.in/resources/case-studies/conversational-data-collection-2400/)
- [BeMyEye — Earn money](https://content.bemyeye.com/earn-money/) — £5/10-min, secure-direct-payment trust narrative
- [BeMyEye Review – Worth It?](https://paidfromsurveys.com/bemyeye-review) — 48h review window, payout reliability
- [BeMyEye referral codes 2026](https://referralcodes.com/shop/be-my-eye) — $1 per referral + 10% of first month
- [Toloka referral codes 2026](https://referralcodes.com/shop/toloka-referral) — referral-link / referral-code pattern
- [Clickworker referral rewards](https://referralcodes.com/shop/clickworker-referral) — referral discount pattern
- [How to Get Started on Remotasks](https://nel-media.com/en/how-to-get-started-on-remotasks-a-complete-guide) — Bootcamp + qualification model, weekly PayPal Tuesdays
- [GoSurvey — Offline Survey](https://play.google.com/store/apps/details?id=com.techgrains.gosurvey&hl=en_IN) — offline-first sync (relevant for Karya-style robustness)
- [Streetbees community](https://www.streetbees.com/sbx/streetbees-app) — direct PayPal payment trust pattern

### Egocentric / embodied-AI direct analogues
- [The gig workers who are training humanoid robots at home — MIT Technology Review (April 2026)](https://www.technologyreview.com/2026/04/01/1134863/humanoid-data-training-gig-economy-2026-breakthrough-technology/) — **the closest published Homelander analogue** (Micro1's iPhone-on-forehead workflow, $15/hr, AI+human review)
- [The human work behind humanoid robots is being hidden — MIT Technology Review (Feb 2026)](https://www.technologyreview.com/2026/02/23/1133508/the-human-work-behind-humanoid-robots-is-being-hidden/) — workforce conditions, Figure / Brookfield partnership opacity
- [Humanoid data: 10 Things That Matter — MIT Technology Review (April 2026)](https://www.technologyreview.com/2026/04/21/1135656/humanoid-data-robot-training-ai-artificial-intelligence/)
- [DoorDash launches Tasks app — CXO Digitalpulse](https://www.cxodigitalpulse.com/doordash-launches-tasks-app-to-pay-couriers-for-ai-training-data-collection/) — March 2026, upfront-displayed pay, 1-3 day payment window
- [DoorDash Tasks App: Paying Couriers — AIToolly](https://aitoolly.com/ai-news/article/2026-03-20-doordash-introduces-new-tasks-app-paying-couriers-to-record-videos-for-ai-training-purposes)
- [DoorDash turns Gig Workers into AI Data Engines — Tekedia](https://www.tekedia.com/doordash-turns-gig-workers-into-ai-data-engines-with-new-tasks-app/)
- [Egocentric Video Data | Vader Litepaper](https://docs.vaderai.ai/introduction/egocentric-video-data) — Vader/EgoPlay tokenized contributor model
- [Vader](https://vaderai.ai/)
- [Project Aria — Meta](https://www.projectaria.com/) — research-grade companion-app + hardware-shipping pattern
- [Project Aria Research Kit](https://www.projectaria.com/research-kit/) — rolling application pattern
- [Aria Gen 1 FAQ](https://facebookresearch.github.io/projectaria_tools/docs/faq) — companion app on Android + iOS
- [AoE: Always-on Egocentric Human Video Collection for Embodied AI — arxiv](https://arxiv.org/html/2602.23893v1) — neck-mount + smartphone, <$20 assembly cost
- [Egocentric 4D Perception (EGO4D)](https://ego4d-data.org/) — academic recruitment, Zoom training, 2-week recording window
- [Ego4D paper](https://arxiv.org/abs/2110.07058) — 7 head-mounted cameras, 931 wearers, 9 countries
- [Egocentric Data Collection: The Future of Human-Centric AI Training — Macgence](https://macgence.com/blog/egocentric-data-collection/)

### Anti-fraud / QA patterns
- [Defend Your AI: Preventing Fraud In Crowdsourced Data — TELUS Digital](https://www.telusdigital.com/insights/data-and-ai/article/fraud-prevention-crowdsourcing) — defense-in-depth model, ID + biometric + IP + behavioral monitoring
- [Establishing Trust in Crowdsourced Data — arxiv 2511.03016](https://arxiv.org/html/2511.03016v1) — academic survey of trust techniques
- [Crowdsourcing — Wikipedia](https://en.wikipedia.org/wiki/Crowdsourcing) — definitions and patterns
- [Insights from a crowdsourcing data experiment — arxiv 2404.13172](https://arxiv.org/html/2404.13172) — transparency, money, data use as trust drivers
- [Mapping the Apps: Ethical and Legal Issues with Crowdsourced Smartphone Data — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11250705/) — privacy policy clarity ↔ trust correlation

### Worker-side reviews (negative pattern data)
- [Micro1 — Extremely Low Pay and No Transparency — Glassdoor](https://www.glassdoor.com/Reviews/Employee-Review-Micro1-E7558526-RVW97322306.htm) — pay opacity at the closest Homelander analogue
- [Micro1 — Personal data theft warning — Glassdoor](https://www.glassdoor.com/Reviews/Employee-Review-Micro1-E7558526-RVW96705264.htm) — privacy concerns
- [Micro1 — Sophisticated personal data gathering — Glassdoor](https://www.glassdoor.sg/Reviews/Employee-Review-Micro1-E7558526-RVW102438163.htm)
- [Micro1 Reviews (139)](https://www.glassdoor.com/Reviews/Micro1-Reviews-E7558526.htm)
- [Outlier AI Tier 1 Review: Waste of Time — Indeed](https://www.indeed.com/cmp/Outlier-Ai/reviews/waste-of-time?id=f25ffdee087c4235) — no feedback on rejections
- [Outlier AI Tasker Review: Not worth it — Indeed](https://www.indeed.com/cmp/Outlier-Ai/reviews/not-worth-it?id=e42e1765b0761821)
- [Working at Outlier AI — 747 Reviews — Indeed](https://www.indeed.com/cmp/Outlier-Ai/reviews?fcountry=ALL)
- [Outlier on Trustpilot (4/5)](https://www.trustpilot.com/review/outlier.ai)

### Industry / mobile-app-pattern best practices
- [Apps That Use Streaks: 10 Real Examples Analysed (2026) — Trophy.so](https://trophy.so/blog/streaks-feature-gamification-examples) — streak feature lift research
- [How Streaks Leverages Gamification to Boost Retention (2025) — Trophy.so](https://trophy.so/blog/streaks-gamification-case-study) — 5.69 vs 4.25 day average lift
- [Productivity App Gamification Examples (2026 Analysis) — Trophy.so](https://trophy.so/blog/productivity-gamification-examples)
- [Duolingo's Gamification Secrets — Orizon](https://www.orizon.co/blog/duolingos-gamification-secrets) — 60% engagement uplift via streaks + XP
- [Gamification in Mobile Apps — WildnetEdge](https://www.wildnetedge.com/blogs/gamification-in-mobile-apps) — daily quests +25% DAU, badges +30% completion
- [How to Gamify Your Mobile App — AGN](https://appguardians.com/blog/how-to-gamify-your-mobile-app-crush-retention-goals/)
- [Mobile App Feedback: The Complete Guide — Gleap](https://www.gleap.io/blog/mobile-app-feedback-guide) — in-app feedback as standard
- [In-App Feedback (Why & Tools 2026) — Survicate](https://survicate.com/blog/in-app-feedback/)
- [Mobile App Bug Reporting Best Practices — Luciq](https://www.luciq.ai/blog/mobile-app-bug-reporting-best-practices) — Instabug/Luciq SDK as the de-facto pattern
- [In-App Bug Reporting: The Complete Guide — Gleap](https://www.gleap.io/blog/in-app-bug-reporting-guide)
- [Forced Update of Mobile Apps — Adapptor](https://www.adapptor.com.au/blog/forced-update-of-mobile-apps) — recommended phased rollout (auto-update → recommended → forced)
- [How Changelog Versioning Works — AnnounceKit](https://announcekit.app/blog/changelog-versioning/) — version-display in app
- [Onboarding UX Patterns | Permission Priming — UserOnboard](https://www.useronboard.com/onboarding-ux-patterns/permission-priming/) — pre-camera permission priming pattern
- [Camera API — Android developers](https://developer.android.com/media/camera/camera-deprecated/camera-api) — manifest-only patterns

---

*Feature research for: Crowdsourced egocentric (head-mounted) video / audio / IMU data collection app for embodied-AI training, paid-per-task, India + Brazil, KGeN clan-chief distribution.*
*Researched: 2026-05-07*
