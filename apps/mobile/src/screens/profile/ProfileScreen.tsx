// ProfileScreen — design-spec §15 + idea-brief.md §5.11.
//
// PROF-01: avatar (read-only Image with fallback to initial), editable name +
//   nullable age + nullable gender, non-editable Joined date.
// PROF-02: payments card — title + Coming-soon badge + verbatim
//   body copy from idea-brief.md §5.11 / design-spec.md §15.
// PROF-03: lifetime contribution numeric (44 px, 700 weight) + 'Across N
//   tasks' caption. Number formatted via durationFormatter (HOME-06 spec).
// PROF-04: Help Center / Logout / Delete account row entries — navigate to
//   HelpCenter / LogoutModal / DeleteAccountModal stub routes. Modal bodies
//   land in plan 02-19.
// PROF-05: footer surfaces `${versionName} (${versionCode}) · ${flavor}` from
//   the AppFlavor TurboModule for support diagnostics.
//
// Inline-edit pattern (D-PROF-01): each editable Field is an InlineEditField.
// Tap → TextInput → blur fires PATCH /me with optimistic UI; revert via
// `Alert.alert('Could not update', ...)` on failure.

import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Image, Alert, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../ui/primitives/Text';
import { Pressable } from '../../ui/primitives/Pressable';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing, radii, typography } from '../../ui/tokens';
import {
  fetchMe,
  patchMe,
  fetchLifetimeContribution,
  type MeResponse,
} from '../../services/profileService';
import { formatDuration } from '../../services/durationFormatter';
import { getFlavorContext } from '../../native/AppFlavor';
import { useAppStore } from '../../state/appStore';
import { InlineEditField } from './InlineEditField';

// ---------------------------------------------------------------------------
// PROF-02 — payments card body. Verbatim from idea-brief.md §5.11
// "Payments coming soon" copy. Drift detector: any change to this string
// surfaces in code review (the constant is the only call site).
// prettier-ignore
const PAYMENTS_BODY =
  'Payouts process offline. Your earnings will reflect in the app soon. Keep recording — your data is safe and your payouts are guaranteed.';

// PROF-01 — gender choice picker. User-supplied verbatim spec; the column
// is `text` on the backend (UserPatchSchema accepts any string up to 40 chars),
// so the enum is enforced client-side only at MVP. Adding values here is the
// single source of truth.
const GENDER_OPTIONS: string[] = ['Male', 'Female', "Don't want to disclose"];

interface ProfileLocal {
  name: string;
  age: number | null;
  gender: string | null;
  createdAt: string;
  avatarUrl: string | null;
}

