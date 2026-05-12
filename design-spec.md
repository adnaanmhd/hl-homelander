# Humyn Labs — Design Spec

**Source of truth:** `prototype.html`
**Form factor:** iOS/Android phone, portrait-locked except recording screen (landscape-locked)
**Frame:** 390 × 844 (iPhone 14 baseline). Top safe area = 36 px (notch). Bottom nav = 68 px.

This document is screen-by-screen, every state explicitly enumerated. Copy is quoted verbatim from the prototype. Tokens (colors, typography, spacing) are summarised once at the top — referenced by name throughout.

---

## 0. Foundations

### 0.1 Color tokens

| Token           | Hex       | Use                                        |
| --------------- | --------- | ------------------------------------------ |
| `--bg`          | `#FAF7F2` | App background (warm off-white)            |
| `--surface`     | `#FFFFFF` | Cards, sheets, modals                      |
| `--text`        | `#1A1A1A` | Primary text                               |
| `--text-2`      | `#6B6B6B` | Secondary text, labels                     |
| `--text-3`      | `#9A9590` | Tertiary, placeholder, disabled            |
| `--line`        | `#E8E5E0` | Borders, dividers                          |
| `--accent`      | `#FF6A2D` | Primary CTA, active states, highlights     |
| `--accent-soft` | `#FFE6D8` | Accent backgrounds (chips, icon wells)     |
| `--coral`       | `#E84A38` | Record button, destructive actions         |
| `--success`     | `#2EB872` | Pass states, success badges                |
| `--amber`       | `#F2A53C` | In-progress, warnings (battery alert pill) |
| `--info`        | `#2D7CFF` | Informational                              |
| `--info-soft`   | `#E5EEFF` | Info backgrounds                           |

Status chip swatches:

- `chip-success` — bg `#DEF7E5`, text `#1F7A3A`
- `chip-progress` — bg `#FFF4E5`, text `#8C5A1A`
- `chip-failed` — bg `#FFE3DD`, text `#B5331E`

Banner (warning):

- bg `#FFF4E5`, border `#FFD9A8`, text `#8C5A1A`

Recording surface (dark theme):

- Screen bg `#0A0A0A`
- Preview gradient `linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 100%)`
- Overlay tip bg `rgba(0,0,0,.6)` with 8 px blur
- Toast bg `rgba(26,26,26,.94)`

### 0.2 Typography

Font: **Rethink Sans** (400/500/600/700/800). Mono fallback: SF Mono / Menlo.

| Style                    | Size / line      | Weight  | Tracking           |
| ------------------------ | ---------------- | ------- | ------------------ |
| Display (hero number)    | 46 / 46 (mono)   | 700     | -1.5 px            |
| Lifetime number          | 44 / 44 (mono)   | 700     | -1 px              |
| Tile number              | 28 / 28 (mono)   | 700     | -0.8 px            |
| Title (28)               | 28 / 34          | 700     | -0.4 px            |
| Tutorial heading         | 30 / 36          | 700     | -0.5 px            |
| Sheet title              | 24 / 28          | 700     | -0.3 px            |
| Pitch headline           | 24 / 32          | 700     | -0.4 px            |
| Compat title             | 20 / 24          | 700     | normal             |
| First-title (hero)       | 24 / 28          | 700     | -0.3 px            |
| Body Lg                  | 18 / 26          | 400     | normal             |
| Profile name / earnings  | 17–18 / 24       | 600–700 | -0.2 px            |
| Body                     | 16 / 24          | 400     | normal             |
| Btn label                | 16 / 20          | 600     | normal             |
| Tut body                 | 17 / 25          | 400     | normal             |
| Sheet desc               | 16 / 24          | 400     | normal             |
| List item                | 15 / 20          | 500     | normal             |
| Task card name           | 15 / 19          | 600     | normal             |
| Caption / cap            | 13 / 18          | 400     | normal             |
| Pill label               | 14 / 18          | 500     | normal             |
| Section header (eyebrow) | 12 / 16          | 600     | +0.8 px, UPPERCASE |
| Form label               | 11 / 14          | 600     | +0.6 px, UPPERCASE |
| Coming-soon badge        | 10 / 14          | 700     | +0.6 px, UPPERCASE |
| Tab label (bottom nav)   | 11 / 14          | 500     | normal             |
| Mono numeric (timer)     | 32 / 32          | 600     | +1 px              |
| Countdown number         | 200 / 200 (mono) | 900     | normal             |

### 0.3 Spacing & radii

Spacing scale (px): 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 48.
Screen edge gutter: **20 px** (24–28 px on auth/tutorial screens, 22 px on dark recording screen).

Radii: tile/card 18, sheet top 24, modal 20, button 14, pill 999, input 12–14, chip 6–999.

Shadow (cards): `0 8px 28px rgba(0,0,0,.08)`. Phone bezel shadow only used in prototype frame (not on real device).

### 0.4 Motion

| Curve / animation             | Duration                                                                                      | Use                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `cubic-bezier(.2,.8,.2,1)`    | 250–700 ms                                                                                    | Sheet slide, scale-pop badges/icons                                   |
| `fadeIn` (linear opacity)     | 200–250 ms                                                                                    | Screen enter, scrim, voice cue                                        |
| `slideUp` (40 px)             | 250–300 ms                                                                                    | Toasts, alert pills                                                   |
| `scalePop` (0.6 → 1.06 → 1)   | 250–700 ms                                                                                    | Logo, success badge, countdown digit                                  |
| `rotatePhone`                 | 2.8 s loop                                                                                    | Rotate-to-landscape illustration                                      |
| `confetti-rise`               | 800–1200 ms (per particle)                                                                    | Practice-done celebration                                             |
| `pulse`                       | 1 s loop                                                                                      | In-progress compat indicator                                          |
| Active button press           | 80 ms                                                                                         | `transform: scale(.98)` on `:active` (taps), `.94` on rec button/stop |
| Bottom sheet open/close       | 320 ms                                                                                        | `translateY(100%) ↔ 0`                                               |
| Contribution counter ease     | 1200 ms                                                                                       | Number animation on home/profile                                      |
| Compat ring stroke            | 350 ms ease                                                                                   | Per-step ring update                                                  |
| Hand-gate ring fill           | `stroke-dashoffset` 350 ms ease per detection-success increment; instant snap to 0 on a reset | Recording → hand-detection gate (§7c)                                 |
| Hand-gate pass haptic         | 80 ms                                                                                         | When the ring completes via detection (not on Skip)                   |
| Practice-done vibrate pattern | `[40, 80, 40]` ms                                                                             | On celebration                                                        |
| Thermal kill vibrate          | 800 ms continuous                                                                             | On thermal alert                                                      |
| Battery alert vibrate         | `[100, 50, 100]` ms                                                                           | On battery warning                                                    |

