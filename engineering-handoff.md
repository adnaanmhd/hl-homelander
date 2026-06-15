# Humyn Labs — Engineering Handoff

**Source of truth:** `prototype.html` (click-through). Companion: `design-spec.md`.
**Target platforms:** iOS + Android native (recommended) or React Native cross-platform. Web PWA is feasible but the recording flow leans heavily on platform sensors and thermal/battery APIs that are weakest on web.

This document is the engineering contract: tokens, components, navigation, state machines, sensor/system requirements, API surface, data shapes, animations, accessibility, telemetry, and risks. Cross-references to `design-spec.md` use § notation.

> **2026-05-11 — Capture audio dropped from spec.** The original Camera2 pipeline included an AudioRecord → AAC-LC encoder feeding a muxed audio track into every segment MP4. Phase 3 smoke walks on Pixel 10a showed audio-pump CPU contention inflated `imu_video_drift_{mean,p99}_ms` outside the ±1 ms target. Project owner decision: drop capture audio; preserve the drift invariant. Training pipeline (VLA/VLN/robotics) uses video + IMU only. **Audio playback (TTS voice cues, haptics, beeps) is unaffected** — those remain per §6 below. The capture-side references to AudioRecord / mic compat / AudioSession interruption are annotated inline. Full trail: `idea-brief.md` banner + `.planning/phases/03-humyn-capture-native-module/03-HUMAN-UAT.md` GAP-3 + commits `a1ab0ea`, `1a3e039`.

---

## 1. Design tokens (export-ready)

### 1.1 Colours

```
bg                  #FAF7F2
surface             #FFFFFF
text                #1A1A1A
text-secondary      #6B6B6B
text-tertiary       #9A9590
line                #E8E5E0
accent              #FF6A2D
accent-soft         #FFE6D8
coral               #E84A38
success             #2EB872
amber               #F2A53C
info                #2D7CFF
info-soft           #E5EEFF

chip-success-bg     #DEF7E5
chip-success-fg     #1F7A3A
chip-progress-bg    #FFF4E5
chip-progress-fg    #8C5A1A
chip-failed-bg      #FFE3DD
chip-failed-fg      #B5331E

banner-warn-bg      #FFF4E5
banner-warn-border  #FFD9A8
banner-warn-fg      #8C5A1A

rec-bg              #0A0A0A
rec-preview-grad    linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 100%)
rec-toast-bg        rgba(26,26,26,.94)
rec-tip-bg          rgba(0,0,0,.6)  /* + 8 px backdrop blur */
```

Avatar gradient: `linear-gradient(135deg, #FFC09F, #FF6A2D)`.
Hero gradient: `linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)`.

### 1.2 Typography

Family: **Rethink Sans** (weights 400/500/600/700/800). Mono fallback: SF Mono / Menlo / system mono.

Type scale (size / line-height / weight / letter-spacing):

```
display-46-mono     46/46  700  -1.5  mono
display-44-mono     44/44  700  -1.0  mono
title-30            30/36  700  -0.5
title-28            28/34  700  -0.4
title-24            24/28  700  -0.3
title-20            20/24  700   0
body-lg             18/26  400   0
body                16/24  400   0
body-15             15/20  500   0
sheet-desc          16/24  400   0
list-15             15/20  500   0
caption-14          14/20  400   0
caption-13          13/18  400   0
caption-12          12/16  400   0
btn-label           16/20  600   0
pill-label          14/18  500   0
section-eyebrow     12/16  600  +0.8  uppercase
form-label          11/14  600  +0.6  uppercase
badge-coming-soon   10/14  700  +0.6  uppercase
mono-timer          32/32  600  +1.0  mono
countdown           200/200 900  0    mono
```

### 1.3 Spacing

Scale (px): 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 48.
Default screen gutter: 20 px. Auth/tutorial gutter: 24–28 px. Recording gutter: 22 px.

### 1.4 Radii

```
btn       14
input     12 (date)  14 (text/textarea)
card      18
sheet     24 (top corners only)
modal     20
chip-sm   6
chip-pill 999
ring      circular
```

### 1.5 Elevation

```
card-shadow    0 8px 28px rgba(0,0,0,0.08)
sheet-shadow   inherits OS sheet elevation
modal-shadow   inherits OS modal elevation
```

### 1.6 Motion / animations

```
press-scale-button     transform 0.98  duration 80ms
press-scale-record     transform 0.94  duration 80ms
fade-in                opacity 0→1  200–250ms
slide-up               translateY 40→0 + opacity  250–300ms  ease-out
scale-pop              scale 0.6→1.06→1 + opacity  250–700ms  cubic-bezier(.2,.8,.2,1)
sheet-slide            translateY 100%↔0  320ms  cubic-bezier(.2,.8,.2,1)
modal-pop              scale-pop 250ms
ring-stroke            stroke-dashoffset  350ms ease   (compat ring + hand-gate ring fill on increment)
hand-gate-ring-reset   instant snap to dashoffset=full circumference  (no animation on reset)
counter-animate        easing on numeric value  1200ms
rotate-phone-loop      rotate 0↔-90deg  2.8s loop  ease-in-out
confetti-rise          translateY 0→-200 + rotate 0→360  800–1200ms (per particle, randomised)
pulse                  scale 1→1.03→1  1s loop
status-bar-fade        opacity transition  300ms
```

---

## 1.7 Iconography

Two icon systems live in the app, each with a clear scope:

| System    | Library                                  | Scope                                                                                                                                       | Default size                       | Stroke / weight                                                              |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| System UI | Material Symbols Outlined (Google Fonts) | App chrome: nav tabs, top-bar back/close, form chevrons, alert pills (battery/thermostat), modal warnings, search glyph, etc.               | 22–28 px                           | weight 300, optical 24, FILL=0 default / FILL=1 on the active bottom-nav tab |
| Tasks     | `lucide-react` (>= 0.400.0)              | Every reference to one of the 65 taxonomy tasks: task cards, task-detail sheet header, history-row thumbnails, recording top-bar task glyph | 28 px on cards, 32–40 px on sheets | strokeWidth 1.75–2                                                           |

**Task icon package:** `design-system/task-icons/`

```
design-system/task-icons/
├── mapping.ts        # typed registry: id, name, category, setting, icon (LucideIconName)
├── mapping.json      # same data, JSON for non-TS / design tooling / BE seeding
├── TaskIcon.tsx      # <TaskIcon task={slug | name} {...lucideProps} fallback={Sparkles} />
├── index.ts          # barrel
└── README.md         # full mapping + fallbacks for older lucide-react
```

