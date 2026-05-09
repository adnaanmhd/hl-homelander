---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 17
id: 02-17-profile-screen
name: ProfileScreen — inline-edit (PATCH /me) + lifetime contribution + Payments card + footer + Logout/DeleteAccount entries
type: execute
wave: 4
depends_on: [02-16-home-skeleton-and-tabs, 02-08-splash-and-version-service]
files_modified:
  - apps/mobile/src/screens/profile/ProfileScreen.tsx
  - apps/mobile/src/screens/profile/InlineEditField.tsx
  - apps/mobile/src/services/profileService.ts
  - apps/mobile/src/services/durationFormatter.ts
  - apps/mobile/__tests__/screens/ProfileScreen.test.tsx
  - apps/mobile/__tests__/services/profileService.test.ts
  - apps/mobile/__tests__/services/durationFormatter.test.ts
  - apps/mobile/src/navigation/RootNativeStack.tsx
autonomous: true
requirements: [PROF-01, PROF-02, PROF-03, PROF-04, PROF-05]
must_haves:
  truths:
    - 'Profile shows Google avatar (read-only Image with photoURL fallback to initial), editable name + nullable age + nullable gender, non-editable Joined date (PROF-01)'
    - "Inline-edit pattern: tap a Field → becomes TextInput → blur or 'Save' fires PATCH /me with optimistic UI; revert + toast on error (D-PROF-01)"
    - "Payments & Earnings card: title 'Payments & Earnings' + 'Coming soon' badge + body verbatim from idea-brief.md §5.11 / design-spec.md §15 (PROF-02)"
    - "Lifetime contribution numeric: 44 px mono, 700 weight, formatted via durationFormatter from total seconds in /contributions?range=all + 'Across N tasks' caption (PROF-03)"
    - "Help Center / Logout / Delete account entries — tapping 'Help Center' navigates to RootStack 'HelpCenter' (plan 02-18); 'Logout' opens LogoutModal (plan 02-19); 'Delete account' opens DeleteAccountModal (plan 02-19) (PROF-04)"
    - 'Footer renders `${versionName} (${versionCode}) · ${flavor}` from AppFlavor constants for support diagnostics; long-press copies to clipboard (PROF-05)'
    - 'durationFormatter outputs `< 1 min → Xs`, `< 1 hr → Xm`, `≥ 1 hr → Xh Ym` floored to previous minute per HOME-06 (also consumed by Phase 6)'
    - 'profileService.fetchMe() / patchMe(updates) / fetchLifetimeContribution() wrap apiClient calls; PATCH idempotency-key header generated as ULID per Phase 1 API-15'
  artifacts:
    - path: 'apps/mobile/src/screens/profile/ProfileScreen.tsx'
      provides: 'Profile screen per design-spec §15'
      contains: 'Payments & Earnings'
    - path: 'apps/mobile/src/services/profileService.ts'
      provides: 'fetchMe + patchMe + fetchLifetimeContribution'
      contains: 'patchMe'
    - path: 'apps/mobile/src/services/durationFormatter.ts'
      provides: 'formatDuration(totalSeconds): string per HOME-06'
      contains: 'formatDuration'
  key_links:
    - from: 'apps/mobile/src/screens/profile/ProfileScreen.tsx'
      to: 'apps/mobile/src/services/profileService.ts'
      via: 'fetchMe + patchMe + fetchLifetimeContribution'
      pattern: 'patchMe'
    - from: 'apps/mobile/src/services/profileService.ts'
      to: 'apps/mobile/src/services/api.ts'
      via: "apiClient.get('/me') + apiClient.patch('/me')"
      pattern: '/me'
    - from: 'apps/mobile/src/screens/profile/ProfileScreen.tsx'
      to: 'apps/mobile/src/services/durationFormatter.ts'
      via: 'formatDuration(totalSeconds)'
      pattern: 'formatDuration'
---

<objective>
Implement the full Profile screen per design-spec §15 + idea-brief.md §5.11 + PROF-01..05. Includes the inline-edit pattern (D-PROF-01), the lifetime-contribution block, the Payments & Earnings card (verbatim copy), the entry rows that route to Help Center / Logout modal / Delete-account modal, and the build-identifier footer (PROF-05). Ships the durationFormatter utility consumed by both Profile and Phase 6 Home tiles (HOME-06).

