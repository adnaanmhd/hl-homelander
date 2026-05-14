// SendRequestSheet — Phase 6 Plan 06-07 Task 2 (TASK-08 / TASK-09; design-spec
// §12 / 06-UI-SPEC §Send Request sheet).
//
// Multipart form sheet that opens from the Tasks footer link OR the TASK-10
// empty-state inline link. Mirrors `ReportProblemSheet.tsx` (the closest
// analog — both ship a small JSON payload + an optional file part to a single
// endpoint protected by per-user rate-limit + an Idempotency-Key).
//
// Form fields per UI-SPEC §Send Request sheet:
//   - TASK NAME  (3..80 chars; coral inline error)
//   - DESCRIPTION (10..240 chars; coral inline error)
//   - CATEGORY   (chip row: 10 taxonomy categories + 'Other')
//   - SETTING    (segmented Indoor / Outdoor; default Indoor)
//   - SAMPLE VIDEO (OPTIONAL) — dashed-border tile + Paperclip icon. At MVP
//     the picker is NOT wired (no @react-native-community/datetimepicker dep,
//     no react-native-document-picker dep — see 06-RESEARCH Q-3); the field
//     is purely visual + the form ships without a video. The OPTIONAL state
//     is honoured server-side already (Phase 1 TaskRequestCreateSchema).
//
// On submit:
//   - success → 2s success toast + close sheet ("Request sent. We'll review
//     and add it to your list.")
//   - error → in-sheet inline banner ("Couldn't send. Try again.") + Retry
//     link that re-fires submit.
//
// TASK-09: no submitted-request status surfaced anywhere. After submit
// success the sheet just closes — there's no "Pending review" list, no
// status pill, nothing.
//
// NO hex literals — every value bound to `../../ui/tokens`.
import React, { useCallback, useMemo, useState } from 'react';
import { View, TextInput, ScrollView, Modal, StyleSheet, type GestureResponderEvent } from 'react-native';
import { Paperclip } from 'lucide-react-native';

import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { Pressable } from '../../ui/primitives/Pressable';
import { colors, spacing, radii } from '../../ui/tokens';
import { submitTaskRequest } from '../../services/taskRequestService';
import { showToast } from '../../components/Toast';

export interface SendRequestSheetProps {
  /** Sheet visibility. */
  visible: boolean;
  /** Dismiss handler — fires on scrim tap / cancel / success. */
  onDismiss: () => void;
}

const CATEGORY_OPTIONS = [
  'Cooking',
  'Dishwashing',
  'Kitchen',
  'Cleaning',
  'Tidying',
  'Laundry',
  'Gardening',
  'Pet Care',
  'Home Maintenance',
  'Hobby',
  'Other',
] as const;
type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

type Setting = 'indoor' | 'outdoor';

interface Banner {
  readonly kind: 'error';
  readonly text: string;
}