### 0.5 Universal components

- **Top bar** (48 px min-height): logo or back-arrow on left, title centred (when present), avatar / spacer on right.
- **Bottom nav** (68 px, 10 px bottom inset, blurred white `rgba(255,255,255,.92)` + 12 px backdrop blur, 1 px top border). Three tabs: Home / Tasks / History. Active tab uses `--accent` and FILL=1 icon variant.
- **Avatar** (36 px circle, gradient `#FFC09F → #FF6A2D`, white bold initial). Tap → Profile.
- **Icons:**
  - **System UI icons** (camera, mic, home, history, chevrons, close, etc.) — Material Symbols Outlined, weight 300, 24 px optical size, FILL=0 by default and FILL=1 only on the active bottom-nav tab.
  - **Task icons** — lucide-react, mapped 1:1 to each of the 65 tasks in `task-taxonomy.md`. Source of truth: `design-system/task-icons/`. Render via `<TaskIcon task={slug} />`. Default size 28 px on task cards, 32–40 px on detail sheets, stroke 1.75–2, colour `--accent` on light surfaces / white on the dark recording surface. See the icon package README for the full mapping.
- **Buttons:**
  - `btn-primary` — fill `--text`, white label
  - `btn-accent` — fill `--accent`, white label (always the "go-do-the-recording" CTA)
  - `btn-outline` — transparent, 1.5 px `--line` border, primary text
  - `btn-coral` — fill `--coral`, white label (only used inside modals as destructive)
  - All buttons are 14 px radius, 16 px font, 600 weight, 16/20 px vertical padding, 100 % width by default. Disabled = `opacity: .4`, no pointer events.
- **Sheet** (bottom-up): grab handle 40×4 px at top, scrollable `body-inner`, sticky `stick` footer with primary action. Close: tap scrim (when no form active) OR drag down OR tap explicit Cancel.
- **Modal** (centered): 84 % width, 20 px radius, padded 24 px, max-height 70 % of viewport with internal scroll. Action row is horizontal, 10 px gap, smaller buttons (12–14 px padding, 14 px font).
- **Toast** (recording surface): bottom 96 px, 14 px radius, dark fill, white centre-aligned text, slides up, 2 s default visible duration.

---

## 1. Splash

**ID:** `#splash` · **Background:** `--bg` · **Padding:** none, content centered.

**Content:**

- Humyn Labs logo (animated `scalePop` 700 ms on mount).
- Tagline (fades in at 400 ms): **"Real Humyns."** then accent-coloured **"Real Intelligence."**

**States:**

1. **Default (only state).** Auto-advances to Sign-up after **2400 ms**.

**Transitions:** Fade-out (handled by `goTo` → fade in next screen).

---

## 2. Sign-up

**ID:** `#signup` · **Padding:** 60/28/32 px.

**Layout:** flex column. Top block (logo, tagline, pitch). Spacer. Bottom block (Google CTA, consent, links).

**Content (top → bottom):**

- Large Humyn Labs logo
- Tagline (13 px, secondary): **"Real Humyns. Real Intelligence."**
- Pitch (24 / 32, 700, centered):
  > **Record real moments.** > **Train real intelligence.** > <span style="color:--accent">**Get paid**</span>
- Bottom block:
  - **Google sign-in button** — white fill, 1.5 px `--line` border, dark text. 22×22 gradient G icon (Google brand colors).
    - Label: **"Continue with Google"**
  - Consent row — 16 px checkbox (`--accent` accent-color), 13 px text:
    > "I have read and agree to the [Terms of Use](#)"
  - Default: checkbox **checked**.

**States:**

1. **Default** — consent checked, button enabled.
2. **Consent unchecked** — tapping button shows alert "Please accept the Terms of Use to continue."; no nav.
3. **Auth in progress** — 600 ms delay after tap before navigating to Permissions. (Recommend a transient spinner inside the button during this window.)
4. **Terms-of-use modal open** — see §18.1.

**Transitions:** On valid tap → 600 ms delay → fade to Permissions.

---

## 3. Permissions

**ID:** `#permissions` · **Padding:** 48/28/32 px · **Layout:** vertically centred icon + heading + body, sticky button at bottom.

**Components:**

- Icon well: 96×96, 28 px radius, fill `--accent-soft`, 44 px `--accent` Material icon. Animated `scalePop` 400 ms on mount.
- Title (28 / 34, 700, centered, max-width 280 px).
- Body (16 / 24, secondary, centered, 16 px horizontal pad).
- Action row: full-width primary button.

**State machine** (`permStep`):

### 3a. Camera & Mic (default)

- Icon: `photo_camera`
- Title: **"Camera & Mic\nPermissions"**
- Body: **"Used only while you hit record. Nothing leaves your phone until you stop and we encrypt-upload."**
- Button: **"Allow access"**

### 3b. Location (variant — currently unreachable in main flow but designed)

- Icon: `location_on`
- Title: **"Tag where you recorded"**
- Body: **"Coarse only — neighbourhood-level, never your exact spot. Helps us understand the diversity of recordings."**
- Button: **"Allow access"**

**Edge states (recommended for production, not in prototype):**

- **Permission denied** — copy variant: **"You'll need to enable Camera & Mic in Settings to record."** Button label changes to **"Open Settings"**, secondary link **"Skip for now"**.
- **Partial grant (camera only / mic only)** — same denied state with body specifying which is missing.

**Transitions:** Tap → 20 ms haptic → 350 ms delay → Compat screen and `runCompat()` fires.

---

## 4. Compatibility check

**ID:** `#compat` · **Padding:** 56/28/24 px.

**Components:**