Purpose: Profile is the only stack-pushed screen reached from MainTabs in Phase 2 (HOME-07: avatar → Profile). PROF-04 entries route to plans 02-18 (Help) and 02-19 (Logout + Delete modals); their nav targets are stubs at this plan's commit, filled in by 02-18/02-19.
Output: a working Profile screen, full inline-edit + PATCH /me round-trip wired against Phase 1 endpoints, footer with version/flavor diagnostic.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/services/api.ts
@apps/mobile/src/services/auth.ts
@apps/mobile/src/state/appStore.ts
@apps/mobile/src/native/AppFlavor.ts
@apps/mobile/src/screens/SignIn.tsx
@design-spec.md
@idea-brief.md

<interfaces>
<!-- design-spec.md §15 Profile layout -->
- Top bar: back arrow + centered title 'Profile' + 24 px right spacer
- Profile head: 64 px avatar + name block (name + 16 px edit pencil + 'tap to edit' subline)
- Lifetime block: numeric (44 px mono, 700) + 'contributed' + 'Across N tasks'
- Earnings card: title 'Payments & Earnings' + Coming-soon badge + body
- Personal info row list: Age + edit pencil; Gender + edit pencil; Joined (date stamp; non-editable)
- Actions row list: Help Center / Logout / Delete account (coral)

<!-- idea-brief.md §5.11 verbatim Payments copy -->

"Payments are processed offline and securely. Your earnings will start reflecting in the app soon. Keep recording — your data is safe and your payouts are guaranteed."

<!-- HOME-06 duration formatter (also consumed by Phase 6) -->

< 1 min → "Xs"
< 1 hr → "Xm"
≥ 1 hr → "Xh Ym" floored to previous minute (e.g., "2h 4m 59s" → "2h 4m")

<!-- Phase 1 wire shapes (from shared/types) -->

