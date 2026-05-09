---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 19
id: 02-19-logout-and-delete-account
name: LogoutModal + DeleteAccountModal (DELETE-typing gate) + auth.signOut + DELETE /me wiring
type: execute
wave: 4
depends_on: [02-17-profile-screen, 02-09-signup-screen-and-terms-modal]
files_modified:
  - apps/mobile/src/components/LogoutModal.tsx
  - apps/mobile/src/components/DeleteAccountModal.tsx
  - apps/mobile/src/services/auth.ts
  - apps/mobile/src/services/profileService.ts
  - apps/mobile/__tests__/components/LogoutModal.test.tsx
  - apps/mobile/__tests__/components/DeleteAccountModal.test.tsx
  - apps/mobile/src/navigation/RootNativeStack.tsx
autonomous: true
requirements: [AUTH-08, AUTH-09, AUTH-10]
must_haves:
  truths:
    - "LogoutModal: design-spec §18.3 'Log out?' / 'You'll need to sign in again to keep contributing.' / [Cancel | Log out]"
    - "Tap 'Log out' calls auth.signOut() — clears MMKV humyn.secure JWT (auth.jwt.v1) and onboarding.* keys EXCEPT compat.lastResult.v1 (compat result is device-bound, not user-bound; saves a re-run on same-device re-login per CONTEXT decisions)"
    - "After signOut: navigation.reset to OnboardingStack/Signup (D-DEL-01 / engineering-handoff §3.3 'no back to splash/sign-up')"
    - "DeleteAccountModal: design-spec §18.4 step 1 — informational confirmation 'Your account will be deactivated for 30 days...' (verbatim) + [Cancel | Continue to delete]"
    - "DeleteAccountModal step 2 — 'Type DELETE to confirm.' modal; the API call ONLY fires when typed text === 'DELETE' (case-sensitive). Backend Phase 1 also enforces ?confirm=DELETE (defense-in-depth per RESEARCH § Security threat row 5)"
    - "Tap Confirm with valid 'DELETE' input → profileService.deleteMe() → DELETE /me?confirm=DELETE with idempotency-key → on 200, clear ALL MMKV humyn.secure keys → navigation.reset to OnboardingStack/Signup (AUTH-09)"
    - "Phase 2 logout 'cancels in-flight upload preserves queue' is a no-op — upload pipeline ships in Phase 5; signOut() leaves a documented seam (// TODO Phase 5: cancelInFlightUpload + preserveQueue) so 02-21 phase gate doesn't re-litigate (CONTEXT § Phase Boundary 'Logout placeholder hook')"
  artifacts:
    - path: 'apps/mobile/src/components/LogoutModal.tsx'
      provides: 'Logout confirmation per design-spec §18.3 + auth.signOut wiring'
      contains: "auth.signOut\\|signOut\\(\\)"
    - path: 'apps/mobile/src/components/DeleteAccountModal.tsx'
      provides: 'Two-step delete confirmation with DELETE-typing gate'
      contains: 'DELETE'
    - path: 'apps/mobile/src/services/profileService.ts'
      provides: 'Extended with deleteMe()'
      contains: 'deleteMe'
    - path: 'apps/mobile/src/services/auth.ts'
      provides: 'Extended with signOut() if not already shipped from 02-09'
      contains: 'signOut'
  key_links:
    - from: 'apps/mobile/src/components/LogoutModal.tsx'
      to: 'apps/mobile/src/services/auth.ts'
      via: 'signOut() call'
      pattern: 'signOut'
    - from: 'apps/mobile/src/components/DeleteAccountModal.tsx'
      to: 'apps/mobile/src/services/profileService.ts'
      via: 'deleteMe() call'
      pattern: 'deleteMe'
---

<objective>
Implement the two Profile-action modals and their backend wiring: LogoutModal (calls auth.signOut, clears JWT, returns to Sign-up) and DeleteAccountModal (two-step with DELETE-typing gate, hits DELETE /me?confirm=DELETE, clears all MMKV, returns to Sign-up).