- 130×130 progress ring (SVG, stroke 8, `--line` track, `--accent` fill, line-cap round). Numeric percentage centered (24 px mono, 700).
- Title (20 / 24, 700, centered) + sub (13 px secondary).
- Checks list (7 items, 10 px gap):
  - Each row: 22 px round indicator + label (14 px). States: pending (`○` on `#F0ECE7`), running (`⋯` on `--amber` with pulse loop), pass (`✓` on `--success`), fail (`✕` on `--coral`).
- Action row (sticky bottom, hidden until run completes).

**Checks (in order, each ~700 ms):**

1. Ultrawide camera
2. 1080p @ 30 FPS
3. Motion sensors
4. Stable sensor stream
5. Microphone _(informational only since 2026-05-11 — capture audio dropped per `idea-brief.md` banner; probe retained for future re-enable)_
6. Time sync source
7. Device integrity

**States:**

### 4a. Initial

- Title **"Checking your phone"**, sub **"Takes around 30 secs"**.
- Ring at 0 %.
- All checks pending.
- Action button hidden.

### 4b. Running (during ~4.9 s sequence)

- One row at a time becomes "running" (amber, pulse), then "pass" (green).
- Ring fills proportionally; numeric percent updates from 0 → 100.

### 4c. Pass

- Title **"You're in."**, sub **"All checks passed."**
- All rows green, ring full at 100 %.
- 40 ms haptic.
- Action **"Next"** appears (slides/fades in). Tap → Tutorial: Rig.

### 4d. Fail (currently shown via dev jump `failCompat`)

- 4 checks pass (ultrawide, res, motion, mic).
- 1 fails (imu): row shows `✕`, coral.
- 2 pass (clock, root).
- Title: **"This phone can't record yet"**.
- Sub: **"Stable motion sensors at 100 Hz+ required (yours: 44 Hz)"**.
- Action **"Next"** still rendered. **Recommended for production:** swap to a fail-specific CTA — e.g. **"Continue on supported phone later"** (returns to a holding screen) and/or **"Retry"**.

**Edge states (production):**

- **Re-run** — if user backgrounds and returns, re-trigger `runCompat()` rather than persist.
- **No internet** — needed for time sync and root checks; show a "Retry" affordance.

---

## 5. Tutorial — Rig (`#tut-rig`)

**Padding:** 24/28/28. Content stacks: illustration (280 px high), centered text block, sticky button.

- Heading (30 / 36, 700): **"You'll need a head rig"**
- Body (17 / 25): **"Mount your phone on the head rig and make sure it is steady while recording."**
- Button (`btn-primary`): **"Next"** → tutorial-practice.

**States:** static (1 state). No empty/error variants.

---

## 6. Tutorial — Practice intro (`#tut-practice`)

Same layout as Rig.

- Heading: **"One quick try"**
- Body: **"We'll walk you through one short recording — 60 seconds, just to get the feel."**
- Body muted (14 / 20, secondary): **"This is a practice task — it does not count towards your contribution."**
- Button (`btn-accent`): **"Start practice"** → kicks off `startRecording('Practice — 60 sec', isPractice=true)` which routes through the Recording surface in practice mode.

> **OWNER DEVIATION (2026-05-12, commit `eaaa1fe`):** as shipped, the body is shortened to **"We'll walk you through one short recording — 60 secs, to get the feel"** and the muted line **"This is a practice task — it does not count towards your contribution."** is removed. (`PracticeIntroScreen` / `04-UI-SPEC.md § Copywriting` reflect the shipped copy.)

> **OWNER DEVIATION (2026-05-12):** `RigTutorialScreen.tsx` adds a one-line camera-framing tip to its otherwise-verbatim §5 Rig copy (a practical "frame yourself in the preview" hint for the head-rig setup).

**States:** static.

---

## 7. Recording surface

**ID:** `#rec` (rendered above the rest of the app, dark `#0A0A0A`, fills the full viewport, `z-index 130`).
**Padding:** 36/22 top, 22 px sides, 24 px bottom. Status bar text white.

This is a **multi-state surface** — substates render in `#rec-mid` (the centered overlay region inside the preview frame). The preview frame itself is the live camera feed; in the prototype it's a dark gradient placeholder.

**Persistent chrome (visible across all substates):**

- Top minute-bar (3 px, full-width, fills `--accent`).
- Top row: 36 px circular X (close), task name (14 px, 600), 36 px right spacer.
- Overlay tip (top-anchored, 88 px from top): rounded rect, dark blur bg, 13 px white text, **"Don't exit while recording."** Auto-fades after 3 s.
- Preview frame (rounded 18 px, dimmed via 40 % black overlay).
- Bottom area: stop button (when active).

### 7a. Substate — Rotate prompt

- Animated phone-rotate SVG (loop 2.8 s).
- Label: **"Rotate to landscape and mount on rig"**
- Pretend-button (orange pill, 12 px, 600): **"Pretend I rotated →"** (debug affordance — should be hidden in prod once orientation listener is hooked up).
- No record button visible yet.

### 7b. Substate — Ready (record button)

- Centered:
  - **88×88 record button**: `--coral` fill, 5 px white border, circular.
  - Label below: **"Start Recording"** (white, 14 px, 600).

### 7c. Substate — Hand-detection gate

Replaces the prior 5-sec countdown. On tap of the rec button the surface enters the gate state; recording does not begin until the gate passes (or is skipped).

- **Layout** (centered stack, 18 px gap between items, pointer-events on):
  - Custom progress ring, 130×130 px, 6 px stroke. Track `rgba(255,255,255,.18)`, fill `--accent`, line-cap round, **clockwise** fill from 0 → 100 % via `stroke-dashoffset`. Center icon: Material Symbols `front_hand`, 44 px, `rgba(255,255,255,.85)`.
  - Prompt: 17 / 24, 500, white 95 %, max-width 280 px, centered. Copy: **"Mount the phone on your head and bring your hands in frame for 2 secs"**.
  - Skip link: 14 / 600, `rgba(255,255,255,.7)`, padding 8/16 px, no border. Visible from second 0. `:active` opacity .5.