Usage:

```tsx
import { TaskIcon, getTaskIcon, TASKS_BY_CATEGORY } from 'design-system/task-icons';

<TaskIcon task="chopping" size={28} className="text-accent" strokeWidth={1.75} />
<TaskIcon task="Walking a pet" size={28} />
```

The mapping is the **single source of truth** for the slug → icon relationship. The Task type (§7.1) constrains `iconKey` to the `LucideIconName` union exported from `mapping.ts`, so any drift between the type and the registry is a TS error. Backend can echo the slug back as `iconKey`; the client resolves to the lucide component via `getTaskIcon(slug)`.

Repeats are intentional (e.g. `Wrench` for both furniture assembly and plumbing repair) — pair every icon with its name in the UI; never icon-only.

**Fallbacks for older lucide-react** (if you can't take 0.400+):

| Missing          | Substitute        |
| ---------------- | ----------------- |
| `BrushCleaning`  | `Brush`           |
| `ShowerHead`     | `Bath`            |
| `Tractor`        | `Truck`           |
| `Container`      | `Package`         |
| `Spline`         | `Workflow`        |
| `LayoutPanelTop` | `LayoutDashboard` |

---

## 2. Component inventory

| Token                  | Spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Used on                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Button.Primary`       | full-width, 14r, 16/600, fill `--text`, white text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Permissions, Compat Next, Date apply, Help contact                                                                   |
| `Button.Accent`        | full-width, 14r, fill `--accent`, white text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Practice CTA, Sheet "Start Recording", "Send request"                                                                |
| `Button.Outline`       | full-width, 14r, transparent, 1.5px line border, primary text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Modal cancels, Date cancel                                                                                           |
| `Button.Coral`         | full-width, 14r, fill `--coral`, white                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Stop button (modal), Delete confirm                                                                                  |
| `Button.Google`        | full-width, 14r, white fill, 1.5px line, 22px gradient G icon                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Sign-up                                                                                                              |
| `Avatar`               | 36/64 px circle, gradient bg, white initial, optional edit pencil                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Top bar, Profile head                                                                                                |
| `Pill`                 | 999r, 9/16 padding, 14/500, transparent + 1.5px border. Active = filled `--text`/white                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Tasks pills                                                                                                          |
| `Chip.Status`          | 6r, 11/600, padding 3/8                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | History rows                                                                                                         |
| `Chip.Category`        | 999r, 11/600, +0.4 tracking, UPPERCASE, `--accent-soft` bg, `--accent` text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Task sheet                                                                                                           |
| `Chip.ComingSoon`      | 999r, 10/700, +0.6 tracking, accent-soft                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Profile earnings                                                                                                     |
| `Tile.Metric`          | 18r card, mono numeric + small label dropdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Home tiles                                                                                                           |
| `Card.Task`            | 18r, aspect 1:1.05, `<TaskIcon>` + name + cat + desc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Tasks grid                                                                                                           |
| `TaskIcon`             | lucide-react component, 28 px on cards / 40 px on sheets, stroke 1.75–2, `--accent` colour. Resolves task slug or name → lucide icon via `design-system/task-icons`                                                                                                                                                                                                                                                                                                                                                                                                             | Task card, task detail sheet, history row, recording top bar                                                         |
| `Card.History`         | 16r, 64 thumb + info column + chip                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | History list                                                                                                         |
| `Card.Pending`         | 18r, 36 thumb + name + status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Home pending block                                                                                                   |
| `Card.Earnings`        | 18r, 1.5px line, header row + paragraph                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Profile                                                                                                              |
| `Section.Header`       | 12 px UPPERCASE +0.8 px, secondary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Home/Tasks sections                                                                                                  |
| `Banner.Warn`          | 14r, warm bg, warning icon, 13/19 text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Reserved (no current trigger)                                                                                        |
| `Callout.Warn`         | 12r, 12/14 padding, warning icon, 13/19 text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Reserved (no current trigger — was Task sheet, removed when "close other apps" moved into the Universal rules block) |
| `UniversalRules.Block` | 16r, warm-tint `#FFF7F0` fill, 16/16 padding. "Always" eyebrow (11/700 UPPERCASE +0.8 px, `--accent`). Four equal-weight rule rows; each row = 32 px white circle (soft elevation `0 1px 2px rgba(0,0,0,.04)`) holding an 18 px `--accent` Material icon + 14/500 label. Static content sourced verbatim from the header of `task-taxonomy.md` — never per-task. Rules in fixed order: `front_hand` "Keep your hands in frame", `videocam` "Mount the device firmly on the rig", `lightbulb` "Make sure your space is well-lit", `apps` "Close all other apps before you start" | Task details sheet (§11)                                                                                             |
| `BottomNav`            | 68 px, 3 tabs (Home/Tasks/History), accent active state, blurred translucent bg                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Home/Tasks/History                                                                                                   |
| `TopBar.Logo`          | 48 px min height, logo left, avatar right                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Home/Tasks/History                                                                                                   |
| `TopBar.Title`         | 48 px, back arrow + center title                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Profile, Help                                                                                                        |
| `Input.Text`           | 14r, 12/14 padding, 14 px font, focus ring `--accent`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Search, Send Request name                                                                                            |
| `Input.Textarea`       | same, 3-row default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Send Request desc                                                                                                    |
| `Input.Select`         | same, native chevron                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Send Request category                                                                                                |
| `Input.Date`           | 12r, native date picker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Custom range                                                                                                         |
| `Segmented`            | flex row, 1.5px line, 10r, active fills `--text`/white                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Send Request setting                                                                                                 |
| `Upload.Stub`          | 12r dashed border, icon + label                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Send Request video                                                                                                   |
| `Sheet`                | top 24r, 88% max-height, grab handle, optional sticky footer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Task details, Send Request, Filter, Date range                                                                       |
| `Modal`                | center, 20r, 84% width, max-height 70%, action row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Terms, Stop, Logout, Delete                                                                                          |
| `Toast`                | bottom 96 px, dark, 14r, slide-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Recording surface                                                                                                    |
| `VoiceCue`             | center pill, white 96% bg, fade only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Recording surface                                                                                                    |
| `AlertPill`            | top-right, amber fill, slide-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Recording battery/thermal                                                                                            |
| `Ring.Progress`        | 130×130 SVG, 8 px stroke                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Compat                                                                                                               |
| `Ring.HandGate`        | 130×130 SVG, 6 px stroke, accent fill on translucent track, clockwise increment via `stroke-dashoffset`, instant reset on miss, centred 44 px `front_hand` glyph                                                                                                                                                                                                                                                                                                                                                                                                                | Recording → gate substate (§7c, §4.3)                                                                                |
| `Confetti.Burst`       | 18 particles, randomised hue/timing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Practice done                                                                                                        |
| `Hero.Dark`            | 24r, dark gradient, white text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Home                                                                                                                 |

---

## 3. Navigation graph

### 3.1 Linear flow

```
Splash ──auto 2.4s──▶ Sign-up
                       │ googleAuth (consent gate)
                       ▼ 600 ms
                     Permissions (cam-mic)
                       │ permGrant + 20 ms haptic + 350 ms
                       ▼
                     Compat (runCompat)
                       │ pass
                       ▼
                     Tutorial: Rig
                       ▼
                     Tutorial: Practice intro
                       │ Start practice
                       ▼
                     Recording surface (isPractice=true)
                       │ auto-stop @ 60 s
                       ▼
                     Practice done
                       ▼
                     Home (first-time hero)

Home ──Start Recording──▶ Tasks ──tap card──▶ Task sheet ──Start──▶ Recording (real)
                                                                        │ stop
                                                                        ▼
                                                                      Home (returning hero)
```

### 3.2 Side flows

- Avatar (top bar) → Profile.
- Profile → Help Center → expandable accordion → Contact Support.
- Profile → Logout modal → on confirm → Sign-up.
- Profile → Delete modal → on confirm → second-confirm typing gate (recommended) → API call → Sign-up.
- Tasks footer → Send Request sheet.
- Home tile → Tile filter sheet (quick) → optional Custom range sheet.
- History → Filter chip → same sheet stack as above.
- History row → Player → close back to History.
- Recording substates: rotate prompt → ready → countdown → active → (alerts) → stop confirm → toast → home / practice-done.

### 3.3 Routing semantics

- One screen "active" at a time (`screen.active`). Use a stack-based router with replace semantics for splash/auth (so back never returns there).
- Recording surface and Player render above the screen stack as full-bleed overlays.
- Sheets and modals render above their parent without unmounting it (preserve scroll/state on dismiss).
- "Back" hardware affordance:
  - Sign-up → exits app.
  - Permissions / Compat / Tutorial → no back (forward-only onboarding). Show skip/cancel only via X buttons if PM wants escape hatches.
  - Tasks / History / Profile / Help → back to Home (or close modal/sheet first if open).
  - Recording surface → triggers Stop confirm modal during active recording; no-op or X-close otherwise.
  - Player → back to History.

### 3.4 Deep-link surface (recommended)

```
humyn://signup
humyn://home
humyn://tasks?cat={cooking|cleaning|laundry|self-care|outdoor}
humyn://tasks/{taskId}
humyn://record/{taskId}
humyn://history?range={today|yesterday|week|month|all|custom}&from=&to=
humyn://history/{recordingId}
humyn://profile
humyn://help
```

---

## 4. State machines

### 4.1 Permissions (`permStep`)

```
idle ──onEnter──▶ cam-mic
cam-mic ──Allow──▶ {os-grant} ──granted──▶ exit (compat)
                                ──denied──▶ denied (production state, see §4.1.1)
                                ──partial──▶ partial (production state)
location ──Allow──▶ {os-grant} ──any──▶ exit (next screen)
```

**4.1.1 Denied / partial:** Replace icon to `block`, body to "Camera & Mic are required. Open Settings to enable." Primary CTA → `openAppSettings()`. Secondary link "Skip for now" returns to Home.

### 4.2 Compat run (`runCompat`)

```
init ──▶ checking[i=0..6] ──pass each──▶ checking[i+1]
                          ──fail──▶ failed
checking[6] ──pass──▶ done (40 ms haptic, show Next)
done ──Next──▶ tut-rig
failed ──Next──▶ unsupported (production state — tbd)
```

Per-check duration: 700 ms. Total ~4.9 s. Each transition updates ring stroke (`stroke-dashoffset`) and percent.

### 4.3 Recording (`recState`)

```
                          ┌──onEnter──▶ rotate-prompt
                          │              │ orientation=landscape
                          │              ▼
                          │            ready ──tap rec-btn──▶ pre-flight
                          │                                     │  (thermal check → pause-uploads)
                          │                                     │  thermal≥THROTTLING ──▶ ready (toast)
                          │                                     ▼
                          │                                   gate
                          │                                     │ camera not ready ──▶ gate.loading (block accumulation)
                          │                                     │ camera ready     ──▶ gate.waiting (poll loop)
                          │                                     │ count===2  N consecutive ──▶ gate.confirmed (pass)
                          │                                     │ count!==2 ──▶ counter resets to 0
                          │                                     │ tap Skip ──▶ gate.confirmed (skipped=true, no TTS)
                          │                                     │ detector unavailable ──▶ gate.confirmed (bypassed=true, no TTS)
                          │                                     │ tap X ──▶ exit silent (treated as pre-record)
                          │                                     │ (no timeout, no auto-cancel)
                          │                                     ▼
                          │                                   confirmed (drop brightness 5% → optional TTS)
                          │                                     ▼
                          │                                   active
                          │                                     │
                          │                                     ├── tap X ──▶ stop-confirm modal
                          │                                     │                  │ Stop
                          │                                     │                  ▼
                          │                                     │              stopped
                          │                                     │
                          │                                     ├── tap stop ──▶ stopped
                          │                                     │
                          │                                     ├── thermal event ──▶ thermal-alert ── +2500 ms ──▶ stopped (toast: "needs to cool")
                          │                                     ├── battery event ──▶ battery-alert (overlay only, recording continues)
                          │                                     ├── 10-min auto-segment cut ──▶ silent stop+restart (gate NOT re-run)
                          │                                     └── practice && t≥60s ──▶ stopped (auto)
                          │
stopped (decide branch):
  - practice → practice-done screen
  - real && duration < 180s (3 min — floor raised from 60s on 2026-06-04, Bug 8 + Enh 1 / D6) → toast "Recording too short — discarded.", reset to ready
  - real && duration ≥ 180s (3 min) → toast "{Hh Mm} added", commit upload, return to home
```

State data:

```typescript
type RecState = {
  taskId: string;
  taskName: string;
  isPractice: boolean;
  startedAt: number | null; // performance.now (active recording start)
  durationMs: number;
  cap: 60_000 | 1_200_000; // practice = 60s, real = 20m
  ended: boolean; // double-stop guard
  alerts: { battery?: boolean; thermal?: boolean };
  gate: {
    phase: 'idle' | 'loading' | 'waiting' | 'confirmed';
    consecutiveHits: number; // count===2 streak; resets to 0 on any miss
    targetHits: number; // 5 on Android (× 400 ms cadence) / 3 on iOS (× 600 ms)
    cadenceMs: number; // 400 on Android / 600 on iOS
    skipped: boolean; // true if user tapped Skip
    bypassed: boolean; // true if HandDetector native module was unavailable
    startedAt: number | null; // performance.now (gate enter)
    confirmedAt: number | null; // performance.now (gate exit, success/skip/bypass)
  };
};
```

The `gate` block survives onto the metadata JSON as `metadata.start_gate` (§7.3 / `video_metadata.json`).

### 4.4 Filters (Tasks)

```
activePill: 'all' | 'cooking' | 'cleaning' | 'laundry' | 'self-care' | 'outdoor'
activeQuery: string

visible(card) = (activePill === 'all' || card.cat === activePill)
             && (activeQuery === '' || card.searchBlob.includes(activeQuery.lower()))
```

`searchBlob` should concat name + description + category, lowercased.

### 4.5 Filters (Home tiles, History)

```
type FilterValue = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

state TileFilter = { time: FilterValue; tasks: FilterValue }
state HistoryFilter = { value: FilterValue; from?: ISODate; to?: ISODate }
```

Default Home tiles: `today` for both. Default History: `all`. Custom range validates `from <= to <= today`.

### 4.6 Help accordion

Each item independent: `open: boolean`. Toggle on header tap; chevron rotates 180°.

---

## 5. Native APIs / system integrations

| Capability                                        | iOS                                                                             | Android                                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera capture                                    | AVCaptureSession                                                                | CameraX                                            | Need ultrawide lens, 1080p @ 30 fps, H.264. Must pin frame rate.                                                                                                                                                                                                                                                                                                                                     |
| ~~Microphone~~ (capture audio dropped 2026-05-11) | AVAudioSession                                                                  | AudioRecord / MediaRecorder                        | ~~Configure to **measurement** or **video chat** mode to keep gain stable; suppress AGC where possible.~~ — historical. Capture audio dropped 2026-05-11; see banner. RECORD_AUDIO permission still requested (FGS-type compatibility) but AudioRecord is not started.                                                                                                                               |
| Motion sensors                                    | CoreMotion (accelerometer, gyroscope, deviceMotion)                             | SensorManager (TYPE_ACCELEROMETER, TYPE_GYROSCOPE) | Required ≥100 Hz for "imu" check. Sample at 100 Hz, reject jitter.                                                                                                                                                                                                                                                                                                                                   |
| Time sync                                         | Network time check (HTTP `Date` header from a trusted endpoint) vs system clock | Same                                               | "Time sync source" check fails if drift > N seconds.                                                                                                                                                                                                                                                                                                                                                 |
| Device integrity                                  | DeviceCheck / App Attest                                                        | Play Integrity API                                 | Reject jailbroken/rooted devices.                                                                                                                                                                                                                                                                                                                                                                    |
| Orientation                                       | UIDevice.orientation                                                            | OrientationEventListener                           | Recording surface gates active state on landscape.                                                                                                                                                                                                                                                                                                                                                   |
| Vibration                                         | UIImpactFeedbackGenerator + custom patterns via CoreHaptics                     | Vibrator (`vibrate(long)` / pattern)               | See §6 for patterns.                                                                                                                                                                                                                                                                                                                                                                                 |
| Audio playback (beeps)                            | AVAudioPlayer with synthesized tone                                             | AudioTrack                                         | Or pre-bake .wav assets (preferred for predictability).                                                                                                                                                                                                                                                                                                                                              |
| Speech synthesis                                  | AVSpeechSynthesizer                                                             | TextToSpeech                                       | Voice cues "Recording started", etc.                                                                                                                                                                                                                                                                                                                                                                 |
| Battery monitoring                                | UIDevice.batteryLevel + notifications                                           | BatteryManager                                     | Trigger battery alert at 15 %.                                                                                                                                                                                                                                                                                                                                                                       |
| Thermal monitoring                                | ProcessInfo.thermalState (`fair`/`serious`/`critical`)                          | PowerManager.thermalStatus (Android 10+)           | Auto-stop on `critical`. Show alert at `serious`.                                                                                                                                                                                                                                                                                                                                                    |
| Storage check                                     | NSFileManager free space                                                        | StatFs                                             | Block start of recording if < N GB free (size for 20-min @ 1080p ≈ 1.5–2 GB conservatively).                                                                                                                                                                                                                                                                                                         |
| Background interruption                           | AVAudioSession interruption notifications                                       | AudioFocusChange                                   | Pause recording on call/alarm. Resume modal on return. _(Still relevant post-audio-drop: the OS sends AudioFocusChange to apps holding RECORD_AUDIO even without an active AudioRecord; capture pause/resume on call still keys off these signals.)_                                                                                                                                                 |
| Upload (background)                               | URLSession background config                                                    | WorkManager                                        | Resumable, chunked.                                                                                                                                                                                                                                                                                                                                                                                  |
| Push (optional)                                   | APNs                                                                            | FCM                                                | Recommended for upload completion notifications.                                                                                                                                                                                                                                                                                                                                                     |
| Auth                                              | ASAuthorization (Sign in with Apple/Google)                                     | Credential Manager / Google ID Services            | OAuth2; PKCE.                                                                                                                                                                                                                                                                                                                                                                                        |
| Settings deep link                                | UIApplication.openURL("App-Prefs:...")                                          | Settings.ACTION_APPLICATION_DETAILS_SETTINGS       | For permission re-grant flow.                                                                                                                                                                                                                                                                                                                                                                        |
| Hand detection (pre-record gate)                  | `MediaPipeTasksVision` (CocoaPod)                                               | `com.google.mediapipe:tasks-vision` (Maven)        | Custom Swift / Kotlin RN module: `HandDetector.detectHands(path) → number`. Loads bitmap via `UIImage` / `BitmapFactory`, hands to `HandLandmarker` (`RunningMode.IMAGE`, `numHands=2`, all confidences 0.5, CPU delegate). Returns `landmarks.size`. Single shared `hand_landmarker.task` asset (~7.8 MB) bundled into both platforms. See §4.3 gate state and `figure-app-hands.md` reference doc. |
| Screen brightness control                         | `UIScreen.main.brightness`                                                      | `WindowManager.LayoutParams.screenBrightness`      | Drop to **0.05 (5 % of max)** at gate-pass / skip / silent bypass; restore on stop or exit. Per-window override; do not persist into the OS-level setting.                                                                                                                                                                                                                                           |

### Compat-check implementation notes

The 7-step compat check from the prototype maps to:

| Key         | Real check                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ultrawide` | Enumerate cameras; require focal length / lens metadata indicating ≤ 18 mm equivalent or device-specific list.                                                                                       |
| `res`       | Camera capability check: 1920×1080 @ 30 fps, codec H.264 (Baseline OK; High preferred).                                                                                                              |
| `motion`    | Sensor presence (accel + gyro).                                                                                                                                                                      |
| `imu`       | Sample at 100 Hz for ~700 ms; check actual delivery rate ≥ 100 Hz with low jitter. Prototype's failure copy: "Stable motion sensors at 100 Hz+ required (yours: 44 Hz)" — surface the measured rate. |
| `mic`       | Microphone available + sample rate ≥ 16 kHz. _(Probe retained as informational; capture audio dropped 2026-05-11 — see banner.)_                                                                     |
| `clock`     | Compare device clock to network NTP / server time; fail if drift > 60 s.                                                                                                                             |
| `root`      | DeviceCheck / Play Integrity attestation.                                                                                                                                                            |

The prototype runs each step for exactly 700 ms (visual). In production keep min 600 ms per step so the user perceives the work; cap real checks that finish faster. Total target: 4.5–5.5 s for the happy path. If a real check legitimately takes longer (network), the ring should pause at that step until resolved.

---

## 6. Audio & haptics specification

### 6.1 Beeps (sine, 0.3 vol, 140 ms default duration)

| Trigger                        | Frequency / pattern                                        |
| ------------------------------ | ---------------------------------------------------------- |
| Hand-gate pass                 | (no beep — voice + 80 ms vibrate take over)                |
| Hand-gate skip / silent bypass | (silent — no beep, no vibrate, no voice)                   |
| Battery alert                  | 520 Hz, 200 ms                                             |
| Thermal alert                  | 440→560→680 Hz, 180 / 180 / 220 ms (descending three-note) |

Pre-bake `.wav` at 44.1 kHz mono and ship as bundled assets to avoid AudioContext latency variance. Volume capped at 30 % so beep doesn't dominate captured mic audio.

### 6.2 Vibration patterns

```
permission-grant       20 ms
hand-gate-pass         80 ms              (only on detection-pass; suppressed on Skip and silent bypass)
compat-pass-step       40 ms
practice-done          [40, 80, 40] ms
contribution-confirm   40 ms
battery-alert          [100, 50, 100] ms
thermal-alert          800 ms continuous
```

iOS: prefer `CoreHaptics` for the patterned ones, falling back to `UIImpactFeedbackGenerator` (`light` for 20–40 ms equivalents, `heavy` for 80 ms+). Android: `Vibrator.vibrate(VibrationEffect.createWaveform(...))`.

### 6.3 Speech

**Voice:** Indian English female. Selection chain (first available wins):

1. iOS — `AVSpeechSynthesisVoice(language: "en-IN")` filtered to `gender == .female`. Android — `TextToSpeech.setLanguage(Locale("en", "IN"))` + iterate `getVoices()` for a female voice in that locale.
2. Indian English neutral / male if a female isn't installed.
3. `en-US` female.
4. First available `en-*` voice.

Rate 1.0, pitch 0.95, volume 0.85.

Voice cues:

- "Recording started" — fired on hand-gate **pass only**. Suppressed on Skip and on silent bypass (detector unavailable). See §4.3.
- "Recording stopped" — on every stop (manual, auto-segment cut suppresses it; thermal kill plays its own line first).
- "Battery low. Consider charging soon."
- "Phone too hot, stopping recording"

Both spoken aloud and shown as the centered VoiceCue overlay (deaf accessibility).

---

## 7. Data model

### 7.1 Entities

```typescript
type User = {
  id: string;
  name: string; // "Aakash Sharma"
  email: string;
  age?: number; // editable
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not' | string;
  joinedAt: ISODate; // "2026-05-06"
  consent: {
    termsAcceptedAt: ISODate;
    locationConsent?: boolean;
  };
};

type Task = {
  id: string; // slug from taxonomy, e.g. "chopping", "walking-pet"
  name: string; // "Chopping"
  category: TaskCategory; // 10 values, see TaskCategory union below
  setting: 'indoor' | 'outdoor';
  iconKey: LucideIconName; // lucide-react component name, e.g. "Carrot", "Dog"
  description: string;
  instructions: string[]; // max 3-bullet per-task list from taxonomy.
  // ALL bullets are task-specific (gaze direction,
  // pacing/motion pattern, optional task-shape detail).
  // The hands-in-frame rule is NOT included here —
  // it lives only in the Universal rules block on the
  // Task details sheet. Server should reject entries
  // where instructions.length > 3 or where any bullet
  // duplicates a universal-rule string.
  warning?: string; // optional callout text — not currently surfaced
  //   anywhere on the Task sheet (the close-apps
  //   warning moved into the Universal rules block).
  isPractice?: boolean;
};

type TaskCategory =
  | 'Cooking'
  | 'Dishwashing'
  | 'Kitchen'
  | 'Cleaning'
  | 'Tidying'
  | 'Laundry'
  | 'Gardening'
  | 'Pet Care'
  | 'Home Maintenance'
  | 'Hobby';

// Source of truth for the LucideIconName union and the slug → icon map:
// design-system/task-icons/mapping.ts. Server should treat iconKey as a string;
// the client validates against the union at compile time.

type Recording = {
  id: string;
  taskId: string;
  taskName: string; // denormalised for display
  startedAt: ISODateTime;
  durationS: number;
  status: 'pending-upload' | 'uploading' | 'uploaded' | 'failed' | 'discarded';
  uploadProgress?: number; // 0..100
  thumbnailUrl?: string;
  playbackUrl?: string; // signed, expiring
  meta?: {
    deviceModel: string;
    sensorRateHz: number;
    location?: { lat: number; lng: number; accuracyM: number };
    interrupts?: ('thermal' | 'battery' | 'background')[];
  };
};

type Contribution = {
  totalS: number;
  totalTasks: number;
  todayS: number;
  todayTasks: number;
  weekS: number;
  monthS: number;
  // computed server-side; client caches and animates between snapshots
};

type TaskRequest = {
  id: string;
  name: string; // ≤ 80 chars
  description: string; // ≤ 240 chars
  category: TaskCategory | 'Other';
  setting: 'indoor' | 'outdoor';
  sampleVideoUrl?: string; // ≤ 30 s, optional
  status: 'submitted' | 'approved' | 'rejected';
  submittedAt: ISODateTime;
};
```

### 7.2 Local persistence

| Key                       | Value                                       | Why                                                     |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `auth.token`              | OAuth token (encrypted Keychain / Keystore) | Session                                                 |
| `auth.userId`             | string                                      | Bootstrap                                               |
| `user.profile`            | `User` cache                                | Offline render of Profile                               |
| `tasks.cache`             | `Task[]` + `cachedAt`                       | Offline browse                                          |
| `contrib.cache`           | `Contribution`                              | Animate from cached value to server value on Home enter |
| `recordings.queue`        | local recordings pending upload             | Survive app kill                                        |
| `consent.terms`           | accepted version + timestamp                | Compliance                                              |
| `prefs.firstRunCompleted` | boolean                                     | Skips onboarding on relaunch                            |

Sensitive: token must use Keychain (iOS) or EncryptedSharedPreferences / Keystore (Android). Don't write to plaintext disk.

### 7.3 Upload pipeline

1. On `onStop()` (≥ 60 s real recording): write encrypted file to app sandbox + enqueue.
2. POST `/recordings` with metadata → receive signed S3 (or equivalent) PUT URL.
3. Background uploader (URLSession bg / WorkManager): chunked PUT; emit progress notifications.
4. On 200: PATCH `/recordings/{id}` status → `uploaded`. Delete local file.
5. On error: retry with exponential backoff (3 tries / 15 min); after that, mark `failed` and surface in Pending block with retry tap.

**Encryption at rest:** AES-256-GCM with a per-recording key wrapped by the user's encryption key (or a server-issued key escrow). Decrypt on upload.

---

## 8. API surface (suggested REST)

Base: `https://api.humyn.ai/v1`. Auth: `Authorization: Bearer <token>`.

```
POST /auth/google            → exchange Google ID token for Humyn session token
GET  /me                     → User
PATCH /me                    → update name / age / gender
DELETE /me                   → soft-delete (30-day grace)
POST /me/restore             → restore within grace

GET  /tasks?category=&setting=  → Task[] (65 total in v1, paginated; category one of the 10 taxonomy values, setting=indoor|outdoor)
GET  /tasks/{id}                → Task (id is the taxonomy slug, e.g. "chopping")
POST /task-requests             → submit a TaskRequest
GET  /task-requests             → list user's requests

POST /recordings             → { id, uploadUrl, expiresAt }; pass metadata in body
PATCH /recordings/{id}       → update status / progress
GET  /recordings?range=      → Recording[] (with filters)
GET  /recordings/{id}        → Recording (with playbackUrl)
DELETE /recordings/{id}      → soft delete

GET  /contributions          → Contribution
GET  /contributions/timeseries?bucket=day&range= → series for tile filters

POST /events                 → telemetry batch (see §11)
```

Errors return RFC 7807 `application/problem+json`. Idempotency: `Idempotency-Key` header on POSTs that create resources.

---

## 9. Validation rules

| Field                       | Rule                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign-up consent checkbox    | Must be checked to invoke Google auth                                                                                                                                                                                                                                                                                                                                                      |
| Send Request — Task name    | required, 3–80 chars, trimmed                                                                                                                                                                                                                                                                                                                                                              |
| Send Request — Description  | required, 10–240 chars                                                                                                                                                                                                                                                                                                                                                                     |
| Send Request — Category     | required, one of the 10 taxonomy values + `Other` (defaults to Cooking)                                                                                                                                                                                                                                                                                                                    |
| Send Request — Setting      | required (defaults to Indoor)                                                                                                                                                                                                                                                                                                                                                              |
| Send Request — Sample video | optional, ≤ 30 s, ≤ 50 MB, MIME `video/*`                                                                                                                                                                                                                                                                                                                                                  |
| Custom date range           | both required, `from ≤ to ≤ today`; max range 365 days                                                                                                                                                                                                                                                                                                                                     |
| Profile age                 | optional, 18 ≤ age ≤ 99 (consent stipulates 18+)                                                                                                                                                                                                                                                                                                                                           |
| Recording (real)            | discarded if duration < 3 min (180 s) — raised from 60 s on 2026-06-04 (Bug 8 + Enh 1 / D6)                                                                                                                                                                                                                                                                                                |
| Practice recording          | auto-stop at 60 s; not counted in contribution                                                                                                                                                                                                                                                                                                                                             |
| `Task.instructions`         | required, 1 ≤ length ≤ 3. All bullets must be task-specific — reject any row where a bullet matches one of the four universal-rule strings (case-insensitive substring match on "hands in frame", "mount the device", "well-lit", "close all other apps") since those rules are owned by the `UniversalRules.Block`, not by per-task copy. Reject at seed time if either constraint fails. |

Client validation surfaces inline errors in coral (`#E84A38`), 13 px, below the field. Server validation errors should be presented as banner at top of the sheet/screen.

---

## 10. Accessibility

- **Targets:** all interactive surfaces ≥ 44×44 px (iOS HIG) / 48×48 dp (Android Material). Bottom-nav tabs and pills currently meet; record button is 88×88 (well over). Verify avatar (36 px) by extending hit-slop to 44 px.
- **Contrast:** verify `--text-2 (#6B6B6B)` on `--bg (#FAF7F2)` for AA on body text; on body Lg (18 px) it passes (4.6:1). On 13 px secondary lines it's borderline (4.62:1 — passes AA normal). `--text-3` is reserved for placeholder/disabled and may fall below AA — use only on inputs where browser/OS contributes a visual outline.
- **Recording surface:** white-on-dark — high contrast. Voice cues and toasts duplicate audio cues for deaf users.
- **Voiceover/TalkBack labels:**
  - Avatar → "Open profile"
  - Bottom nav tab → "Home tab, selected" / "Tasks tab" / "History tab"
  - Record button → "Start recording" (state: armed) / "Recording, double-tap to stop" (state: active)
  - Stop button → "Stop recording"
  - Tile filter pill → "Filter by time, currently today, double-tap to change"
- **Reduced motion:** honour OS reduce-motion. Replace `scale-pop` and confetti with a fade. Replace counter animation with instant set. Sheet/modal use 150 ms cross-fade instead of slide.
- **Dynamic type:** support up to 1.4× text scaling without layout breakage. Tile numbers and timer use mono so width grows predictably; verify cards reflow.
- **Focus order:** screens follow visual top-to-bottom. Sheets trap focus inside; ESC / hardware back closes them.
- **Captions:** voice-cue text and speech synth strings are identical (single source of strings).

---

## 11. Telemetry / analytics

Recommended events (snake_case). Always include `user_id`, `session_id`, `device_model`, `os_version`, `app_version`, `network`.

```
app_open
splash_advanced
signup_view
signup_consent_toggled                  { checked: boolean }
signup_terms_opened
signup_google_started
signup_google_succeeded
signup_google_failed                    { reason }
permission_view                         { step: 'cam-mic' | 'location' }
permission_granted                      { step }
permission_denied                       { step }
permission_settings_opened
compat_started
compat_step_completed                   { key, durationMs, passed: boolean, measured }
compat_completed                        { passed: boolean }
tutorial_view                           { id: 'rig' | 'practice' }
recording_started                       { task_id, is_practice, capS }
recording_gate_started                  { task_id, cadence_ms, target_hits }
recording_gate_passed                   { task_id, duration_ms, was_loading_at_start: boolean }
recording_gate_skipped                  { task_id, duration_ms }
recording_gate_bypassed                 { task_id, reason: 'detector-unavailable' | 'detector-init-failed' }
recording_armed                         (after gate exits — same trigger as before, fired from gate.confirmed not from countdown)
recording_stopped                       { duration_s, is_practice, reason: 'user'|'auto-cap'|'thermal'|'background' }
recording_discarded                     { reason: 'too-short' | 'thermal' | ... }
recording_alert                         { type: 'battery' | 'thermal' }
recording_uploaded                      { recording_id, bytes, duration_s }
upload_failed                           { recording_id, reason }
practice_done_view
home_view                               { state: 'first-time' | 'returning' }
home_tile_filter_changed                { tile: 'time' | 'tasks', value }
tasks_view
tasks_pill_changed                      { value }
tasks_search                            { query_length }
task_sheet_opened                       { task_id }
task_request_opened
task_request_submitted                  { category, setting, has_video }
task_request_failed                     { reason }
history_view
history_filter_changed                  { value, from?, to? }
history_row_opened                      { recording_id }
profile_view
profile_edit_attempted                  { field }
logout_confirmed
account_delete_started
account_delete_confirmed
help_item_opened                        { id }
help_contact_opened
```

Throttle `tasks_search` to fire on debounce 400 ms after last keypress. Strip query content before logging — log only length.

PII rules: do **not** log task name, description, or query content. Do log task IDs.

---

## 12. Performance budgets

| Surface                     | Budget                                         |
| --------------------------- | ---------------------------------------------- |
| Splash → Sign-up            | 2.4 s wall clock (intentional, do not shorten) |
| Sign-up → Permissions       | < 1 s after Google success                     |
| Permissions → Compat        | 350 ms transition                              |
| Compat run                  | 4.5–5.5 s (visual minimum 700 ms per step)     |
| Tutorial transitions        | < 300 ms                                       |
| Sheet open / close          | 320 ms                                         |
| Recording surface mount     | < 500 ms cold; < 200 ms warm                   |
| Camera preview first frame  | < 800 ms after surface mount                   |
| Stop tap → toast / nav      | < 250 ms (file flush async)                    |
| Home cold render            | < 1 s with cached data                         |
| Home with API refresh       | < 2 s                                          |
| Tasks grid render (6 cards) | < 100 ms after data ready                      |
| History pagination          | 50 rows / page; < 500 ms render                |
| Player scrub seek           | < 300 ms perceived                             |

Memory: keep recording session under 200 MB peak; flush to disk every 5 s.
Battery: 20-min recording session should not drain > 8 %; if it does, raise the issue.

---

## 13. Edge cases & error states

| Scenario                                                         | Behaviour                                                                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network offline on Sign-up                                       | Show toast "Can't reach Humyn. Check your connection." Disable Google button until back online.                                                     |
| Time sync drift > 60 s                                           | Compat fails on `clock`; copy: "System clock is off — update Date & Time in Settings."                                                              |
| Camera busy (other app)                                          | Recording surface shows "Camera in use" overlay with retry.                                                                                         |
| Storage < 2 GB on record start                                   | Modal: "Not enough storage to record. Free at least 2 GB and try again."                                                                            |
| Phone call mid-recording                                         | Auto-pause; on call end, modal "Resume recording?" with [Discard, Resume].                                                                          |
| Permission revoked between screens                               | Drop into Permissions screen denied variant.                                                                                                        |
| Background kill during upload                                    | Resume on next launch via background uploader; show in Pending block.                                                                               |
| 60 s practice + user taps stop early                             | Treat as normal stop; still go to Practice done — surface friendly note "You ended early — that's fine; let's continue."                            |
| Real recording exactly at cap (1200 s)                           | Emit "Recording stopped — max length reached" toast.                                                                                                |
| Custom date range invalid                                        | Inline error in coral 13 px; sheet stays open.                                                                                                      |
| Send Request in flight                                           | Disable submit button; spinner inside; if 5 s passes, show "Still sending…" line.                                                                   |
| Account-delete grace expired and user logs in                    | Show modal explaining account is gone; route to fresh signup.                                                                                       |
| Hand-gate runs indefinitely (user never shows hands)             | No timeout, no auto-cancel. User must Skip or tap X to leave. Surface in `recording_gate_started` analytics duration to monitor abandonment.        |
| Native HandDetector module missing or `createFromOptions` throws | Silent bypass — fire `recording_gate_bypassed`, jump straight into `gate.confirmed`, drop brightness, no TTS.                                       |
| User taps X during the gate                                      | Silent exit (treated as pre-record exit; `recState.gate.startedAt` set but `confirmedAt` null). No confirmation modal, no captured data to discard. |
| 10-min auto-segment cut                                          | Gate does **not** re-run between segments — only on a fresh tap of the record button.                                                               |
| TTS Indian-English female voice not installed                    | Walk down the fallback chain (§6.3); if no `en-*` voice exists, suppress the spoken line but still show the VoiceCue overlay text.                  |
| Camera not ready when gate starts                                | Show loading state inside the ring well; do not start the accumulator until first frame arrives. Ring stays at 0; Skip remains tappable.            |

---

## 14. Security & privacy

- Recordings encrypted at rest (AES-256-GCM) and in transit (TLS 1.3).
- Token stored in Keychain / Keystore; never in JS-accessible storage on web.
- **Precise location (GPS coordinates) attached to recordings** (Bug 3 / D3, 2026-06-04 — overrides the formerly coarse-only rule; consent text updated + consent version bumped). A partial COARSE grant still records a coarser fix; only a full denial blocks.
- Consent timestamps logged server-side with version of terms text accepted.
- Account delete: 30-day soft delete window; after window, hard delete user record + recording metadata. Recordings already used for training stay (clearly disclosed in terms).
- Player URLs are signed and expire (recommend 5 minutes); no download path; HTML inline footer "View only — not downloadable" must be enforced server-side too.
- App attestation (DeviceCheck / Play Integrity) gates recording API calls — prevents synthetic uploads.
- Crash logs scrubbed of paths and IDs that could reverse to PII.

---

## 15. Theming & dark mode

The current design is light-only with one dark surface (recording). Dark mode for the rest of the app is **out of scope for v1**, but token names should be future-proofed:

```
semantic.bg       ← --bg
semantic.surface  ← --surface
semantic.text     ← --text
semantic.muted    ← --text-2
…
```

Avoid hardcoding hex outside of `tokens.ts` so a future dark theme is a single swap.

---

## 16. Internationalisation

V1 is English-only. To prep for i18n:

- Externalise all strings into a `strings.json` keyed by stable IDs.
- Use ICU MessageFormat for plurals (e.g. "Across {n, plural, one {# task} other {# tasks}}").
- Reserve 30 % extra width on tile labels and pills for German/French expansion.
- Date and duration formatters via `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`.
- Recording voice cues need localised speech-synth strings; choose voice based on locale.

---

## 17. Telemetry → product KPIs map

| KPI                                      | Source events                                                  |
| ---------------------------------------- | -------------------------------------------------------------- |
| Onboarding completion                    | `signup_google_succeeded` → `practice_done_view`               |
| Compat pass rate                         | `compat_completed.passed`                                      |
| Practice→first real recording conversion | `practice_done_view` → first non-practice `recording_uploaded` |
| Recording success rate                   | `recording_uploaded` / `recording_started`                     |
| Avg session minutes                      | sum `recording_uploaded.duration_s` per user-day               |
| Thermal kill rate                        | `recording_alert.type=='thermal'` ÷ `recording_started`        |
| Task discoverability gap                 | `task_request_submitted` rate                                  |
| 7-day retention                          | `app_open` distinct days                                       |

---

## 18. Build / handoff checklist

- [ ] Tokens exported to `tokens.json` (and synced to Figma via Style Dictionary or equivalent).
- [ ] All 17 surfaces in Figma with explicit state variants per `design-spec.md`.
- [ ] Component library mirrors §2 inventory.
- [ ] `design-system/task-icons/` wired into the app build; `lucide-react` >= 0.400.0 in dependencies.
- [ ] Tasks screen rendering all 65 taxonomy tasks with correct icons (snapshot test recommended).
- [ ] Backend `/tasks` endpoint seeded from `mapping.json` (slug, name, category, setting, iconKey).
- [ ] Lottie / native curves for all motion specs in §1.6.
- [ ] Native compat-check spike: prove 100 Hz IMU sampling on target devices.
- [ ] Recording stress test: 20-min @ 1080p / 30 fps with thermal monitoring.
- [ ] Background upload spike: kill app mid-upload, verify resume.
- [ ] Storybook / equivalent screens for QA review of every state.
- [ ] Telemetry contract review.
- [ ] Privacy review of consent text (versioned).
- [ ] Accessibility pass with VoiceOver and TalkBack.
- [ ] Reduce-motion variants implemented.
- [ ] Onboarding deep-link + restore on relaunch verified.

---

## 19. Open engineering questions

1. **Taxonomy ↔ prototype mismatch** — taxonomy carries 10 categories / 65 tasks (`task-taxonomy.md`); prototype showed 5 / 6. Confirm the taxonomy is the v1 ship-list, decide whether to add a Self-care category (taxonomy has none today) or drop the prototype's `Brush teeth` example, and decide how to surface the `Indoor / Outdoor` setting (separate filter, prefixed badge, or hidden metadata).
2. **Compat fail UX** — what happens after the failure screen? Waitlist? Email-me-when-supported? Currently the "Next" button is wired but undefined.
3. **Offline-first scope** — is browsing tasks / history offline a v1 requirement? The cached-data hooks above assume yes; confirm.
4. **Practice gating** — can a user re-take practice from Profile or Help? Not in prototype. Suggest a "Re-do practice" entry under Help → Mounting Guide.
5. **Multi-device sessions** — does logging in on a new device invalidate the old session? Recommended yes (single-device).
6. **Account-delete typing gate** — confirm whether to require the user to type "DELETE" before the API fires. The prototype hints at this (`alert('Next: type DELETE to confirm.')`).
7. **Player playback semantics** — full v1 needs a real player; assess whether to use AVPlayer/ExoPlayer with DRM or signed HLS. DRM may be overkill for v1.
8. **Earnings / payout flow** — currently "Coming soon"; tee up the data model and sheet now, or defer entirely?
9. **Push notifications** — opt-in moment? On first upload? Bundle with permission flow?
10. **Sensors during recording** — capture IMU stream alongside video for downstream training? If yes, need parallel writer + bandwidth budget.
11. **Web fallback** — is a desktop / tablet web build expected for review-only access (e.g. Player)? If so, confirm scope.
12. **Hand-gate `targetHits` per platform** — current spec is 5 (Android × 400 ms) / 3 (iOS × 600 ms). Empirically validate on target devices; expose as Firebase Remote Config keys (`hand_gate.target_hits.android`, `hand_gate.target_hits.ios`, `hand_gate.cadence_ms.android`, `hand_gate.cadence_ms.ios`) so the rule can be retuned without an app release.
13. **`takePhoto()` cadence vs frame-processor** — locked at takePhoto for v1. Reassess if iOS shutter latency makes the ring visibly stutter and a VisionCamera frame-processor plugin proves cheaper.
14. **Hand-gate on practice (§5.5.3)** — does the practice run inherit the gate? Default current spec: yes. Open whether to skip it for the first-impression session.
15. **TTS voice pack** — confirm whether to bundle / prompt the user to install an Indian English female voice when missing, or accept the §6.3 fallback chain silently.
16. **`UniversalRules.Block` content is hardcoded client-side** — the four rules and their icons are constants in the component, not served from the API. This keeps the bundle self-sufficient and avoids a network dependency for content the user must see before recording, but means any copy change ships with an app release. Confirm this is acceptable, or define a remote-config surface (e.g. Firebase Remote Config keys `universal_rules.{order,labels,icons}`) so PM can A/B-test rule copy without a release. Server-side `Task.instructions` validation in §9 also references the universal-rule strings — if that copy moves to remote config, the validation list must be sourced from the same place.