Purpose: Closes AUTH-08 (logout client-side), AUTH-09 (30-day soft-delete), AUTH-10 (DELETE-typing gate). The actual 30-day soft-delete is server-side from Phase 1 (`/me/restore` endpoint exists); Phase 2 only ships the client surface and trusts the backend to set the deletedAt window.
Output: working modals routed from Profile rows; on Logout/Delete the user lands back at Sign-up via `navigation.reset`; backend round-trips covered by mocks in tests.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/services/auth.ts
@apps/mobile/src/services/api.ts
@apps/mobile/src/services/profileService.ts
@apps/mobile/src/state/appStore.ts
@apps/api/src/routes/me/delete.ts
@design-spec.md

<interfaces>
<!-- design-spec §18.3 Logout confirm -->
Title: "Log out?"
Body: "You'll need to sign in again to keep contributing."
Actions: [Cancel | Log out]

<!-- design-spec §18.4 Delete account confirm — TWO STEPS -->

Step 1:
Title: "Delete your Humyn account?"
Body: "Your account will be deactivated for 30 days. Log in within that window to restore it. After 30 days, deletion is permanent. Recordings already uploaded remain on our servers."
Actions: [Cancel | Continue to delete]
Step 2:
Title: "Type DELETE to confirm."
Input + [Cancel | Confirm]
Confirm enabled ONLY when typed text === 'DELETE' (case-sensitive)

<!-- DELETE /me wire shape (Phase 1) -->

DELETE /me?confirm=DELETE
-> 200 OK with empty body when confirm query param matches the literal string "DELETE"
-> 400 Bad Request RFC 7807 otherwise (MeDeleteQuerySchema validation)

<!-- D-DEL-01 — client cleanup -->