- **Loading state** (camera not ready yet) — replace the ring contents with a spinner; caption directly below the ring reads **"Preparing camera…"** (13 px, 70 % white). Skip stays visible. The accumulation counter does not start until the first frame is available.
- **Detection signalling** — the ring fills clockwise as consecutive 2-hand detections accumulate. Each successful detection bumps progress to `hits / target`; any non-2-hand result snaps the ring back to 0 instantly (no animation on the reset). No on-screen counter, beeps, or per-tick haptics.
- **No timer, no countdown numerals, no per-tick beep.**
- **No timeout, no auto-cancel.** The gate persists until either pass or skip.
- **Pass:** ring full → 80 ms vibrate → voice cue **"Recording started."** (TTS, see §0.4 / §20) → screen brightness drops to **5 % of max** → transition to §7d.
- **Skip:** transition to §7d silently — no voice cue, no haptic. Brightness still drops to 5 %.
- **Silent bypass** (native module unavailable): same as Skip — no voice cue, no haptic, brightness drops, jump straight to §7d.
- **Exit during gate** (X tap): silent dismiss to Home — no confirmation modal (treated as pre-record exit; no captured data exists yet).
- **Scope:** runs once per recording session. Auto-segment cuts at 10 min do **not** re-run the gate; only a fresh tap of the record button (after stop / re-entry) does.
- **Implementation reference:** the JS layer polls `Camera.takePhoto()` every ~400 ms (Android) / ~600 ms (iOS) and calls a custom native `HandDetector.detectHands(path)` module that runs MediaPipe HandLandmarker (`hand_landmarker.task`, IMAGE mode, `numHands=2`, all confidences 0.5) and returns the hand count. Pass = N consecutive `count === 2` results — N tuned per platform to ≈ 2 sec wall clock (5 on Android, 3 on iOS). See `figure-app-hands.md` for the reference integration.

### 7d. Substate — Active recording

- Entered from §7c (gate pass / skip / silent bypass). On entry the screen brightness is already at **5 % of max** (set during the §7c → §7d transition).
- 32 px mono timer top-anchored at 84 px (HH:MM:SS, updates every 250 ms).
- Minute-bar fills 0 → 100 % over the cap (60 s practice / 1200 s real); resets and loops past full minute for real recordings.
- Stop button visible at bottom: 64×64 white circle with 22×22 coral square inside.
- Voice cue overlay (240 px wide white pill, centered) shows "Recording started" for 1.8 s on entry **only when entering via gate-pass** — suppressed on Skip and on silent bypass.

### 7e. Substate — Battery alert (P2, demo)

Layered overlay during active recording.

- **Alert pill** top-right (38 px from top, 14 px right): amber fill, white text + battery_2_bar icon, 12 px label **"Battery 15%"**.
- 520 Hz beep (200 ms), `[100, 50, 100]` ms vibrate pattern, voice "Battery low. Consider charging soon."
- Recording continues; user must decide whether to stop.

### 7f. Substate — Thermal kill (P1, demo)

- Alert pill top-right: amber fill, **"Phone too hot"** + device_thermostat icon.
- Three-note tone descending (440 / 560 / 680 Hz, 180–220 ms each).
- 800 ms continuous vibrate.
- Voice + speech: **"Phone too hot, stopping recording"**.
- After **2500 ms** auto-stop fires `onStop()`.
- Toast on return: **"Recording stopped — phone needs to cool."**

### 7g. Substate — Stop confirmation modal

Triggered when user taps X during active recording.

- Modal title: **"Stop recording?"** (recommended; not in prototype copy — define in prod)
- Body: **"Recordings under 1 minute are discarded."**
- Actions: **"Keep recording"** (outline) and **"Stop"** (`btn-coral`).

### 7h. Substate — Post-stop toasts

After `onStop()`:

- **Practice mode** → no toast; navigates to Practice-done screen.
- **Real mode, < 60 s** → toast **"Recording too short — discarded."**, returns to Ready substate.
- **Real mode, ≥ 60 s** → toast **"{Hh Mm} added to your contribution."** (e.g., "11m added to your contribution."), updates `contrib`, returns to Home.

**Edge states (production):**

- **Storage full** — pre-record check; show modal **"Not enough storage to record"** with link to clear space.
- **Permission revoked mid-session** — re-prompt with permission screen overlay.
- **Background interrupt (call, etc.)** — auto-pause, voice "Recording paused", show resume modal on return.

---

## 8. Practice complete

**ID:** `#practice-done` · **Background:** `--bg` · **Padding:** 48/32 · **Justified center**.