export function ProfileScreen(): React.JSX.Element {
  const nav = useNavigation<{ navigate: (route: string) => void }>();
  const setUser = useAppStore((s) => s.setUser);
  const [me, setMe] = useState<ProfileLocal | null>(null);
  const [lifetime, setLifetime] = useState<{ totalSeconds: number; taskCount: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  // Head-level inline edit (Task 1 of quick-260510-005). Mirrors the
  // InlineEditField pattern but lives directly in the head so the user can
  // tap the displayed name (which has the "tap to edit" caption).
  const [headEditing, setHeadEditing] = useState(false);
  const [headDraft, setHeadDraft] = useState('');

  // PROF-05 — build identifier footer. getFlavorContext() throws if the native
  // module isn't registered (web / unmocked unit tests); guard with a try so a
  // missing module shows "0.0.0 (0) · unknown" instead of crashing the screen.
  let versionName = '0.0.0';
  let versionCode = 0;
  let flavor = 'unknown';
  try {
    const ctx = getFlavorContext();
    versionName = ctx.versionName;
    versionCode = ctx.versionCode;
    flavor = ctx.flavor;
  } catch {
    /* native module not registered (test env); footer shows defaults. */
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMe(), fetchLifetimeContribution()])
      .then(([meRes, contribRes]: [MeResponse, { totalSeconds: number; taskCount: number }]) => {
        if (cancelled) return;
        setMe({
          name: meRes.name,
          age: meRes.age,
          gender: meRes.gender,
          createdAt: meRes.createdAt,
          avatarUrl: meRes.avatarUrl,
        });
        // Write-through to the shared user slice so TopBar (Home) can read
        // the Google avatar without re-fetching /me. This also self-heals
        // existing sessions that pre-date the user-slice introduction —
        // visiting Profile once populates the store for subsequent Home
        // mounts.
        setUser({
          id: meRes.id,
          email: meRes.email,
          name: meRes.name,
          avatarUrl: meRes.avatarUrl,
        });
        setLifetime({ totalSeconds: contribRes.totalSeconds, taskCount: contribRes.taskCount });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'load_failed');
      });
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const saveField = useCallback(
    async (key: 'name' | 'age' | 'gender', next: string | null) => {
      if (!me) return;
      const previous = me;
      const optimistic: ProfileLocal =
        key === 'age'
          ? { ...me, age: next == null ? null : Number.parseInt(next, 10) }
          : key === 'name'
            ? { ...me, name: next ?? me.name }
            : { ...me, gender: next };
      setMe(optimistic);
      try {
        const body =
          key === 'age'
            ? { age: next == null ? null : Number.parseInt(next, 10) }
            : key === 'name'
              ? { name: next ?? me.name }
              : { gender: next };
        await patchMe(body);
      } catch {
        setMe(previous);
        Alert.alert('Could not update', 'Please try again.');
      }
    },
    [me],
  );

  const commitHead = useCallback(async () => {
    if (!me) return;
    const trimmed = headDraft.trim();
    setHeadEditing(false);
    if (trimmed === '' || trimmed === me.name) return;
    await saveField('name', trimmed);
  }, [headDraft, me, saveField]);

  if (error) {
    return (
      <ScreenContainer accessibilityLabel="Profile screen">
        <View accessibilityLabel="profile-error" style={styles.errorWrap}>
          <Text variant="body" style={styles.errorLine}>
            {error}
          </Text>
        </View>
      </ScreenContainer>
    );
  }
  if (!me || !lifetime) {
    return (
      <ScreenContainer accessibilityLabel="Profile screen">
        <View accessibilityLabel="profile-loading" style={styles.loadingWrap}>
          <Text variant="body" tone="tertiary" style={styles.loadingLine}>
            Loading…
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const joined = new Date(me.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      accessibilityLabel="Profile screen"
    >
      {/* Profile head — PROF-01 avatar + name */}
      <View style={styles.head}>
        {me.avatarUrl ? (
          <Image
            source={{ uri: me.avatarUrl }}
            style={styles.avatar}
            accessibilityLabel="profile-avatar"
          />
        ) : (
          <View
            style={[styles.avatar, styles.avatarFallback]}
            accessibilityLabel="profile-avatar-fallback"
          >
            <Text variant="title28" style={styles.avatarInitial}>
              {(me.name || 'A').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        {headEditing ? (
          <View style={styles.nameBlock} accessibilityLabel="profile-head-name-editing">
            <TextInput
              autoFocus
              value={headDraft}
              onChangeText={setHeadDraft}
              onBlur={commitHead}
              style={styles.nameInput}
              accessibilityLabel="profile-head-name-input"
            />
          </View>
        ) : (
          <Pressable
            style={styles.nameBlock}
            onPress={() => {
              setHeadDraft(me.name);
              setHeadEditing(true);
            }}
            accessibilityLabel="profile-head-name"
          >
            <Text variant="bodyLg" style={styles.nameText}>
              {me.name}
            </Text>
            <Text variant="caption" tone="tertiary">
              tap to edit
            </Text>
          </Pressable>
        )}
      </View>

      {/* Lifetime block — PROF-03 (44 px / 700 mono numeric + caption) */}
      <View style={styles.lifetime} accessibilityLabel="profile-lifetime">
        <Text variant="lifetimeNumber" style={styles.lifetimeNumeric}>
          {formatDuration(lifetime.totalSeconds)}
        </Text>
        <Text variant="caption" tone="secondary">
          contributed
        </Text>
        <Text variant="caption" tone="secondary">
          Across {lifetime.taskCount} tasks
        </Text>
      </View>

      {/* Earnings card — PROF-02 (verbatim copy) */}
      <View style={styles.earningsCard} accessibilityLabel="profile-payments-card">
        <View style={styles.earningsHeader}>
          <Text variant="btnLabel" style={styles.earningsTitle}>
            Payments & Earnings
          </Text>
          <View style={styles.comingSoonBadge}>
            <Text variant="comingSoonBadge" style={styles.comingSoonText}>
              COMING SOON
            </Text>
          </View>
        </View>
        <Text variant="caption" tone="secondary" style={styles.earningsBody}>
          {PAYMENTS_BODY}
        </Text>
      </View>

      {/* Personal info — PROF-01 inline-edit pattern (D-PROF-01) */}
      <View style={styles.section}>
        <InlineEditField label="Name" value={me.name} onSave={(v) => saveField('name', v)} />
        <InlineEditField
          label="Age"
          value={me.age == null ? null : String(me.age)}
          keyboardType="numeric"
          nullable
          onSave={(v) => saveField('age', v)}
        />
        <InlineEditField
          label="Gender"
          value={me.gender}
          nullable
          options={GENDER_OPTIONS}
          onSave={(v) => saveField('gender', v)}
        />
        <View style={styles.row} accessibilityLabel="profile-joined">
          <Text variant="body" style={styles.fieldLabel}>
            Joined
          </Text>
          <Text variant="body" tone="secondary">
            {joined}
          </Text>
        </View>
      </View>

      {/* Actions — PROF-04 (modal bodies land in 02-19) */}
      <View style={styles.section}>
        <Pressable
          style={styles.row}
          onPress={() => nav.navigate('HelpCenter')}
          accessibilityLabel="profile-action-help"
        >
          <Text variant="body" style={styles.fieldLabel}>
            Help Center
          </Text>
          <Text variant="body" tone="tertiary">
            ›
          </Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => nav.navigate('LogoutModal')}
          accessibilityLabel="profile-action-logout"
        >
          <Text variant="body" style={styles.fieldLabel}>
            Logout
          </Text>
          <Text variant="body" tone="tertiary">
            ›
          </Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => nav.navigate('DeleteAccountModal')}
          accessibilityLabel="profile-action-delete"
        >
          <Text variant="body" style={styles.dangerLabel}>
            Delete account
          </Text>
          <Text variant="body" style={styles.dangerLabel}>
            ›
          </Text>
        </Pressable>
      </View>

      {/* Footer — PROF-05 build identifier (versionName / versionCode / flavor) */}
      <Text
        variant="caption"
        tone="tertiary"
        style={styles.footer}
        accessibilityLabel="profile-footer"
      >
        v{versionName} ({versionCode}) · {flavor}
      </Text>
    </ScrollView>
  );
}

export default ProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxxl },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.ll },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.accent },
  nameBlock: { marginLeft: spacing.mdl },
  nameText: {},
  nameInput: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    minWidth: 160,
    paddingVertical: 2,
  },
  lifetime: { marginVertical: spacing.ll, paddingVertical: spacing.md },
  // PROF-03 — explicit fontSize: 44 reaffirms the design-spec §15 lifetime
  // number size on top of the typography token so a literal grep can verify
  // the spec value.
  lifetimeNumeric: {
    ...typography.lifetimeNumber,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  earningsCard: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.tile,
    padding: spacing.ll,
    marginBottom: spacing.ll,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.m,
  },
  earningsTitle: { color: colors.text },
  comingSoonBadge: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  comingSoonText: { color: colors.accent },
  earningsBody: {},
  section: { marginVertical: spacing.m },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.mdl,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  fieldLabel: { color: colors.text },
  dangerLabel: { color: colors.coral },
  footer: { marginTop: spacing.hh, textAlign: 'center' },
  errorWrap: { padding: spacing.xxxl },
  errorLine: { color: colors.coral },
  loadingWrap: { padding: spacing.xxxl },
  loadingLine: {},
});