On signOut: clear humyn.secure JWT + onboarding.\* keys (NOT compat.lastResult.v1)
On deleteMe success: clear ALL humyn.secure keys
Both: navigation.reset({ index: 0, routes: [{ name: 'Signup' }] })
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                           | Description                                   |
| -------------------------------------------------- | --------------------------------------------- |
| User clicks Logout/Delete in JS → MMKV/JWT cleanup | encrypted at rest                             |
| DELETE /me?confirm=DELETE                          | Phase 1 backend validates confirm query param |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                       | Disposition | Mitigation Plan                                                                                                                                                                                                                        |
| --------- | ---------------------- | ------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.19-01 | Tampering              | User bypasses DELETE-typing gate via Hermes debugger / JS console / patched APK | mitigate    | Per RESEARCH § Security threat row 5: backend `DELETE /me?confirm=DELETE` enforces the literal query param at MeDeleteQuerySchema; client-side gate is UX defense-in-depth, backend is binding. Already shipped in Phase 1 plan 01-04. |
| T-2.19-02 | Spoofing               | DELETE /me replayed (idempotency-key reuse)                                     | mitigate    | profileService.deleteMe mints a fresh ULID per call. Backend Phase 1 plan 01-08 ships per-applicationId rate-limit on DELETE /me (5/min) keyed by 'delete-me:${applicationId}' (Pattern 29).                                           |
| T-2.19-03 | Information Disclosure | JWT not cleared after signOut                                                   | mitigate    | auth.signOut explicitly calls mmkv.delete('auth.jwt.v1') first. Test asserts the key is gone post-call.                                                                                                                                |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: auth.signOut + profileService.deleteMe + tests</name>
  <files>apps/mobile/src/services/auth.ts, apps/mobile/src/services/profileService.ts, apps/mobile/__tests__/services/auth.signOut.test.ts, apps/mobile/__tests__/services/profileService.deleteMe.test.ts</files>
  <read_first>
    - apps/mobile/src/services/auth.ts (current — verify signOut already shipped in 02-09 per its must_haves; if scaffold-only, fill in here)
    - apps/mobile/src/services/profileService.ts (Plan 02-17 output — extends with deleteMe)
    - apps/mobile/src/services/api.ts (verify apiClient.delete; if missing, extend)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-DEL-01
    - apps/api/src/routes/me/delete.ts (Phase 1 wire — confirm=DELETE query param)
    - apps/mobile/src/state/keys.ts (MMKV key constants)
  </read_first>
  <action>
    Extend `apps/mobile/src/services/auth.ts` with `signOut`:
    ```typescript
    /**
     * AUTH-08 — clear JWT + onboarding flags from MMKV.
     *
     * Does NOT clear `compat.lastResult.v1` — that result is device-bound (signature
     * embeds installation_id), not user-bound. A user logging out and re-signing-in
     * on the same device should NOT need to re-run the 30-second compat check.
     *
     * Phase 5 will extend signOut to cancel in-flight uploads + preserve the queue
     * (idea-brief.md §10 'Logout while uploads pending'). Documented seam below.
     */
    export function signOut(): void {
      mmkv.delete('auth.jwt.v1');
      // Onboarding flags — clear so the next user goes through Signup → Permissions → Compat (gate-decision tree).
      mmkv.delete('onboarding.consent.v1');
      mmkv.delete('onboarding.permsGranted.v1');
      mmkv.delete('onboarding.compatPassed.v1');
      mmkv.delete('onboarding.tutorialDone.v1');
      // NOTE: compat.lastResult.v1 + installation_id.v1 + telemetry.ring.v1 + appVersion.cache.v1 are device-bound; preserved.
      // TODO Phase 5: cancelInFlightUpload(); preserveQueueForResumeOnReLogin();
    }
    ```

    If signOut already shipped in 02-09, verify it follows the above shape — patch any deviations (e.g., if it clears compat.lastResult.v1, remove that line).

    Extend `apps/mobile/src/services/profileService.ts` with `deleteMe`:
    ```typescript
    /**
     * AUTH-09 — soft-delete account. Backend Phase 1 sets deletedAt = now(); 30-day
     * window for re-sign-in restore. Permanent deletion runs as a server-side cron.
     *
     * AUTH-10 enforced client-side at the UI level (DeleteAccountModal); backend
     * also enforces ?confirm=DELETE per Phase 1 MeDeleteQuerySchema (defense in depth).
     */
    export async function deleteMe(): Promise<void> {
      await apiClient.delete('/me', {
        query: { confirm: 'DELETE' },
        headers: { 'Idempotency-Key': ulid() },
      });
    }
    ```

    Author `apps/mobile/__tests__/services/auth.signOut.test.ts` — mock the MMKV singleton, call signOut, assert: (1) auth.jwt.v1 deleted, (2) onboarding.consent.v1 deleted, (3) onboarding.compatPassed.v1 deleted, (4) compat.lastResult.v1 PRESERVED, (5) installation_id.v1 PRESERVED.

    Author `apps/mobile/__tests__/services/profileService.deleteMe.test.ts` — mock apiClient.delete, call deleteMe, assert it was called with `('/me', { query: { confirm: 'DELETE' }, headers: { 'Idempotency-Key': '<ULID>' } })`.

    Run `cd apps/mobile && npm run test -- "auth.signOut|profileService.deleteMe" --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "export function signOut\|export async function signOut" apps/mobile/src/services/auth.ts` succeeds.
    - `grep -q "auth.jwt.v1" apps/mobile/src/services/auth.ts` succeeds.
    - `grep -v '^[[:space:]]*//' apps/mobile/src/services/auth.ts | grep -c "mmkv.delete.*compat.lastResult" returns 0` (compat result preserved on logout).
    - `grep -q "export async function deleteMe" apps/mobile/src/services/profileService.ts` succeeds.
    - `grep -q "confirm.*DELETE" apps/mobile/src/services/profileService.ts` succeeds.
    - `cd apps/mobile && npm run test -- "auth.signOut|profileService.deleteMe" --run` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- "auth.signOut|profileService.deleteMe" --run</automated>
  </verify>
  <done>signOut clears the right keys; deleteMe wires DELETE /me?confirm=DELETE with idempotency-key.</done>
</task>

