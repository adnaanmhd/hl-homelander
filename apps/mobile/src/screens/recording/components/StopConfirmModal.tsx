/**
 * StopConfirmModal — design-spec §18.2 (Stop confirm modal). Shown ONLY
 * during active recording when the user taps X (HAND-10 — no confirmation
 * pre-record).
 *
 * Verbatim copy:
 *   Title:  "Stop recording?"          ([confirm w/ PM] — recommended string)
 *   Body:   "Recordings under 3 minutes are discarded."
 *   Actions: [Keep recording (btn-outline) | Stop (btn-coral)]
 *
 * ⚠ OWNER DEVIATION 2026-06-04 (Bug 8 + Enh 1 / D6, sign-off
 * `.planning/260604-locked-override-signoff.md`): the body copy was the
 * LOCKED "Recordings under 1 minute are discarded." — the owner raised the
 * minimum-duration floor 1 min → 3 min, so the modal now states "3 minutes".
 * The native FinalizeWorker TooShort gate (MIN_SEGMENT_MS = 180_000) is the
 * real enforcement; this copy keeps the modal honest about the new floor.
 *
 * Template = `LogoutModal.tsx` — `<Modal transparent visible animationType="fade">`,
 * `rgba(0,0,0,.5)` scrim, dark card. Pattern 66 `inFlightRef` re-entrancy
 * guard on the destructive `onStop` so a double-tap can't double-fire.
 *
 * NO hex literals — colors from `colors.*`.
 */
import React, { useEffect, useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Text } from '../../../ui/primitives/Text';
import { Button } from '../../../ui/primitives/Button';
import { colors, radii, spacing } from '../../../ui/tokens';

export interface StopConfirmModalProps {
  visible: boolean;
  onKeepRecording(): void;
  onStop(): void;
}

export function StopConfirmModal({
  visible,
  onKeepRecording,
  onStop,
}: StopConfirmModalProps): React.JSX.Element | null {
  const inFlightRef = useRef(false);

  // Reset the guard whenever the modal is dismissed-then-reopened (the
  // `active → stop-confirm → active → stop-confirm` cycle).
  useEffect(() => {
    if (!visible) inFlightRef.current = false;
  }, [visible]);

  if (!visible) return null;

  const handleStop = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    onStop();
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onKeepRecording}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityLabel="stop-confirm-modal">
          <Text variant="sheetTitle" style={styles.title}>
            Stop recording?
          </Text>
          <Text variant="body" tone="secondary" style={styles.body}>
            Recordings under 3 minutes are discarded.
          </Text>
          <View style={styles.actions}>
            <View style={styles.actionBtn}>
              <Button
                variant="outline"
                accessibilityLabel="stop-confirm-keep"
                label="Keep recording"
                onPress={onKeepRecording}
              />
            </View>
            <View style={styles.actionBtn}>
              <Button
                variant="coral"
                accessibilityLabel="stop-confirm-stop"
                label="Stop"
                onPress={handleStop}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default StopConfirmModal;

// `scrim`: 50% black overlay — the one rgba(...) constant the design system
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
