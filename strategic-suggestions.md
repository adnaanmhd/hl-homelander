# Strategic Suggestions (Parked — Not for MVP)

These are PM-level concerns surfaced during the holistic review of `idea-brief.md`. They are intentionally out of scope for the current MVP cut and are recorded here so they aren't lost.

---

## 1. Define MVP success metrics

We don't currently have quantitative targets for MVP. Without them, scope creep is hard to push back on and we can't tell whether the MVP "worked." Suggested baseline:

- **Acquisition:** install → first recording conversion rate
- **Activation:** % of new users who complete ≥ 1 QA-passing recording in week 1
- **Engagement:** weekly active recorders, average hours uploaded per WAR
- **Quality:** QA-pass rate (% of uploaded videos that pass automated QA when it ships)
- **Economics:** cost per QA-passing hour (compute + payout + ops)
- **Retention:** D1, D7, D28 retention of recorders
- **Funnel friction:** % failing device compatibility check, % failing Google sign-in

## 2. Payments and trust

"Payments coming soon" is the largest retention risk for an app whose entire value prop is paid recording. Recommended treatments (any subset):

- Show running earnings ledger from day 1 even before payouts go live ("Estimated earnings: ₹X — payout window opens [date]")
- Lock a published payout schedule before launch
- Use clan chiefs as the trust intermediary — pilot payouts to chiefs first; word-of-mouth carries the rest

## 3. Anti-fraud strategy

Paying per accepted minute creates an adversary. Realistic abuse vectors to plan for: same task recorded 20×, two phones recording the same TV/YouTube video, AI-generated frames, looped clips, account farms run by a single operator, family of 6 sharing one account.

Defenses to consider in a v2:

- Play Integrity API / App Attest (device + app attestation)
- One-account-per-device binding with explicit unbind
- Server-side perceptual-hash check across all uploads (catches duplicates and screen-recordings of media)
- Required randomized in-frame gesture per recording (lightweight liveness)
- Server-side rate-limits per user / per clan / per IP

## 4. Bystander consent (legal blocker for v2)

The current consent text makes the _uploader_ attest that bystanders consented. That punts liability and is fragile under DPDP/LGPD/GDPR. Eventually we will need:

- An in-app secondary-subject consent screen (subject confirms before recording starts)
- Or a printed/digital waiver flow with photo of signature attached to the recording
- Explicit minors policy (currently: minors not permitted; enforced via Terms only)

## 5. Retention loop

The app today is a flat tool. Long-term retention for crowdsourced data work needs:

- Daily / weekly streaks
- Clan leaderboards (the clan chief structure is already there — surface it)
- Milestone celebrations (first hour, 10 hours, etc.)
- Daily quests / weekly themes

## 6. Clan structure visibility

The acquisition model is hierarchical (clan chief → clan members → secondary recorders) but the app is single-user-flat. Surfacing clan identity, chief, and clan-level stats unlocks both retention and the natural referral path.

## 7. Referral / invite mechanic

K-Quests is the primary distribution channel; in-app referrals (chief → member, member → member) would compound that. Out of scope for MVP.

## 8. Localization

Target geos cover Hindi/Tamil/Telugu/Bengali/Marathi (India), Portuguese (Brazil), Spanish (LATAM). MVP is English-only by decision; flag for v2.

## 9. Data-cost & network policy

Most target users are on metered cellular data. A 20-minute 1080p30 8 Mbps recording is ~1.2 GB. MVP allows cellular uploads with no Wi-Fi-only toggle and no monthly data ceiling. Worth revisiting once we see real upload volumes.

## 10. Competitive benchmarking

Worth looking at Sapien, Scale Donovan, Surge, and academic Ego4D contributor flows for prior art on egocentric data-collection UX before we ship v2.

## 11. Brand narrative around the work itself

Contributors are literally training the AI/robotics that will eventually replace human labor. There is a real ethical narrative ("you are building the future workforce, and getting paid to") that the current brand-line ("Better intelligence for a better world") does not own. Explore claiming it explicitly.