- 96×96 success badge (circle, `--success` fill, 56 px white check, scale-pop 500 ms).
- Confetti burst — 18 particles radiating from badge centre, random hues from accent palette, 800–1200 ms rise + rotate animation.
- Heading (28 / 34, 700, centered): **"You got it."** _(Note: prototype heading text wasn't fully captured — confirm exact copy with PM. Suggested: "You got it." or "Practice complete.")_
- Vibrate pattern `[40, 80, 40]` on enter.
- Sticky action button (`btn-primary`): **"Continue"** → Home (first-time hero).

**States:** static success.

---

## 9. Home

**ID:** `#home` · **Top bar:** logo on left, avatar on right · **Bottom nav** present, "Home" tab active · **Content padding:** 0/20/88, vertical 18 px gap, scrollable.

The hero block has **two variants** controlled by `setHomeState(returning)`.

### 9a. First-time (empty) state

- Hero (dark gradient `#1A1A1A → #2A2A2A`, white text, 22 px padding, 24 px radius):
  - Eyebrow (13 px, 65 % white): **"Get started"**
  - Title (24 / 28, 700): **"Record your first task"**
  - Sub (13 px, 65 %): **"Pick a task and start recording"**
  - CTA pill (`--accent` fill, 12 px radius, 14 px padding, 15 / 600): **"Start Recording"** → Tasks.
- Section header (12 px, +0.8 px tracking, UPPERCASE): **"Your contribution"**
- Tile pair (2-column grid, 12 px gap):
  - Tile 1: numeric `0s`, label **"today ▾"** (filter dropdown).
  - Tile 2: numeric `0`, label **"today ▾"**.
- Empty tip (13 px, secondary): **"Your hours and tasks will track here as you record."**
- Pending uploads block: **hidden**.

### 9b. Returning state

- Hero swaps:
  - Eyebrow: **"Continue contributing"**
  - Lifetime numeric (46 / 46, mono, 700, white): e.g. **"2h 46m"**
  - Sub: **"Across 14 tasks"** (count is dynamic).
  - CTA: **"Start Recording"**.
- Tiles reflect real numbers from `contrib`; default filter is "today" (e.g., `47m` and `3`).
- Empty tip: **hidden**.
- Pending uploads block: **visible**.
  - Section header: **"Pending uploads"**
  - Card (white, 1 px line, 18 px radius, 14 px padding): 36 px gradient thumbnail + name **"Make tea — 11m"** + status **"Uploading… 47%"**.

### 9c. Tile filter sheet (opened from any tile)

See §16. Selecting a value updates the tile label (`today` / `yesterday` / `this week` / `this month` / `all time` / `custom range`) and re-aggregates the numeric.

**Cold-boot rule (returning state):** if `contrib.totalS === 0`, seed with `2h 46m` lifetime, `14` tasks, `47m`/`3` today. Animate counters from previous value over 1200 ms with easing on entry.

**States summary:**

1. First-time empty.
2. Returning with metrics.
3. Returning with no upload pending (pending block hidden).
4. Returning during contribution counter animation (transient).
5. Filter sheet open over Home.

---

## 10. Tasks

**ID:** `#tasks` · **Top bar:** logo + avatar · **Bottom nav** with "Tasks" active.

**Canonical task list:** the screen renders all **65 tasks** from `task-taxonomy.md`, grouped under **10 categories**. The prototype's 5-pill / 6-card simplification is a stub — replace with the full taxonomy. Icons come from `design-system/task-icons/` (lucide-react via `<TaskIcon task={slug} />`).

**Layout (top to bottom):**

- Pills row (horizontally scrollable, 8 px gap, 20 px gutter, 9/16 px pill padding, 999 px radius, 14 px label, 1.5 px `--line` border, transparent fill; active pill is filled `--text`/white).
  - Pills (in this order): **All** (default active), **Cooking**, **Dishwashing**, **Kitchen**, **Cleaning**, **Tidying**, **Laundry**, **Gardening**, **Pet Care**, **Home Maintenance**, **Hobby**.
  - Pills row scrolls horizontally; first pill should be flush-left at rest, with a subtle gradient fade on the right edge to hint at overflow.
- Search input (14 px font, 14 px radius, 12/14 px padding, 44 px left for icon). Placeholder: **"Search tasks…"**. Focus ring = `--accent` border. Search matches against task name, description, and category (lower-case, case-insensitive).
- Optional setting filter (recommended addition) — secondary control to filter by **Indoor / Outdoor**, since the taxonomy carries this metadata. Could be a second pill row or a toggle above the grid. Defer if not in v1.
- Task grid (2 cols, 12 px gap, scrollable):
  - Card (white surface, 18 px radius, 16 px padding, aspect 1 : 1.05):
    - Top: 28 px lucide icon (`<TaskIcon task={id} size={28} strokeWidth={1.75} />`), colour `--accent`.
    - Name (15 / 19, 600) — verbatim from taxonomy. Wraps to 2 lines max; truncate with ellipsis on overflow.
    - Category eyebrow (11 px UPPERCASE +0.6 px, secondary).
    - Description (12 / 16, secondary, 2 lines max with ellipsis).
- Footer (centered, 14 px padding, 1 px top border, 13 px secondary):
  - **"Can't find a task? [Send request →](#)"** — accent link opens Send Request sheet.

**Categories at a glance** (full list of 65 tasks lives in `design-system/task-icons/README.md`):

| Category         | Count | Icon examples                                 |
| ---------------- | ----- | --------------------------------------------- |
| Cooking          | 9     | ChefHat, Carrot, Slice, Croissant             |
| Dishwashing      | 2     | Droplets, Sparkles                            |
| Kitchen          | 6     | Boxes, Utensils, Refrigerator, ShoppingBasket |
| Cleaning         | 12    | BrushCleaning, SprayCan, Bath, Trash, Leaf    |
| Tidying          | 4     | NotebookPen, Shirt, Sofa, Bed                 |
| Laundry          | 8     | WashingMachine, Sun, Layers, Flame            |
| Gardening        | 8     | CloudRain, Sprout, Tractor, Apple             |
| Pet Care         | 7     | Bone, Cat, PawPrint, Dog                      |
| Home Maintenance | 5     | Wrench, Hammer, PaintBucket, Car              |
| Hobby            | 4     | Scissors, Pin, Spline, Gift                   |

**States:**

1. **Default** — `All` pill active, no query, all 65 cards rendered (lazy / windowed if needed for perf).
2. **Pill filtered** — only matching cards shown; non-matches hidden via `display:none`.
3. **Searching** — non-matches hidden; combines AND-style with active pill.
4. **No results** — _not in prototype_. **Recommended:** show empty state — small lucide illustration (e.g. `SearchX`) + 14 px secondary line **"No tasks match. Try clearing filters or [send a request](#)."**
5. **Card pressed** — scale to .97, border colour shifts to `--accent`.
6. **Sheet open** — see §11.

**Discrepancy with prototype — flag for product:**

- Prototype pills (5): Cooking / Cleaning / Laundry / Self-care / Outdoor.
- Taxonomy pills (10): see list above.
- The taxonomy has **no Self-care category**, and the prototype's `Brush teeth` example task isn't in the taxonomy. Decide before Figma handoff: (a) add Self-care to the taxonomy and define its tasks, (b) drop Self-care from the pills, or (c) keep both lists and accept that prototype copy was illustrative.
- "Outdoor" in the prototype is a **setting** (indoor/outdoor) in the taxonomy, not a category. Recommend not surfacing it as a pill at all and instead exposing it via a dedicated toggle (see "Optional setting filter" above).

---

## 11. Task details sheet

Triggered from any task card. Bottom sheet, 88 % max-height, scrollable.

**Content:**

- 40×4 grab handle.
- 40 px lucide task icon (`<TaskIcon task={id} size={40} strokeWidth={1.75} />`) inside a 64 px `--accent-soft` rounded square (18 px radius). Anchors the sheet visually to the same icon shown on the card.
- Category chip (pill, `--accent-soft` bg, `--accent` text, 11 px UPPERCASE +0.4 px tracking) — taxonomy category name.
- Setting chip (only if outdoor) — secondary tone, label **"Outdoor"**, indicates daylight requirement.
- Task name (24 / 28, 700, -0.3 px tracking) — verbatim from taxonomy.
- Description (16 / 24, secondary) — verbatim from taxonomy.
- **Universal rules block** (rendered above per-task instructions on every task-details sheet — sourced from the header of `task-taxonomy.md`). Flat list, no nested cards:
  - Container: warm tint `#FFF7F0`, 16 px radius, 16/16 padding, vertical stack with 14 px gap between header and rules list, 12 px gap between rule rows.
  - Eyebrow (11 px UPPERCASE +0.8 px tracking, `--accent`): **"Always"**.
  - Four rules at **equal visual weight** — each row is `[icon-well] + [label]`, 12 px gap, vertically centred:
    - **Icon well:** 32 px circle, `--surface` (white) fill, soft elevation `0 1px 2px rgba(0,0,0,.04)`, 18 px Material icon in `--accent`.
    - **Label:** 14 / 20, weight 500, primary text colour.
  - Rules in order (icon → label):
    - `front_hand` → **"Keep your hands in frame"**
    - `videocam` → **"Mount the device firmly on the rig"**
    - `lightbulb` → **"Make sure your space is well-lit"**
    - `apps` → **"Close all other apps before you start"**
- "For this task" eyebrow (11 px UPPERCASE +0.8 px).
- Bulleted list (15 / 22) — **per-task instructions from `task-taxonomy.md`**. Max **3 bullets**, all task-specific (gaze direction, pacing/motion pattern, optional task-shape detail). The hands-in-frame rule is **not** repeated here — it lives only in the universal block above. Render as a `<ul>` with the lucide `Check` glyph as the bullet; uniform 400 weight (no first-child emphasis).
- **Removed:** the warning callout `"It's recommended to close all other apps before you start."` is gone — that rule is now a first-class line in the universal block. `Callout.Warn` no longer renders on this surface.
- Sticky footer with `btn-accent`: **"Start Recording"**.

**States:**

1. Default open.
2. Closing (animates back down 320 ms, scrim fades 200 ms).
3. Scrim tap closes (no form fields → safe to dismiss).

**Transition out:** Tap "Start Recording" → 200 ms close delay → recording surface (real mode).

---

## 12. Send task request sheet

Triggered from Tasks footer link.

**Content:**

- Title (24 / 28, 700): **"Request a task"**
- Body (16 / 24, secondary): **"Tell us what you'd like to record. Our team reviews requests regularly."**
- **Form fields** (each: 11 px UPPERCASE label + input):
  1. **Task name** — text input, max 80, placeholder **"e.g. Iron clothes"**
  2. **Description** — textarea (3 rows), max 240, placeholder **"A few words on what the task involves."**
  3. **Category** — select: Cooking / Cleaning / Laundry / Self-care / Outdoor / Other.
  4. **Setting** — segmented control [Indoor (active default), Outdoor]. Active uses `--text` fill, white label.
  5. **Sample video (optional)** — dashed-border upload button, **"Choose video (30s max)"** with upload icon.
- Sticky footer `btn-accent`: **"Send request"**.

**States:**

1. Default empty.
2. Field filled / valid.
3. Validation error — _not in prototype_. **Recommended:** require Task name (min 3 chars) and Description (min 10 chars). Inline error in coral 13 px below the field.
4. Submitting — _not in prototype_. **Recommended:** spinner inside CTA, disabled until response.
5. Submission success — _not in prototype_. **Recommended:** swap sheet content to confirmation: **"Request sent. We'll review and add it to your list."** with **Done** button.
6. Submission error — recommended: inline banner **"Couldn't send. Try again."** with retry.

**Transition:** Tap **"Send request"** in current prototype → silent close. Production should hit a real endpoint (see Engineering Handoff).

---

## 13. History

**ID:** `#history` · **Top bar:** logo + avatar · **Bottom nav** "History" active.

**Layout:**

- Filter chip (top, self-aligned start, 8/14 px padding, white surface, 1 px `--line` border, 999 px radius). Default label: **"All time ▾"**.
- Scrollable list (20 px gutter, 14 px gap):
  - **Day group header** (12 px UPPERCASE +0.8 px secondary): e.g., **"Today"**, **"Yesterday"**, **"This week"**, **"May 2026"**.
  - **Row** (white surface, 1 px `--line`, 16 px radius, 14 px padding, 14 px gap):
    - 64×64 thumbnail (12 px radius, gradient or video frame).
    - Info: name (15 / 600), meta (12 px secondary) — e.g. **"11m · May 6, 2026 · 15:49"**, status chip.
    - Status chip variants: `chip-success` "✓ Uploaded", `chip-progress` "Uploading…", `chip-failed` "Upload failed".

**States:**

1. **Default — All time** — full list, day-grouped.
2. **Filter applied** — see §16 for sheet. Filter chip label updates ("Today", "This week", custom range "Apr 30 – May 6").
3. **Empty (no recordings yet)** — _not in prototype_. **Recommended:** centered illustration + body **"You haven't recorded anything yet. [Pick a task](#) and try one."**
4. **Empty (filter has no results)** — **"No recordings in this range. [Show all time](#)."**
5. **Row pressed** — scale .97, opens Player.

---

## 14. Player

**ID:** `#player` · **Background:** `#000` · **Z-index:** 80 (above app, below recording).

- Top bar: 50/22/18 padding. X (close) on left → returns to History. Centred task name (16 / 600). Right: lock badge (`lock` icon 16 px, 14 px text, 60 % white).
- Video frame: 16 px radius, gradient placeholder (mock); play overlay 64×64 round, 15 % white fill.
- Controls: 4 px scrub bar (`--accent` 38 % filled mock), 12 px mono row showing current/total time and a pause glyph.
- Footer (12 px secondary, centered): **"View only — not downloadable."**

**States:**

1. Mock play (default in prototype).
2. **Recommended for prod:** loading, paused, playing, ended, network-error, expired-link.

---

## 15. Profile

**ID:** `#profile` · **Top bar:** back arrow + centered title **"Profile"** + 24 px right spacer.

**Layout (vertical stack, 18 px gap):**

- **Profile head**: 64 px avatar (gradient + initial **"A"**) + name block:
  - Name: **"Aakash Sharma"** + 16 px edit pencil, secondary tint.
  - Subline (12 px secondary): **"tap to edit"**.
- **Lifetime block** (12 px vertical pad):
  - Numeric (44 px mono, 700, -1 px tracking): **"0h 0m"** (or seeded value).
  - Caption: **"contributed"**
  - Caption: **"Across 0 tasks"** (dynamic).
- **Earnings card** (1.5 px `--line`, 18 px radius, 18 px pad):
  - Header row: title (17 / 700) **"Payments & Earnings"** + Coming-soon badge (10 px UPPERCASE, `--accent-soft` bg, `--accent` text, 999 px).
  - Body (13 / 19, secondary): **"Payouts process offline. Your earnings will reflect in the app soon. Keep recording — your data is safe and your payouts are guaranteed."**
- **Personal info row list** (each row 14 px vertical pad, 1 px bottom `--line`, 15 px label):
  - Age — value **"28"** + edit pencil.
  - Gender — value **"— Add"** (muted).
  - Joined — value **"May 6, 2026"** (date stamp; non-editable).
- **Actions row list:**
  - **Help Center** → Help screen.
  - **Logout** → confirm modal §18.3.
  - **Delete account** (danger styling, coral text + chevron) → confirm modal §18.4.

**States:**

1. Default.
2. Editing age / gender — _not in prototype_; **recommended:** inline input with primary keyboard, save on blur.
3. Logout modal open / Delete modal open.

---

## 16. Filter sheet (time range)

Used by Home tile filter and History filter chip.

### 16a. Quick-select layer

Sheet content (20 px sides):

- Title (18 / 700): **"Filter by"** _(recommended; prototype renders the options list directly — confirm with PM whether to add a heading)_.
- Option list (each row 14 px vertical pad, 1 px bottom `--line`, 16 px label):
  - **Today**
  - **Yesterday**
  - **This week**
  - **This month**
  - **All time**
  - **Custom range**
- Selected row: `--accent` colour, 600 weight, trailing 20 px `check` icon.

**States:**

1. Default — first applicable option highlighted.
2. Hover/press — backgrounded tap state.
3. Custom-range selected → push to 16b.

### 16b. Custom date range layer

- Title (18 / 700): **"Custom range"**
- Two date inputs (form-field): **"From"** and **"To"** (native HTML date inputs; `max=today`).
- Defaults: From = today − 7, To = today.
- Sticky footer with two buttons (10 px gap):
  - `btn-outline` **"Cancel"** → close sheet, no change.
  - `btn-primary` **"Apply"** → validate → close + apply filter.

**Validation states:**

- **Missing dates** — error line (13 px coral) **"Pick both dates."**, sheet stays open.
- **Inverted range** (From > To) — error **"\"From\" date must be before \"To\" date."**
- **Valid** — applies filter; chip label becomes e.g. **"Apr 30 – May 6"**.

---

## 17. Help Center

**ID:** `#help` · **Top bar:** back to Profile.

**Components:**

- Accordion (full-width rows, 18 px vertical padding, 1 px bottom `--line`):
  - Header row: 16 / 500 label + chevron (rotates 180° on open).
  - Body: 14 / 21 secondary text; numbered list inside Mounting Guide.
- Footer (24 px top spacing): muted line **"Need more help?"** + `btn-primary` **"Contact Support"** (max-width 280 px, centered).

**Accordion items:**

| #   | Heading            | Body                                                                                                                                                                                                                    |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Instructions Guide | "Detailed instructions for recording and uploading. Content coming soon."                                                                                                                                               |
| 2   | Mounting Guide     | Numbered list: (1) "Loosen the rig strap." (2) "Place the phone in the cradle, lens forward." (3) "Tighten until the phone doesn't shift when you nod." (4) "Center the rig on your forehead, just above the eyebrows." |
| 3   | FAQs               | "Common questions about recording, uploads, and payments. Content coming soon."                                                                                                                                         |
| 4   | Troubleshooting    | "Stuck? Common issues and fixes. Content coming soon."                                                                                                                                                                  |

**States:**

1. All collapsed (default).
2. One or more expanded — chevron rotated, body fades in.
3. Contact Support tapped — _not wired in prototype_. **Recommended:** open mailto or in-app contact form; show toast confirmation.

---

## 18. Modals

All modals share the same structure: scrim (`rgba(0,0,0,.5)`), centered card, 20 px radius, 24 px padding, scale-pop entry. Action row is horizontal at the bottom with 10 px gap. Buttons in modals use 12–14 px padding, 14 px font.

### 18.1 Terms of Use (from Sign-up)

- Title: **"Terms of Use"**
- Body (14 / 20):
  > "I consent and agree to upload videos of myself and/or others who consent to be recorded; performing certain daily activities/tasks. This content will be used to develop / train AI models and for research purposes. I confirm that I am 18 years or older and have the necessary permissions to share this content. I confirm that no one being recorded is a minor. I consent to my approximate location and IP address being captured alongside each recording. I understand that my data will be stored securely and used in accordance with Humyn's Privacy Policy."
- Action: single `btn-primary` **"Got it"** (closes).

### 18.2 Stop recording confirm

Triggered when user taps X on the recording surface during active recording.

- Title: **"Stop recording?"**
- Body: **"Recordings under 1 minute are discarded."**
- Actions:
  - `btn-outline` **"Keep recording"**
  - `btn-coral` **"Stop"**

### 18.3 Logout confirm

- Title: **"Log out?"**
- Body: **"You'll need to sign in again to keep contributing."** _(recommended copy — prototype only stubs a confirm)_
- Actions:
  - `btn-outline` **"Cancel"**
  - `btn-primary` **"Log out"** → returns to Sign-up.

### 18.4 Delete account confirm

- Title: **"Delete your Humyn account?"**
- Body: **"Your account will be deactivated for 30 days. Log in within that window to restore it. After 30 days, deletion is permanent. Recordings already uploaded remain on our servers."**
- Actions:
  - `btn-outline` **"Cancel"**
  - `btn-coral` **"Continue to delete"** → second confirm: **"Type DELETE to confirm."** (recommended explicit text input gate before the actual API call).

---

## 19. Transient elements

### 19.1 Toasts (recording surface)

Bottom 96 px, 24 px sides, dark `rgba(26,26,26,.94)`, 14 px radius, 14 px white center text, 14/18 padding, 2 s visible. Trigger:

- "Recording too short — discarded."
- "{Hh Mm} added to your contribution."
- "Recording stopped — phone needs to cool."

### 19.2 Voice cue overlay (recording surface)

Center, 260 px wide rounded pill, white 96 % opacity bg, 14 px primary text, 1.8 s visible, fade in/out only (transform reserved for centering — never animate transform). Used for:

- "Recording started"
- "Recording stopped"

### 19.3 Alert pill (recording surface)

Top-right of dark surface (38 px from top, 14 px right), amber fill, white 12/600 text + 14 px icon, slide-up entry. Two flavours: battery (icon `battery_2_bar`), thermal (icon `device_thermostat`).

### 19.4 Banners (light surfaces)

Warm-amber banner: `#FFF4E5` bg, `#FFD9A8` border, 14 px radius, 12/14 padding, `#8C5A1A` text. Reserved for non-blocking warnings (e.g. pending review). Not used in current screens but token defined for future use.

---

## 20. Cross-screen behaviour notes

- **Press feedback:** every primary tappable element scales to .97/.98 on `:active`. Recording controls scale to .94 for stronger physicality.
- **Haptics:** every successful primary action emits 20–80 ms vibrate. Destructive actions don't emit haptics until the second confirmation.
- **Audio policy:** Web Audio context must be initialized after first user gesture; design assumes the first gesture is the "Continue with Google" button on Sign-up.
- **Voice synthesis:** Used for recording start/stop and alerts. **en-US female-leaning voice** (OWNER DEVIATION 2026-05-12 from `idea-brief.md §13` which mandated en-IN female — on the test device the en-IN fallback sounded bad; `ttsVoice.ts` keeps the `EnIn` symbol names). Android: `Tts.setDefaultLanguage('en-US')` baseline → an en-US female-ish voice → any en-US → first `en-*`. Rate 1.0, pitch 0.95, volume 0.85.
- **Orientation:** Recording surface is the only screen that locks landscape. All others are portrait-only.
- **Date/time formatting:** Dates display as `MMM D, YYYY` (e.g. "May 6, 2026"). Times display as 24-hour `HH:mm`. Durations display as `Nh Nm` for ≥1 h, `Nm` for 1–59 min, `Ns` for under 60 s. Lifetime number uses mono font.
- **Names & numbers:** Mono font is reserved for time, percent, durations, and counts to anchor the eye and reduce shifting widths during animation.

---

## 21. Open questions / design TBDs

These came up during the audit; surface to PM/eng before Figma handoff.

1. **Practice-done heading copy** — confirm exact phrasing.
2. **Compat fail flow** — what's after "Next"? A waitlist screen? A device-swap helper? Not implemented.
3. **No-results states** for Tasks and History — currently undesigned.
4. **Permission denied** branches — full denied / partial / open-settings link copy not in prototype.
5. **Send Request submission feedback** — success / error / pending states undefined.
6. **Player real states** — currently a mock. Need playback, scrub, pause, error, expired-link.
7. **Pending uploads** — ~~only shows a single fake row; need: queued, paused (no wifi), failed-with-retry, completed.~~ **RESOLVED (Phase 5, D-10):** the upload-queue screen (`PendingUploadsScreen`, reached from the Home "Pending uploads" tile §9b) reuses the History row layout (§13/§16) with per-file rows — 64×64 thumbnail + name (15 / 600) + meta line (recording duration, 12px secondary, mono) + a status chip. Chip mapping (no new tokens / curves — the chip family is §13's `chip-progress` / `chip-failed` / `chip-success` plus ONE new neutral variant):
   - **Uploading…** (`chip-progress`; the active row appends "47%") — state uploading/finalizing/pending.
   - **Uploaded — verifying…** (`chip-progress`, distinct label) — state awaiting-verify, i.e. the bundle is in S3 + in the server-side hash-verify queue; the distinct label keeps the user from thinking it's still transferring.
   - **Upload failed** (`chip-failed`) + a "Retry" affordance (re-uploads from the still-present local copy) — state dead-letter.
   - **✓ Uploaded** (`chip-success`) — state verified; **transient** — the row is dropped the moment its bundle is verified (D-10 discretion), so this only flashes briefly.
   - **Paused — no Wi-Fi** — the ONE new chip variant, in the identical chip geometry/type ramp using the existing neutral palette (`--line` surface / `--text2` text); shown while the upload coordinator is paused for connectivity.
   - **No cancel affordance anywhere** (uploads are not user-abortable; UP-11). The Home "Pending uploads" tile (§9b) renders the real rows; its `count > 0` visibility logic, pull-to-refresh, and the offline banner are **Phase 6** (HOME-01..06).
8. **Profile editing** — age and gender flows are visually present but not built.
9. **Help Center** — three of four items are placeholders.
10. **Background interrupt on recording** — pause/resume UX undefined.
11. **Tasks taxonomy ↔ prototype mismatch** — taxonomy has 10 categories / 65 tasks; prototype showed 5 / 6. Confirm full taxonomy ships in v1, decide on Self-care (drop or extend), and decide whether `Outdoor` is a category-pill or a setting-toggle. See §10.
12. **Setting filter (Indoor/Outdoor)** — taxonomy carries this metadata; product call on whether to expose it as a UI control or only use it for downstream daylight prompts.
13. **Custom knitting icon** — `Spline` is the closest lucide match; consider a custom SVG if the visual feels too abstract on the card.
14. **Hand-gate on practice recording (§5.5.3 / §7c)** — practice currently inherits the gate. Pro: consistent UX from session zero. Con: extra friction at first impression if the model false-negatives on a user's lighting / skin tone / glove condition. Decide before Figma handoff whether practice should silently bypass the gate.
15. **TTS voice fallback** — when an Indian English female voice pack isn't installed (common on stock iOS / older Android) what's the fallback ladder? See §20 for the proposed chain; confirm with PM.
16. **Universal-block icon for "close other apps"** — currently using Material `apps` (the 9-grid app-launcher glyph). Reads as "your apps" when paired with the label "Close all other apps before you start", but it is not a "close" verb — it's a noun glyph. Alternatives worth Figma review: `mobile_off`, `do_not_disturb_on`, `phonelink_erase`. Pick once we see it at scale on real devices alongside the other three rules.