<task type="auto">
  <name>Task 2: LogoutModal — design-spec §18.3 + auth.signOut + nav reset</name>
  <files>apps/mobile/src/components/LogoutModal.tsx, apps/mobile/__tests__/components/LogoutModal.test.tsx, apps/mobile/src/navigation/RootNativeStack.tsx</files>
  <read_first>
    - apps/mobile/src/services/auth.ts (Task 1 output)
    - design-spec.md §18.3 (Logout confirm verbatim copy)
    - apps/mobile/src/screens/SignIn.tsx (analog: Pressable + StyleSheet)
    - apps/mobile/src/navigation/RootNativeStack.tsx (current — register LogoutModal as a transparent modal route)
  </read_first>
  <action>
    Author `apps/mobile/src/components/LogoutModal.tsx`. Use Text + Button primitives from `../ui/primitives/*`; tokens from `../ui/tokens` — NO hex literals. Modal uses raw RN `Modal` (the Modal primitive in 02-02 ships a centered card; LogoutModal IS that pattern but rendered via raw RN Modal here for the transparent-route registration; future refactor can lift it into <Modal /> primitive):
    ```tsx
    import React from 'react';
    import { View, StyleSheet, Modal } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { Text } from '../ui/primitives/Text';
    import { Button } from '../ui/primitives/Button';
    import { colors, spacing, radii } from '../ui/tokens';
    import { signOut } from '../services/auth';

    /** design-spec §18.3 — Logout confirm modal. */
    export function LogoutModal(): React.JSX.Element {
      const nav = useNavigation<any>();

      const cancel = () => nav.goBack();
      const confirm = () => {
        signOut();
        nav.reset({ index: 0, routes: [{ name: 'Signup' }] });
      };

      return (
        <Modal transparent visible animationType="fade" onRequestClose={cancel}>
          <View style={styles.scrim}>
            <View style={styles.card} accessibilityLabel="logout-modal">
              <Text variant="btnLabel" style={styles.title}>Log out?</Text>
              <Text variant="body" tone="secondary" style={styles.body}>You'll need to sign in again to keep contributing.</Text>
              <View style={styles.actions}>
                <View style={styles.actionBtn}>
                  <Button variant="outline" accessibilityLabel="logout-cancel" label="Cancel" onPress={cancel} />
                </View>
                <View style={styles.actionBtn}>
                  <Button variant="primary" accessibilityLabel="logout-confirm" label="Log out" onPress={confirm} />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      );
    }

    const styles = StyleSheet.create({
      scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xxxl },
      card: { backgroundColor: colors.surface, borderRadius: radii.modal, padding: spacing.xxxl },
      title: { marginBottom: spacing.m, color: colors.text },
      body: {},
      actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.l, gap: spacing.ms },
      actionBtn: { minWidth: 120 },
    });
    ```

    Update `apps/mobile/src/navigation/RootNativeStack.tsx` to register `LogoutModal` as a transparent modal screen.

    Author `apps/mobile/__tests__/components/LogoutModal.test.tsx`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';
    import { render, screen, fireEvent } from '@testing-library/react';
    import React from 'react';

    const goBackFn = vi.fn();
    const resetFn = vi.fn();
    vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: goBackFn, reset: resetFn }) }));

    const signOutFn = vi.fn();
    vi.mock('../../src/services/auth', () => ({ signOut: signOutFn }));

    import { LogoutModal } from '../../src/components/LogoutModal';

    beforeEach(() => { goBackFn.mockClear(); resetFn.mockClear(); signOutFn.mockClear(); });

    describe('LogoutModal', () => {
      it('renders verbatim §18.3 title + body copy', () => {
        render(<LogoutModal />);
        expect(screen.getByText('Log out?')).toBeTruthy();
        expect(screen.getByText("You'll need to sign in again to keep contributing.")).toBeTruthy();
      });

      it('Cancel calls navigation.goBack and does NOT signOut', () => {
        render(<LogoutModal />);
        fireEvent.click(screen.getByLabelText('logout-cancel'));
        expect(goBackFn).toHaveBeenCalledTimes(1);
        expect(signOutFn).not.toHaveBeenCalled();
      });

      it('Log out calls signOut + navigation.reset to Signup', () => {
        render(<LogoutModal />);
        fireEvent.click(screen.getByLabelText('logout-confirm'));
        expect(signOutFn).toHaveBeenCalledTimes(1);
        expect(resetFn).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Signup' }] });
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- LogoutModal --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "Log out?" apps/mobile/src/components/LogoutModal.tsx` succeeds.
    - `grep -q "You'll need to sign in again to keep contributing." apps/mobile/src/components/LogoutModal.tsx` succeeds.
    - `grep -q "signOut\(\)" apps/mobile/src/components/LogoutModal.tsx` succeeds.
    - `grep -q 'name: .Signup' apps/mobile/src/components/LogoutModal.tsx` succeeds.
    - `grep -q 'name="LogoutModal"' apps/mobile/src/navigation/RootNativeStack.tsx` succeeds.
    - `cd apps/mobile && npm run test -- LogoutModal --run` exits 0; 3 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- LogoutModal --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/components/LogoutModal.tsx; test $? -eq 1)</automated>
  </verify>
  <done>LogoutModal ships per §18.3, wires signOut + nav.reset. NO hex literals in LogoutModal.</done>
</task>

<task type="auto">
  <name>Task 3: DeleteAccountModal — two-step with DELETE-typing gate + nav reset</name>
  <files>apps/mobile/src/components/DeleteAccountModal.tsx, apps/mobile/__tests__/components/DeleteAccountModal.test.tsx, apps/mobile/src/navigation/RootNativeStack.tsx</files>
  <read_first>
    - apps/mobile/src/services/profileService.ts (Task 1 output: deleteMe)
    - apps/mobile/src/services/auth.ts (Task 1 output: signOut — used to clear MMKV after delete)
    - design-spec.md §18.4 (Delete account confirm — two-step)
    - REQUIREMENTS.md AUTH-09 + AUTH-10 verbatim
    - apps/mobile/src/components/LogoutModal.tsx (Task 2 output — same modal scrim/card pattern)
  </read_first>
  <action>
    Author `apps/mobile/src/components/DeleteAccountModal.tsx`. Use Text + Button primitives from `../ui/primitives/*`; tokens from `../ui/tokens` — NO hex literals:
    ```tsx
    import React, { useState } from 'react';
    import { View, TextInput, StyleSheet, Modal, Alert } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { Text } from '../ui/primitives/Text';
    import { Button } from '../ui/primitives/Button';
    import { colors, spacing, radii } from '../ui/tokens';
    import { deleteMe } from '../services/profileService';
    import { signOut } from '../services/auth';

    /** design-spec §18.4 — two-step delete confirmation with DELETE-typing gate (AUTH-09 / AUTH-10). */
    type Step = 'confirm' | 'type-delete';

    const STEP1_BODY = 'Your account will be deactivated for 30 days. Log in within that window to restore it. After 30 days, deletion is permanent. Recordings already uploaded remain on our servers.';
    const REQUIRED_TEXT = 'DELETE';

    export function DeleteAccountModal(): React.JSX.Element {
      const nav = useNavigation<any>();
      const [step, setStep] = useState<Step>('confirm');
      const [typed, setTyped] = useState('');
      const [submitting, setSubmitting] = useState(false);

      const cancel = () => nav.goBack();

      const continueToType = () => setStep('type-delete');

      const confirmDelete = async () => {
        // Defensive client check (AUTH-10) — backend Phase 1 also enforces ?confirm=DELETE.
        if (typed !== REQUIRED_TEXT) {
          Alert.alert('Type DELETE to confirm.');
          return;
        }
        setSubmitting(true);
        try {
          await deleteMe();
          // Clear all auth + onboarding state, return to Signup (D-DEL-01).
          signOut();
          nav.reset({ index: 0, routes: [{ name: 'Signup' }] });
        } catch (e) {
          Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again later.');
        } finally {
          setSubmitting(false);
        }
      };

      const confirmEnabled = typed === REQUIRED_TEXT && !submitting;

      return (
        <Modal transparent visible animationType="fade" onRequestClose={cancel}>
          <View style={styles.scrim}>
            <View style={styles.card} accessibilityLabel="delete-account-modal">
              {step === 'confirm' ? (
                <>
                  <Text variant="btnLabel" style={styles.title}>Delete your Humyn account?</Text>
                  <Text variant="body" tone="secondary" style={styles.body}>{STEP1_BODY}</Text>
                  <View style={styles.actions}>
                    <View style={styles.actionBtn}>
                      <Button variant="outline" accessibilityLabel="delete-cancel" label="Cancel" onPress={cancel} />
                    </View>
                    <View style={styles.actionBtn}>
                      <Button variant="coral" accessibilityLabel="delete-continue" label="Continue to delete" onPress={continueToType} />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text variant="btnLabel" style={styles.title}>Type DELETE to confirm.</Text>
                  <TextInput
                    autoFocus
                    autoCapitalize="characters"
                    autoCorrect={false}
                    value={typed}
                    onChangeText={setTyped}
                    placeholder="DELETE"
                    placeholderTextColor={colors.text3}
                    style={styles.input}
                    accessibilityLabel="delete-typing-input"
                  />
                  <View style={styles.actions}>
                    <View style={styles.actionBtn}>
                      <Button variant="outline" accessibilityLabel="delete-cancel-2" label="Cancel" onPress={cancel} />
                    </View>
                    <View style={styles.actionBtn}>
                      <Button
                        variant="coral"
                        accessibilityLabel="delete-confirm"
                        label={submitting ? 'Deleting…' : 'Confirm'}
                        onPress={confirmDelete}
                        disabled={!confirmEnabled}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      );
    }

    const styles = StyleSheet.create({
      scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xxxl },
      card: { backgroundColor: colors.surface, borderRadius: radii.modal, padding: spacing.xxxl },
      title: { marginBottom: spacing.m, color: colors.text },
      body: {},
      input: { marginTop: spacing.mdl, borderWidth: 1, borderColor: colors.line, borderRadius: radii.input, padding: spacing.md, fontSize: 16, fontWeight: '700', color: colors.text },
      actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.l, gap: spacing.ms },
      actionBtn: { minWidth: 120 },
    });
    ```

    Update `apps/mobile/src/navigation/RootNativeStack.tsx` to register `DeleteAccountModal`.

    Author `apps/mobile/__tests__/components/DeleteAccountModal.test.tsx`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';
    import { render, screen, fireEvent, waitFor } from '@testing-library/react';
    import React from 'react';

    const goBackFn = vi.fn();
    const resetFn = vi.fn();
    vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: goBackFn, reset: resetFn }) }));

    const deleteMeFn = vi.fn();
    vi.mock('../../src/services/profileService', () => ({ deleteMe: () => deleteMeFn() }));

    const signOutFn = vi.fn();
    vi.mock('../../src/services/auth', () => ({ signOut: signOutFn }));

    import { DeleteAccountModal } from '../../src/components/DeleteAccountModal';

    beforeEach(() => { goBackFn.mockClear(); resetFn.mockClear(); deleteMeFn.mockReset(); signOutFn.mockClear(); });

    describe('DeleteAccountModal', () => {
      it('step 1 renders verbatim §18.4 title + body', () => {
        render(<DeleteAccountModal />);
        expect(screen.getByText('Delete your Humyn account?')).toBeTruthy();
        expect(screen.getByText(/Your account will be deactivated for 30 days/)).toBeTruthy();
      });

      it('Continue to delete advances to step 2 typing gate', () => {
        render(<DeleteAccountModal />);
        fireEvent.click(screen.getByLabelText('delete-continue'));
        expect(screen.getByText('Type DELETE to confirm.')).toBeTruthy();
      });

      it('Confirm is disabled until typed text === DELETE (case-sensitive AUTH-10)', () => {
        render(<DeleteAccountModal />);
        fireEvent.click(screen.getByLabelText('delete-continue'));
        const input = screen.getByLabelText('delete-typing-input');
        fireEvent.change(input, { target: { value: 'delete' } });
        // Confirm button rendered but disabled — the test attribute we expose
        // is the disabled-style accessibilityState; we assert by attempting click +
        // verifying deleteMe was NOT called.
        fireEvent.click(screen.getByLabelText('delete-confirm'));
        expect(deleteMeFn).not.toHaveBeenCalled();
      });

      it('Confirm fires deleteMe + signOut + nav.reset when typed === DELETE', async () => {
        deleteMeFn.mockResolvedValue(undefined);
        render(<DeleteAccountModal />);
        fireEvent.click(screen.getByLabelText('delete-continue'));
        fireEvent.change(screen.getByLabelText('delete-typing-input'), { target: { value: 'DELETE' } });
        fireEvent.click(screen.getByLabelText('delete-confirm'));
        await waitFor(() => expect(deleteMeFn).toHaveBeenCalledTimes(1));
        expect(signOutFn).toHaveBeenCalledTimes(1);
        expect(resetFn).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Signup' }] });
      });

      it('Cancel on step 1 calls nav.goBack and does NOT call deleteMe', () => {
        render(<DeleteAccountModal />);
        fireEvent.click(screen.getByLabelText('delete-cancel'));
        expect(goBackFn).toHaveBeenCalledTimes(1);
        expect(deleteMeFn).not.toHaveBeenCalled();
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- DeleteAccountModal --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "Delete your Humyn account?" apps/mobile/src/components/DeleteAccountModal.tsx` succeeds.
    - `grep -q "Your account will be deactivated for 30 days" apps/mobile/src/components/DeleteAccountModal.tsx` succeeds.
    - `grep -q "Type DELETE to confirm." apps/mobile/src/components/DeleteAccountModal.tsx` succeeds.
    - `grep -q "REQUIRED_TEXT.*DELETE\|=== 'DELETE'" apps/mobile/src/components/DeleteAccountModal.tsx` succeeds.
    - `grep -q "deleteMe\(\)" apps/mobile/src/components/DeleteAccountModal.tsx` succeeds.
    - `grep -q "signOut\(\)" apps/mobile/src/components/DeleteAccountModal.tsx` succeeds (clear MMKV after delete).
    - `grep -q 'name="DeleteAccountModal"' apps/mobile/src/navigation/RootNativeStack.tsx` succeeds.
    - `cd apps/mobile && npm run test -- DeleteAccountModal --run` exits 0; 5 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- DeleteAccountModal --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/components/DeleteAccountModal.tsx; test $? -eq 1)</automated>
  </verify>
  <done>DeleteAccountModal ships two-step gate; backend round-trip mocked + asserted; client + backend gates compose into a defense-in-depth pattern. NO hex literals in DeleteAccountModal.</done>
</task>

</tasks>

<verification>
- `cd apps/mobile && npm run test -- "(LogoutModal|DeleteAccountModal|auth.signOut|profileService.deleteMe)" --run` — all green.
- `grep -c "Type DELETE to confirm" apps/mobile/src/components/DeleteAccountModal.tsx` returns 1.
- Manual smoke (in 02-21): on a real device, sign in → Profile → Logout → Sign-up screen; sign in again → Profile → Delete account → step 1 → Continue → type 'delete' (lowercase) → Confirm is disabled OR no API call fires; type 'DELETE' → Confirm fires DELETE /me; backend logs show deletedAt set; cold-start app, re-sign-in within 30 days, account is restored (Phase 1 server-side restore behavior).
</verification>

<success_criteria>

- AUTH-08 / AUTH-09 / AUTH-10 closed in code + tests.
- signOut preserves device-bound state (compat result, installation_id) but clears user-bound state (JWT, onboarding flags).
- DELETE-typing gate is case-sensitive client-side; backend has its own ?confirm=DELETE gate.
- Both modals reset nav to Signup so user must re-authenticate.
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-19-SUMMARY.md` per templates/summary.md.
</output>
