// LogoutModal — design-spec §18.3 (Logout confirm) + AUTH-08 wiring.
//
// Single-step confirm modal with verbatim §18.3 copy:
//   Title: "Log out?"
//   Body:  "You'll need to sign in again to keep contributing."
//   Actions: [Cancel | Log out]
//
// On Confirm: calls auth.signOut() (clears JWT + onboarding flags, preserves
// device-bound compat.lastResult.v1), then navigation.reset to Signup so the
// user must re-authenticate (D-DEL-01 / engineering-handoff §3.3 — "no back
// to splash/sign-up").
//
// Registered as a transparent modal route in RootNativeStack so the bottom
// tab bar is not visible while the confirm is open.
//
// **Pattern 66 — synchronous re-entrancy guard for destructive handlers**
// (quick-260510-006). `signOut()` is currently synchronous and `nav.reset`
// is sync, so a double-tap today only re-fires idempotent work. The guard
// is added for symmetry with DeleteAccountModal AND as a forward-looking
// shield: if the logout flow ever gains an async pre-check (e.g.
// `await api.post('/me/logout')` to revoke server-side tokens), removing
// this guard at that point would re-introduce the same misleading-error
// class as DeleteAccountModal's pre-fix bug.
//
// NO hex literals — all colors / spacing / radii come from `../ui/tokens`.

import React, { useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../ui/primitives/Text';
import { Button } from '../ui/primitives/Button';
import { colors, radii, spacing } from '../ui/tokens';
import { signOut } from '../services/auth';

export function LogoutModal(): React.JSX.Element {
  const nav = useNavigation<{ goBack: () => void; reset: (state: object) => void }>();
  const inFlightRef = useRef(false);

  const cancel = () => nav.goBack();

  const confirm = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    signOut();
    // Reset to the OnboardingStack sibling (NOT 'Signup', which is nested
    // inside OnboardingStack and is not reachable as a root-level route).
    // OnboardingStack registers Signup as its initial screen, so this lands
    // the user on Signup with a fresh stack.
    nav.reset({ index: 0, routes: [{ name: 'OnboardingStack' }] });
    // Note: no `inFlightRef.current = false` — once nav.reset fires, this
    // component unmounts; the ref dies with it. If a future async pre-check
    // is added, wrap in try/finally to release the guard on rejection.
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={cancel}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityLabel="logout-modal">
          <Text variant="sheetTitle" style={styles.title}>
            Log out?
          </Text>
          <Text variant="body" tone="secondary" style={styles.body}>
            You&apos;ll need to sign in again to keep contributing.
          </Text>
          <View style={styles.actions}>
            <View style={styles.actionBtn}>
              <Button
                variant="outline"
                accessibilityLabel="logout-cancel"
                label="Cancel"
                onPress={cancel}
              />
            </View>
            <View style={styles.actionBtn}>
              <Button
                variant="primary"
                accessibilityLabel="logout-confirm"
                label="Log out"
                onPress={confirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default LogoutModal;

// `scrim`: 50% black overlay; the only `rgba(...)` constant the design system
// allows outside tokens.ts (engineering-handoff §1.5 — modal scrim parity).
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.l,
    gap: spacing.ms,
  },
  actionBtn: { minWidth: 120 },
});
