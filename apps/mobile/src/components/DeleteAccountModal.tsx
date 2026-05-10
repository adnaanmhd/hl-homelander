// DeleteAccountModal — design-spec §18.4 (two-step delete confirmation) +
// AUTH-09 / AUTH-10 wiring.
//
// Step 1 (informational confirm — verbatim §18.4):
//   Title: "Delete your Humyn account?"
//   Body:  "Your account will be deactivated for 30 days. Log in within that
//          window to restore it. After 30 days, deletion is permanent.
//          Recordings already uploaded remain on our servers."
//   Actions: [Cancel | Continue to delete]
//
// Step 2 (typing gate — AUTH-10):
//   Title: "Type DELETE to confirm."
//   Input + [Cancel | Confirm]
//   Confirm enabled ONLY when typed text === 'DELETE' (case-sensitive).
//
// On Confirm with valid DELETE input:
//   1. profileService.deleteMe()  → DELETE /me?confirm=DELETE  (T-2.19-01
//      mitigation: server enforces ?confirm=DELETE via MeDeleteQuerySchema;
//      client-side gate is UX defense-in-depth — a user who patches the JS
//      bundle still hits the server-side gate).
//   2. auth.signOut()             → clears JWT + onboarding flags.
//   3. navigation.reset to OnboardingStack (Pattern 61 — root-sibling reset)
//      → user must re-authenticate to test the 30-day soft-delete restore
//      path (D-DEL-01). Pre-quick-260510-006 this reset targeted 'Signup'
//      directly, which silently no-ops because Signup is nested inside
//      OnboardingStack rather than being a root-level route.
//
// On error: Alert + step stays visible (no MMKV cleanup, no nav reset). The
// 30-day restore window is server-side; the user can sign in again later
// even if this client-side cleanup never ran.
//
// **Pattern 66 — synchronous re-entrancy guard for destructive async
// handlers** (quick-260510-006). The `submitting` state alone CANNOT block a
// fast double-tap: setState propagates only on the next render, so a second
// tap that lands while the first `await deleteMe()` is in flight (or while
// nav.reset is mid-unmount but the Modal is still receiving events) will
// re-enter `confirmDelete` because `disabled={!confirmEnabled}` still reads
// the stale `submitting=false`. The first call has already cleared the JWT
// via signOut(), so the second DELETE arrives at the backend without an
// Authorization header and returns 401 — the Alert that surfaces tells the
// user "Could not delete" even though the FIRST call DID delete the account.
// `useRef` updates synchronously in the same render frame, so the ref-based
// guard short-circuits before any work is done. Pair the ref guard with the
// state-based UI guard (kept for the visual `submitting` label).
//
// **Crucial detail — release only on error, never on success.** The
// natural reflex is to release the ref in `finally` to mirror the
// `setSubmitting(false)` cleanup, but on the success path that releases
// the guard AFTER signOut() has cleared the JWT. A second tap arriving
// after the success-path `finally` (e.g. 100-200 ms after the first tap,
// while nav.reset's unmount animation is still in progress) would then
// pass the now-released guard and fire a DELETE without the Authorization
// header — the exact 401 bug we're fixing. Release in `catch` only; on
// success the component unmounts via nav.reset and the ref dies with it.
//
// NO hex literals — all colors / spacing / radii come from `../ui/tokens`.

import React, { useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../ui/primitives/Text';
import { Button } from '../ui/primitives/Button';
import { colors, radii, spacing } from '../ui/tokens';
import { deleteMe } from '../services/profileService';
import { signOut } from '../services/auth';

type Step = 'confirm' | 'type-delete';

// Verbatim from design-spec.md §18.4 — drift detector: any change shows up in
// code review since this is the only call site.
const STEP1_BODY =
  'Your account will be deactivated for 30 days. Log in within that window to restore it. After 30 days, deletion is permanent. Recordings already uploaded remain on our servers.';

// Case-sensitive (AUTH-10). Backend Phase 1 plan 01-08 enforces the same
// literal string in MeDeleteQuerySchema.
const REQUIRED_TEXT = 'DELETE';

export function DeleteAccountModal(): React.JSX.Element {
  const nav = useNavigation<{ goBack: () => void; reset: (state: object) => void }>();
  const [step, setStep] = useState<Step>('confirm');
  const [typed, setTyped] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  // Pattern 66 — synchronous re-entrancy guard. `useRef` updates immediately
  // in the same frame; state setters do not. See file header.
  const inFlightRef = useRef(false);

  const cancel = () => nav.goBack();
  const continueToType = () => setStep('type-delete');

  const confirmEnabled = typed === REQUIRED_TEXT && !submitting;

  const confirmDelete = async () => {
    // Belt-and-suspenders client check (AUTH-10) — even though the Confirm
    // button is `disabled` when `typed !== 'DELETE'`, an automation tool that
    // bypasses the disabled state still hits this guard. Backend Phase 1
    // plan 01-08 also enforces ?confirm=DELETE via MeDeleteQuerySchema (T-2.19-01).
    if (typed !== REQUIRED_TEXT) {
      Alert.alert('Type DELETE to confirm.');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    try {
      await deleteMe();
      // Clear all auth + onboarding state, return to Signup (D-DEL-01).
      signOut();
      // Pattern 61 — reset to the OnboardingStack root sibling, NOT 'Signup'.
      // Signup is nested INSIDE OnboardingStack and is not reachable as a
      // root-level route, so a reset to 'Signup' would silently no-op and
      // leave the user on this modal with submitting=false (button label
      // flips back from "Deleting…" to "Confirm" — looks like "not working").
      // OnboardingStack registers Signup as its initial screen, so this
      // lands the user on Signup with a fresh stack.
      nav.reset({ index: 0, routes: [{ name: 'OnboardingStack' }] });
      // Note: NO ref release here. nav.reset unmounts this component;
      // ref dies with it. See file header for why finally-release is wrong.
    } catch (e) {
      // Release on error so the user can retry (network failure, 429
      // rate-limit, etc.). The success path intentionally never releases.
      inFlightRef.current = false;
      Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={cancel}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityLabel="delete-account-modal">
          {step === 'confirm' ? (
            <>
              <Text variant="sheetTitle" style={styles.title}>
                Delete your Humyn account?
              </Text>
              <Text variant="body" tone="secondary" style={styles.body}>
                {STEP1_BODY}
              </Text>
              <View style={styles.actions}>
                <View style={styles.actionBtn}>
                  <Button
                    variant="outline"
                    accessibilityLabel="delete-cancel"
                    label="Cancel"
                    onPress={cancel}
                  />
                </View>
                <View style={styles.actionBtn}>
                  <Button
                    variant="coral"
                    accessibilityLabel="delete-continue"
                    label="Continue to delete"
                    onPress={continueToType}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text variant="sheetTitle" style={styles.title}>
                Type DELETE to confirm.
              </Text>
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
                  <Button
                    variant="outline"
                    accessibilityLabel="delete-cancel-2"
                    label="Cancel"
                    onPress={cancel}
                  />
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

export default DeleteAccountModal;

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.modal,
    padding: spacing.xxxl,
  },
  title: { marginBottom: spacing.m, color: colors.text },
  body: {},
  input: {
    marginTop: spacing.mdl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.input,
    padding: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.l,
    gap: spacing.ms,
  },
  actionBtn: { minWidth: 120 },
});