export function SendRequestSheet({
  visible,
  onDismiss,
}: SendRequestSheetProps): React.JSX.Element | null {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<CategoryOption | null>(null);
  const [setting, setSetting] = useState<Setting>('indoor');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  // Field-level validation. Coral inline lines mirror UI-SPEC §Validation /
  // error states verbatim. We surface a single per-field error string (or
  // null) so the line renders only when the field has been touched + invalid.
  const nameError = useMemo<string | null>(() => {
    if (name.length === 0) return null; // pristine — no error line
    if (name.length < 3) return 'Task name needs at least 3 characters.';
    if (name.length > 80) return 'Task name is too long (80 max).';
    return null;
  }, [name]);
  const descriptionError = useMemo<string | null>(() => {
    if (description.length === 0) return null;
    if (description.length < 10) return 'Description needs at least 10 characters.';
    if (description.length > 240) return 'Description is too long (240 max).';
    return null;
  }, [description]);
  const categoryError = useMemo<string | null>(() => {
    // The pristine state shows nothing — the form-disabled check below catches
    // unselected category. A "Pick a category." surface only fires if the
    // user has interacted (no per-field touched flag at MVP — keep simple).
    return null;
  }, []);

  // Submit is enabled when every required field is filled + valid. The
  // sample video is optional and never feeds disabled state.
  const canSubmit =
    !submitting &&
    name.length >= 3 &&
    name.length <= 80 &&
    description.length >= 10 &&
    description.length <= 240 &&
    category !== null;

  const reset = useCallback((): void => {
    setName('');
    setDescription('');
    setCategory(null);
    setSetting('indoor');
    setBanner(null);
    setSubmitting(false);
  }, []);

  const handleClose = useCallback((): void => {
    reset();
    onDismiss();
  }, [reset, onDismiss]);

  const submit = useCallback(async (): Promise<void> => {
    if (!canSubmit || category === null) return;
    setSubmitting(true);
    setBanner(null);
    try {
      await submitTaskRequest({
        name,
        description,
        category,
        setting,
        // Sample-video URI is intentionally absent at MVP — the picker is
        // not wired (no document-picker dep). Optional per TASK-08.
      });
      showToast("Request sent. We'll review and add it to your list.", 2000);
      // emit task_request_submitted({ category, setting, has_video: false })
      handleClose();
    } catch (e) {
      setBanner({ kind: 'error', text: "Couldn't send. Try again." });
      // emit task_request_failed({ reason: e?.message })
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, category, name, description, setting, handleClose]);

  // Bound to the inline "Retry" link inside the error banner. Same as
  // submit but available even when submit is otherwise disabled by `submitting`.
  const retry = useCallback(
    (_e?: GestureResponderEvent): void => {
      void submit();
    },
    [submit],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      accessibilityLabel="send-request-modal"
    >
      <View style={styles.scrim}>
        <View accessibilityLabel="send-request-sheet" style={styles.sheet}>
          <ScrollView
            accessibilityLabel="send-request-scroll"
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="sheetTitle" tone="primary" style={styles.title}>
              Request a task
            </Text>
            <Text variant="body" tone="secondary" style={styles.body}>
              Tell us what you&apos;d like to record. Our team reviews requests regularly.
            </Text>

            {banner ? (
              <View accessibilityLabel="send-request-banner" style={styles.banner}>
                <Text variant="caption" tone="primary" style={styles.bannerText}>
                  {banner.text}{' '}
                  <Text
                    variant="caption"
                    style={styles.bannerLink}
                    accessibilityLabel="send-request-retry"
                    onPress={retry}
                  >
                    Retry
                  </Text>
                </Text>
              </View>
            ) : null}

            {/* TASK NAME */}
            <Text variant="formLabel" tone="secondary" style={styles.label}>
              TASK NAME
            </Text>
            <TextInput
              accessibilityLabel="send-request-name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Iron clothes"
              placeholderTextColor={colors.text3}
              maxLength={80}
              style={styles.input}
            />
            {nameError ? (
              <Text variant="caption" style={styles.errorText} accessibilityLabel="send-request-name-error">
                {nameError}
              </Text>
            ) : null}

            {/* DESCRIPTION */}
            <Text variant="formLabel" tone="secondary" style={[styles.label, styles.labelGap]}>
              DESCRIPTION
            </Text>
            <TextInput
              accessibilityLabel="send-request-description"
              value={description}
              onChangeText={setDescription}
              placeholder="A few words on what the task involves."
              placeholderTextColor={colors.text3}
              maxLength={240}
              multiline
              numberOfLines={3}
              style={styles.textarea}
            />
            {descriptionError ? (
              <Text
                variant="caption"
                style={styles.errorText}
                accessibilityLabel="send-request-description-error"
              >
                {descriptionError}
              </Text>
            ) : null}

            {/* CATEGORY */}
            <Text variant="formLabel" tone="secondary" style={[styles.label, styles.labelGap]}>
              CATEGORY
            </Text>
            <View style={styles.chipWrap}>
              {CATEGORY_OPTIONS.map((c) => {
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    accessibilityLabel={`send-request-category-${c}`}
                    accessibilityRole="button"
                    onPress={() => setCategory(c)}
                    style={active ? styles.chipActive : styles.chip}
                  >
                    <Text variant="caption" style={active ? styles.chipLabelActive : styles.chipLabel}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {categoryError ? (
              <Text
                variant="caption"
                style={styles.errorText}
                accessibilityLabel="send-request-category-error"
              >
                {categoryError}
              </Text>
            ) : null}

            {/* SETTING */}
            <Text variant="formLabel" tone="secondary" style={[styles.label, styles.labelGap]}>
              SETTING
            </Text>
            <View style={styles.segmented}>
              <Pressable
                accessibilityLabel="send-request-setting-indoor"
                accessibilityRole="button"
                onPress={() => setSetting('indoor')}
                style={setting === 'indoor' ? styles.segmentedActive : styles.segmented_}
              >
                <Text
                  variant="pillLabel"
                  style={setting === 'indoor' ? styles.segmentedLabelActive : styles.segmentedLabel}
                >
                  Indoor
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="send-request-setting-outdoor"
                accessibilityRole="button"
                onPress={() => setSetting('outdoor')}
                style={setting === 'outdoor' ? styles.segmentedActive : styles.segmented_}
              >
                <Text
                  variant="pillLabel"
                  style={setting === 'outdoor' ? styles.segmentedLabelActive : styles.segmentedLabel}
                >
                  Outdoor
                </Text>
              </Pressable>
            </View>

            {/* SAMPLE VIDEO — visual-only at MVP (picker not wired; optional
                per TASK-08). The dashed-border tile + paperclip icon mirror
                UI-SPEC; tapping is a no-op so users can't get into a partial-
                upload state. */}
            <Text variant="formLabel" tone="secondary" style={[styles.label, styles.labelGap]}>
              SAMPLE VIDEO (OPTIONAL)
            </Text>
            <View accessibilityLabel="send-request-sample-tile" style={styles.sampleTile}>
              <Paperclip size={24} strokeWidth={1.75} color={colors.text2} />
              <Text variant="caption" tone="secondary" style={styles.sampleLabel}>
                Choose video (30s max)
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerBtn}>
              <Button
                variant="outline"
                label="Cancel"
                accessibilityLabel="send-request-cancel"
                onPress={handleClose}
              />
            </View>
            <View style={styles.footerBtn}>
              <Button
                variant="accent"
                label={submitting ? 'Sending…' : 'Send request'}
                accessibilityLabel="send-request-submit"
                onPress={() => void submit()}
                disabled={!canSubmit}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // canonical bottom-sheet scrim per design-spec §18; not a hex
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.h,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    maxHeight: '88%',
  },
  scroll: {
    paddingBottom: spacing.l,
  },
  title: {
    marginBottom: spacing.m,
  },
  body: {
    marginBottom: spacing.xl,
  },
  banner: {
    backgroundColor: colors.bannerWarnBg,
    borderColor: colors.bannerWarnBorder,
    borderWidth: 1,
    borderRadius: radii.input,
    padding: spacing.md,
    marginBottom: spacing.l,
  },
  bannerText: {
    color: colors.bannerWarnText,
  },
  bannerLink: {
    color: colors.accent,
  },
  label: {
    marginBottom: spacing.s,
  },
  labelGap: {
    marginTop: spacing.l,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    minHeight: 44,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.coral,
    marginTop: spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
  },
  chip: {
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'transparent',
  },
  chipActive: {
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  chipLabel: {
    color: colors.text,
  },
  chipLabelActive: {
    color: colors.surface,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.button,
    overflow: 'hidden',
  },
  segmented_: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  segmentedActive: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.text,
  },
  segmentedLabel: {
    color: colors.text,
  },
  segmentedLabelActive: {
    color: colors.surface,
  },
  sampleTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    borderRadius: radii.input,
    padding: spacing.l,
  },
  sampleLabel: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.m,
    paddingTop: spacing.l,
  },
  footerBtn: {
    flex: 1,
  },
});

export default SendRequestSheet;