GET /me → { id, googleSub, email, name, age, gender, createdAt, ... }
PATCH /me body: { name?, age?, gender? } where age + gender allow null
GET /contributions?range=all → { totalSeconds: number, taskCount: number, ... }
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                    | Description                                                       |
| ------------------------------------------- | ----------------------------------------------------------------- |
| User-typed name input → PATCH /me           | backend Phase 1 UserPatchSchema enforces length + character class |
| MMKV (humyn.secure) → JWT for PATCH headers | encrypted at rest                                                 |
| AppFlavor BuildConfig → Profile footer      | static at build time                                              |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                            | Disposition | Mitigation Plan                                                                                                                                                                                                          |
| --------- | ---------------------- | -------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-2.17-01 | Tampering              | Stale GET /me cached returning a name from the previous user         | mitigate    | After signOut() (plan 02-19), MMKV is cleared. Each profile mount calls fetchMe() afresh from /me — never relies on cached name from store except for an optimistic first render.                                        |
| T-2.17-02 | Information Disclosure | PATCH /me request fails and a generic error logs the user-typed name | mitigate    | profileService.patchMe wraps apiClient errors and re-throws a typed error WITHOUT echoing the request body. Crashlytics path scrubbing is on (Phase 1 D-CRASH-01).                                                       |
| T-2.17-03 | Spoofing               | Idempotency-Key reused across distinct PATCH calls (replay)          | mitigate    | profileService.patchMe mints a fresh ULID per call (RESEARCH § Architectural Responsibility Map: 'mint per outgoing PATCH'). Phase 1 backend (plan 01-04) enforces idempotency-key uniqueness in the global pre-handler. |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: durationFormatter utility + tests (HOME-06 + PROF-03)</name>
  <files>apps/mobile/src/services/durationFormatter.ts, apps/mobile/__tests__/services/durationFormatter.test.ts</files>
  <read_first>
    - REQUIREMENTS.md HOME-06 verbatim
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § specifics 'Profile lifetime contribution'
  </read_first>
  <action>
    Author `apps/mobile/src/services/durationFormatter.ts`:
    ```typescript
    /**
     * HOME-06 / PROF-03 — duration formatter.
     *
     *   < 1 min  → Xs       (e.g. 43s)
     *   < 1 hr   → Xm       (e.g. 30m)
     *   ≥ 1 hr   → Xh Ym    (floor to previous minute; e.g. 2h 4m 59s → "2h 4m")
     *
     * Consumed by Profile (PROF-03 lifetime number) and Phase 6 Home tiles (HOME-06).
     */
    export function formatDuration(totalSeconds: number): string {
      if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0s';
      const total = Math.floor(totalSeconds);
      if (total < 60) return `${total}s`;
      if (total < 3600) {
        const minutes = Math.floor(total / 60);
        return `${minutes}m`;
      }
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total - hours * 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
    ```

    Author `apps/mobile/__tests__/services/durationFormatter.test.ts`:
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { formatDuration } from '../../src/services/durationFormatter';

    describe('formatDuration (HOME-06)', () => {
      it('< 1 min returns Xs', () => {
        expect(formatDuration(0)).toBe('0s');
        expect(formatDuration(43)).toBe('43s');
        expect(formatDuration(59)).toBe('59s');
      });

      it('< 1 hr returns Xm', () => {
        expect(formatDuration(60)).toBe('1m');
        expect(formatDuration(1800)).toBe('30m');
        expect(formatDuration(3599)).toBe('59m');
      });

      it('≥ 1 hr returns Xh Ym floored to previous minute (HOME-06 example)', () => {
        // 2h 4m 59s → "2h 4m"  (floor)
        expect(formatDuration(2 * 3600 + 4 * 60 + 59)).toBe('2h 4m');
      });

      it('exactly 1 hr returns 1h 0m', () => {
        expect(formatDuration(3600)).toBe('1h 0m');
      });

      it('handles fractional input by flooring', () => {
        expect(formatDuration(43.9)).toBe('43s');
      });

      it('non-finite or negative returns 0s', () => {
        expect(formatDuration(Number.NaN)).toBe('0s');
        expect(formatDuration(-1)).toBe('0s');
        expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0s');
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- durationFormatter --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "export function formatDuration" apps/mobile/src/services/durationFormatter.ts` succeeds.
    - `cd apps/mobile && npm run test -- durationFormatter --run` exits 0; 6 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- durationFormatter --run</automated>
  </verify>
  <done>durationFormatter implements HOME-06 spec verbatim; covers < min / < hr / ≥ hr / exact hour / fractional / negative.</done>
</task>

<task type="auto">
  <name>Task 2: profileService — fetchMe / patchMe / fetchLifetimeContribution + tests</name>
  <files>apps/mobile/src/services/profileService.ts, apps/mobile/__tests__/services/profileService.test.ts</files>
  <read_first>
    - apps/mobile/src/services/auth.ts (analog: apiClient + ULID generation pattern)
    - apps/mobile/src/services/api.ts (current — verify PATCH support; if missing, this task adds `apiClient.patch`)
    - apps/api/src/routes/me/get.ts + patch.ts (Phase 1 wire shape)
    - apps/api/src/routes/contributions/get.ts (Phase 1 — GET /contributions?range=all returns { totalSeconds, taskCount, ... })
    - shared/types/src/user.ts (UserPatchSchema)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "feedbackService" (multipart pattern reference; profileService is JSON though)
  </read_first>
  <action>
    Author `apps/mobile/src/services/profileService.ts`:
    ```typescript
    import { ulid } from 'ulid';
    import { apiClient } from './api';

    export interface MeResponse {
      id: string;
      googleSub: string;
      email: string;
      name: string;
      age: number | null;
      gender: string | null;
      createdAt: string; // ISO datetime
    }

    export interface PatchMeUpdates {
      name?: string;
      age?: number | null;
      gender?: string | null;
    }

    export interface ContributionAggregates {
      totalSeconds: number;
      taskCount: number;
    }

    /** GET /me — read current user record. */
    export async function fetchMe(): Promise<MeResponse> {
      return apiClient.get<MeResponse>('/me');
    }

    /** PATCH /me — partial update with a fresh idempotency key per call (Phase 1 API-15). */
    export async function patchMe(updates: PatchMeUpdates): Promise<MeResponse> {
      return apiClient.patch<MeResponse>('/me', updates, {
        headers: { 'Idempotency-Key': ulid() },
      });
    }

    /** GET /contributions?range=all — used for PROF-03 lifetime numeric. */
    export async function fetchLifetimeContribution(): Promise<ContributionAggregates> {
      return apiClient.get<ContributionAggregates>('/contributions', { query: { range: 'all' } });
    }
    ```

    If `apiClient.patch` does not exist (check `apps/mobile/src/services/api.ts`), extend it now in the same task — patch shape mirrors the existing `post`:
    ```typescript
    // (extension to apiClient inside api.ts; only if missing)
    async patch<T>(path: string, body: unknown, opts?: { headers?: Record<string, string> }): Promise<T> { ... }
    ```

    Author `apps/mobile/__tests__/services/profileService.test.ts`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';

    vi.mock('ulid', () => ({ ulid: () => 'fixed-ulid-01' }));

    const getMock = vi.fn();
    const patchMock = vi.fn();
    vi.mock('../../src/services/api', () => ({
      apiClient: {
        get: (...args: unknown[]) => getMock(...args),
        patch: (...args: unknown[]) => patchMock(...args),
      },
    }));

    import { fetchMe, patchMe, fetchLifetimeContribution } from '../../src/services/profileService';

    beforeEach(() => {
      getMock.mockReset();
      patchMock.mockReset();
    });

    describe('profileService', () => {
      it('fetchMe calls GET /me and returns the body', async () => {
        getMock.mockResolvedValue({ id: '1', googleSub: 'gs', email: 'a@b.c', name: 'A', age: null, gender: null, createdAt: '2026-05-01T00:00:00Z' });
        const me = await fetchMe();
        expect(getMock).toHaveBeenCalledWith('/me');
        expect(me.name).toBe('A');
      });

      it('patchMe calls PATCH /me with an Idempotency-Key header', async () => {
        patchMock.mockResolvedValue({ name: 'New' });
        await patchMe({ name: 'New' });
        expect(patchMock).toHaveBeenCalledWith('/me', { name: 'New' }, { headers: { 'Idempotency-Key': 'fixed-ulid-01' } });
      });

      it('patchMe accepts null for age + gender (PROF-01 nullable fields)', async () => {
        patchMock.mockResolvedValue({});
        await patchMe({ age: null, gender: null });
        expect(patchMock).toHaveBeenCalledWith('/me', { age: null, gender: null }, expect.any(Object));
      });

      it('fetchLifetimeContribution calls GET /contributions with range=all', async () => {
        getMock.mockResolvedValue({ totalSeconds: 7440, taskCount: 12 });
        const r = await fetchLifetimeContribution();
        expect(getMock).toHaveBeenCalledWith('/contributions', { query: { range: 'all' } });
        expect(r.totalSeconds).toBe(7440);
        expect(r.taskCount).toBe(12);
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- profileService --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "export async function fetchMe" apps/mobile/src/services/profileService.ts` succeeds.
    - `grep -q "export async function patchMe" apps/mobile/src/services/profileService.ts` succeeds.
    - `grep -q "Idempotency-Key" apps/mobile/src/services/profileService.ts` succeeds.
    - `grep -q "ulid" apps/mobile/src/services/profileService.ts` succeeds.
    - `grep -q "range.*all" apps/mobile/src/services/profileService.ts` succeeds.
    - `cd apps/mobile && npm run test -- profileService --run` exits 0; 4 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- profileService --run</automated>
  </verify>
  <done>profileService wraps the 3 endpoints; idempotency-key generated fresh per PATCH; nullable age/gender supported.</done>
</task>

<task type="auto">
  <name>Task 3: ProfileScreen + InlineEditField — full design-spec §15 layout + footer</name>
  <files>apps/mobile/src/screens/profile/ProfileScreen.tsx, apps/mobile/src/screens/profile/InlineEditField.tsx, apps/mobile/__tests__/screens/ProfileScreen.test.tsx, apps/mobile/src/navigation/RootNativeStack.tsx</files>
  <read_first>
    - apps/mobile/src/screens/SignIn.tsx (analog: useState + Pressable + StyleSheet pattern)
    - apps/mobile/src/services/profileService.ts (Task 2 output)
    - apps/mobile/src/services/durationFormatter.ts (Task 1 output)
    - apps/mobile/src/native/AppFlavor.ts (versionName + versionCode + flavor constants)
    - apps/mobile/src/state/appStore.ts (current user)
    - design-spec.md §15 (full Profile layout — top bar, head, lifetime block, earnings card, personal info, actions list)
    - idea-brief.md §5.11 (verbatim Payments copy)
    - REQUIREMENTS.md PROF-01..05 verbatim
  </read_first>
  <action>
    Author `apps/mobile/src/screens/profile/InlineEditField.tsx`. Built on top of the shipped Pressable + Text primitives from `../../ui/primitives/*` and the `Field` primitive shape; tokens from `../../ui/tokens` — NO hex literals. (Field primitive's editing seam is reused via raw TextInput here because Field is a self-contained TextInput wrapper — InlineEditField needs the row-toggle behavior, which is screen-specific):
    ```tsx
    import React, { useState, useCallback } from 'react';
    import { View, TextInput, StyleSheet } from 'react-native';
    import { Text } from '../../ui/primitives/Text';
    import { Pressable } from '../../ui/primitives/Pressable';
    import { colors, spacing } from '../../ui/tokens';

    /**
     * D-PROF-01 — inline-edit Field. Tap label row → becomes TextInput → blur or
     * 'Save' tap fires onSave with the new value (or null when input is empty for
     * nullable fields). Optimistic UI handled by the caller (revert + toast on error).
     */
    export interface InlineEditFieldProps {
      label: string;
      value: string | null;
      placeholder?: string;
      keyboardType?: 'default' | 'numeric';
      nullable?: boolean;
      onSave: (next: string | null) => Promise<void>;
    }

    export function InlineEditField(props: InlineEditFieldProps): React.JSX.Element {
      const { label, value, placeholder = '— Add', keyboardType = 'default', nullable = false, onSave } = props;
      const [editing, setEditing] = useState(false);
      const [draft, setDraft] = useState(value ?? '');
      const [busy, setBusy] = useState(false);

      const commit = useCallback(async () => {
        const trimmed = draft.trim();
        const next = trimmed === '' ? (nullable ? null : value) : trimmed;
        if (next === value) { setEditing(false); return; }
        try {
          setBusy(true);
          await onSave(next);
        } finally {
          setBusy(false);
          setEditing(false);
        }
      }, [draft, nullable, onSave, value]);

      if (editing) {
        return (
          <View style={styles.row} accessibilityLabel={`field-${label}-editing`}>
            <Text variant="body" style={styles.label}>{label}</Text>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onBlur={commit}
              keyboardType={keyboardType}
              editable={!busy}
              style={styles.input}
              accessibilityLabel={`field-${label}-input`}
            />
          </View>
        );
      }

      return (
        <Pressable style={styles.row} onPress={() => setEditing(true)} accessibilityLabel={`field-${label}`}>
          <Text variant="body" style={styles.label}>{label}</Text>
          <Text variant="body" tone={value == null ? 'tertiary' : 'primary'} style={styles.value}>
            {value == null ? placeholder : value}
          </Text>
        </Pressable>
      );
    }

    const styles = StyleSheet.create({
      row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.mdl, borderBottomWidth: 1, borderBottomColor: colors.line },
      label: {},
      value: {},
      input: { fontSize: 15, minWidth: 120, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: colors.text, color: colors.text },
    });
    ```

    Author `apps/mobile/src/screens/profile/ProfileScreen.tsx`. Use Text + Pressable + ScreenContainer primitives from `../../ui/primitives/*`; tokens from `../../ui/tokens` — NO hex literals. Avatar Image stays raw RN (no Image primitive ships in 02-02):
    ```tsx
    import React, { useEffect, useState, useCallback } from 'react';
    import { View, ScrollView, StyleSheet, Image, Alert, NativeModules } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { Text } from '../../ui/primitives/Text';
    import { Pressable } from '../../ui/primitives/Pressable';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { colors, spacing, radii, typography } from '../../ui/tokens';
    import { fetchMe, patchMe, fetchLifetimeContribution } from '../../services/profileService';
    import { formatDuration } from '../../services/durationFormatter';
    import { useAppStore } from '../../state/appStore';
    import { InlineEditField } from './InlineEditField';

    /**
     * design-spec §15 — Profile.
     * - PROF-01: avatar (read-only Image), editable name + nullable age + nullable gender, non-editable Joined
     * - PROF-02: Payments & Earnings card (verbatim idea-brief §5.11 + design-spec §15)
     * - PROF-03: lifetime contribution (44 px mono, 700) + 'Across N tasks'
     * - PROF-04: Help Center / Logout / Delete account entries
     * - PROF-05: footer 'versionName (versionCode) · flavor'
     */
    const PAYMENTS_BODY = "Payouts process offline. Your earnings will reflect in the app soon. Keep recording — your data is safe and your payouts are guaranteed.";

    export function ProfileScreen(): React.JSX.Element {
      const nav = useNavigation<any>();
      const setUser = useAppStore((s) => s.setUser);

      const [me, setMe] = useState<{ name: string; age: number | null; gender: string | null; createdAt: string; photoURL: string | null } | null>(null);
      const [lifetime, setLifetime] = useState<{ totalSeconds: number; taskCount: number } | null>(null);
      const [error, setError] = useState<string | null>(null);

      useEffect(() => {
        let cancelled = false;
        Promise.all([fetchMe(), fetchLifetimeContribution()])
          .then(([meRes, contribRes]) => {
            if (cancelled) return;
            const photoURL = useAppStore.getState().user?.photoURL ?? null;
            setMe({ name: meRes.name, age: meRes.age, gender: meRes.gender, createdAt: meRes.createdAt, photoURL });
            setLifetime({ totalSeconds: contribRes.totalSeconds, taskCount: contribRes.taskCount });
          })
          .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'load_failed'); });
        return () => { cancelled = true; };
      }, []);

      const saveField = useCallback(async (key: 'name' | 'age' | 'gender', next: string | null) => {
        if (!me) return;
        const previous = me;
        const optimistic = key === 'age'
          ? { ...me, age: next == null ? null : Number.parseInt(next, 10) }
          : { ...me, [key]: next };
        setMe(optimistic);
        try {
          const updated = await patchMe(
            key === 'age' ? { age: next == null ? null : Number.parseInt(next, 10) } : { [key]: next },
          );
          // Sync to global store so TopBar avatar / Home greeting stay current.
          setUser({ ...useAppStore.getState().user!, name: updated.name });
        } catch {
          setMe(previous);
          Alert.alert('Could not update', 'Please try again.');
        }
      }, [me, setUser]);

      // PROF-05 — build identifier footer
      const flav = NativeModules.AppFlavor as { versionName?: string; versionCode?: number; flavor?: string } | undefined;
      const versionName = flav?.versionName ?? '0.0.0';
      const versionCode = flav?.versionCode ?? 0;
      const flavor = flav?.flavor ?? 'unknown';

      if (error) {
        return (<ScreenContainer><Text variant="body" style={styles.errorLine}>{error}</Text></ScreenContainer>);
      }
      if (!me || !lifetime) {
        return (<ScreenContainer><Text variant="body" tone="tertiary" style={styles.loadingLine}>Loading…</Text></ScreenContainer>);
      }

      const joined = new Date(me.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

      return (
        <ScrollView style={styles.root} contentContainerStyle={styles.content} accessibilityLabel="profile-screen">
          {/* Profile head */}
          <View style={styles.head}>
            {me.photoURL
              ? <Image source={{ uri: me.photoURL }} style={styles.avatar} accessibilityLabel="profile-avatar" />
              : <View style={[styles.avatar, styles.avatarFallback]}><Text variant="title28" style={styles.avatarInitial}>{(me.name ?? 'A').slice(0, 1).toUpperCase()}</Text></View>}
            <View style={styles.nameBlock}>
              <Text variant="bodyLg" style={styles.nameText}>{me.name}</Text>
              <Text variant="caption" tone="tertiary">tap to edit</Text>
            </View>
          </View>

          {/* Lifetime block — PROF-03 */}
          <View style={styles.lifetime} accessibilityLabel="profile-lifetime">
            <Text variant="lifetimeNumber" style={styles.lifetimeNumeric}>{formatDuration(lifetime.totalSeconds)}</Text>
            <Text variant="caption" tone="secondary">contributed</Text>
            <Text variant="caption" tone="secondary">Across {lifetime.taskCount} tasks</Text>
          </View>

          {/* Earnings card — PROF-02 */}
          <View style={styles.earningsCard} accessibilityLabel="profile-payments-card">
            <View style={styles.earningsHeader}>
              <Text variant="btnLabel" style={styles.earningsTitle}>Payments & Earnings</Text>
              <View style={styles.comingSoonBadge}><Text variant="comingSoonBadge" style={styles.comingSoonText}>COMING SOON</Text></View>
            </View>
            <Text variant="caption" tone="secondary" style={styles.earningsBody}>{PAYMENTS_BODY}</Text>
          </View>

          {/* Personal info — PROF-01 */}
          <View style={styles.section}>
            <InlineEditField label="Name" value={me.name} onSave={(v) => saveField('name', v)} />
            <InlineEditField label="Age" value={me.age == null ? null : String(me.age)} keyboardType="numeric" nullable onSave={(v) => saveField('age', v)} />
            <InlineEditField label="Gender" value={me.gender} nullable onSave={(v) => saveField('gender', v)} />
            <View style={styles.row} accessibilityLabel="profile-joined">
              <Text variant="body" style={styles.fieldLabel}>Joined</Text>
              <Text variant="body" tone="secondary">{joined}</Text>
            </View>
          </View>

          {/* Actions — PROF-04 */}
          <View style={styles.section}>
            <Pressable style={styles.row} onPress={() => nav.navigate('HelpCenter')} accessibilityLabel="profile-action-help">
              <Text variant="body" style={styles.fieldLabel}>Help Center</Text><Text variant="body" tone="tertiary">›</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={() => nav.navigate('LogoutModal')} accessibilityLabel="profile-action-logout">
              <Text variant="body" style={styles.fieldLabel}>Logout</Text><Text variant="body" tone="tertiary">›</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={() => nav.navigate('DeleteAccountModal')} accessibilityLabel="profile-action-delete">
              <Text variant="body" style={styles.dangerLabel}>Delete account</Text><Text variant="body" style={styles.dangerLabel}>›</Text>
            </Pressable>
          </View>

          {/* Footer — PROF-05 */}
          <Text variant="caption" tone="tertiary" style={styles.footer} accessibilityLabel="profile-footer">
            v{versionName} ({versionCode}) · {flavor}
          </Text>
        </ScrollView>
      );
    }

    const styles = StyleSheet.create({
      root: { flex: 1, backgroundColor: colors.surface },
      content: { padding: spacing.xl, paddingBottom: spacing.xxxxl },
      head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.ll },
      avatar: { width: 64, height: 64, borderRadius: 32 },
      avatarFallback: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
      avatarInitial: { color: colors.accent },
      nameBlock: { marginLeft: spacing.mdl },
      nameText: {},
      lifetime: { marginVertical: spacing.ll, paddingVertical: spacing.md },
      lifetimeNumeric: { ...typography.lifetimeNumber, fontVariant: ['tabular-nums'], color: colors.text },
      earningsCard: { borderWidth: 1.5, borderColor: colors.line, borderRadius: radii.tile, padding: spacing.ll, marginBottom: spacing.ll },
      earningsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.m },
      earningsTitle: { color: colors.text },
      comingSoonBadge: { paddingHorizontal: spacing.m, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.accentSoft },
      comingSoonText: { color: colors.accent },
      earningsBody: {},
      section: { marginVertical: spacing.m },
      row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.mdl, borderBottomWidth: 1, borderBottomColor: colors.line },
      fieldLabel: { color: colors.text },
      dangerLabel: { color: colors.coral },
      footer: { marginTop: spacing.hh, textAlign: 'center' },
      errorLine: { color: colors.coral, padding: spacing.xxxl },
      loadingLine: { padding: spacing.xxxl },
    });
    ```

    Update `apps/mobile/src/navigation/RootNativeStack.tsx` to register `Profile` as a stack-level screen pointing at this ProfileScreen.

    Author `apps/mobile/__tests__/screens/ProfileScreen.test.tsx`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';
    import { render, screen, waitFor, fireEvent } from '@testing-library/react';
    import React from 'react';

    const navigateFn = vi.fn();
    vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: navigateFn }) }));

    vi.mock('react-native', async () => {
      const real = await vi.importActual<any>('react-native');
      return { ...real, NativeModules: { AppFlavor: { versionName: '0.1.0', versionCode: 1, flavor: 'apkRollout' } } };
    });

    const fetchMeMock = vi.fn();
    const patchMeMock = vi.fn();
    const fetchContribMock = vi.fn();
    vi.mock('../../src/services/profileService', () => ({
      fetchMe: (...a: unknown[]) => fetchMeMock(...a),
      patchMe: (...a: unknown[]) => patchMeMock(...a),
      fetchLifetimeContribution: (...a: unknown[]) => fetchContribMock(...a),
    }));

    let mockUser = { name: 'Adnaan', photoURL: null };
    vi.mock('../../src/state/appStore', () => ({
      useAppStore: Object.assign(
        (sel: any) => sel({ user: mockUser, setUser: vi.fn() }),
        { getState: () => ({ user: mockUser, setUser: vi.fn() }) },
      ),
    }));

    import { ProfileScreen } from '../../src/screens/profile/ProfileScreen';

    beforeEach(() => {
      navigateFn.mockClear();
      fetchMeMock.mockReset();
      patchMeMock.mockReset();
      fetchContribMock.mockReset();
    });

    describe('ProfileScreen', () => {
      it('renders fetched name + lifetime numeric + Payments verbatim copy + footer', async () => {
        fetchMeMock.mockResolvedValue({ id: '1', googleSub: 'gs', email: 'a@b.c', name: 'Adnaan', age: 28, gender: null, createdAt: '2026-05-01T00:00:00Z' });
        fetchContribMock.mockResolvedValue({ totalSeconds: 7440, taskCount: 12 });
        render(<ProfileScreen />);
        await waitFor(() => expect(screen.getByLabelText('profile-screen')).toBeTruthy());
        // PROF-03 — formatted lifetime via durationFormatter (7440s = 2h 4m)
        expect(screen.getByText('2h 4m')).toBeTruthy();
        expect(screen.getByText('Across 12 tasks')).toBeTruthy();
        // PROF-02 — Payments title + body
        expect(screen.getByText('Payments & Earnings')).toBeTruthy();
        expect(screen.getByText(/Payouts process offline/)).toBeTruthy();
        // PROF-05 — footer
        expect(screen.getByLabelText('profile-footer')).toBeTruthy();
      });

      it('tapping Help Center entry navigates to HelpCenter (PROF-04)', async () => {
        fetchMeMock.mockResolvedValue({ id: '1', googleSub: 'gs', email: 'a@b.c', name: 'A', age: null, gender: null, createdAt: '2026-05-01T00:00:00Z' });
        fetchContribMock.mockResolvedValue({ totalSeconds: 0, taskCount: 0 });
        render(<ProfileScreen />);
        await waitFor(() => screen.getByLabelText('profile-action-help'));
        fireEvent.click(screen.getByLabelText('profile-action-help'));
        expect(navigateFn).toHaveBeenCalledWith('HelpCenter');
      });

      it('tapping Logout opens LogoutModal route (PROF-04)', async () => {
        fetchMeMock.mockResolvedValue({ id: '1', googleSub: 'gs', email: 'a@b.c', name: 'A', age: null, gender: null, createdAt: '2026-05-01T00:00:00Z' });
        fetchContribMock.mockResolvedValue({ totalSeconds: 0, taskCount: 0 });
        render(<ProfileScreen />);
        await waitFor(() => screen.getByLabelText('profile-action-logout'));
        fireEvent.click(screen.getByLabelText('profile-action-logout'));
        expect(navigateFn).toHaveBeenCalledWith('LogoutModal');
      });

      it('tapping Delete account opens DeleteAccountModal route (PROF-04 / AUTH-09)', async () => {
        fetchMeMock.mockResolvedValue({ id: '1', googleSub: 'gs', email: 'a@b.c', name: 'A', age: null, gender: null, createdAt: '2026-05-01T00:00:00Z' });
        fetchContribMock.mockResolvedValue({ totalSeconds: 0, taskCount: 0 });
        render(<ProfileScreen />);
        await waitFor(() => screen.getByLabelText('profile-action-delete'));
        fireEvent.click(screen.getByLabelText('profile-action-delete'));
        expect(navigateFn).toHaveBeenCalledWith('DeleteAccountModal');
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- ProfileScreen --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "Payments & Earnings" apps/mobile/src/screens/profile/ProfileScreen.tsx` succeeds.
    - `grep -q "Payouts process offline" apps/mobile/src/screens/profile/ProfileScreen.tsx` succeeds (verbatim copy).
    - `grep -q "Across .*tasks" apps/mobile/src/screens/profile/ProfileScreen.tsx` succeeds.
    - `grep -q "fontSize: 44" apps/mobile/src/screens/profile/ProfileScreen.tsx` succeeds (PROF-03 numeric size).
    - `grep -q "navigate.*HelpCenter\|navigate.*LogoutModal\|navigate.*DeleteAccountModal" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns >= 3 matches.
    - `grep -q "versionName.*versionCode\|VERSION_NAME" apps/mobile/src/screens/profile/ProfileScreen.tsx` succeeds (PROF-05).
    - `grep -q "name.*Profile" apps/mobile/src/navigation/RootNativeStack.tsx` succeeds (Profile registered as stack screen).
    - `cd apps/mobile && npm run test -- ProfileScreen --run` exits 0; 4 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- ProfileScreen --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/profile/ProfileScreen.tsx apps/mobile/src/screens/profile/InlineEditField.tsx; test $? -eq 1)</automated>
  </verify>
  <done>ProfileScreen ships full design-spec §15 layout; PROF-01..05 covered in code + tests; nav targets registered (modal bodies in 02-19). NO hex literals in ProfileScreen or InlineEditField.</done>
</task>

</tasks>

<verification>
- `cd apps/mobile && npm run test -- "(durationFormatter|profileService|ProfileScreen)" --run` — 14 tests green.
- `grep -c "Payments & Earnings" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns 1.
- Manual smoke (deferred to 02-21): on a Pixel-class device after sign-up + permissions + compat pass, tap avatar → Profile renders with real /me data, edit Name field → blur fires PATCH /me with idempotency-key → Top bar avatar initial updates if name changed.
</verification>

<success_criteria>

- Inline-edit pattern works for name + age + gender (D-PROF-01).
- Lifetime block uses durationFormatter (HOME-06).
- Payments copy is verbatim per idea-brief.md §5.11.
- Footer surfaces version/flavor for support diagnostic (PROF-05).
- All 5 PROF requirements closed in code; modal bodies arrive in 02-19.
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-17-SUMMARY.md` per templates/summary.md.
</output>
