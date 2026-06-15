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
// the translated `profile.errors.couldNotUpdate` Alert on failure.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../ui/primitives/Text';
import { Pressable } from '../../ui/primitives/Pressable';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing, radii, typography } from '../../ui/tokens';
import { fetchMe, patchMe, fetchLifetimeContribution } from '../../services/profileService';
import { formatDuration } from '../../services/durationFormatter';
import { getFlavorContext } from '../../native/AppFlavor';
import { useAppStore } from '../../state/appStore';
import { coalesceDisplayName } from '../../lib/userDisplayName';
import { InlineEditField } from './InlineEditField';
// Phase 7 plan 07-04 — LanguageSheet (D-17) + native-name display for the
// Language row's right-side value (D-19) + formatDate (D-37) for the Joined
// row so digits stay Latin across all 8 MVP locales (I18N-09).
import { LanguageSheet } from '../../components/LanguageSheet';
import { LOCALE_NATIVE_NAMES } from '../../i18n/locale-meta';
import type { Locale } from '../../i18n/storage';
import { formatDate } from '../../lib/dates';

// ---------------------------------------------------------------------------
// PROF-02 — payments card body. Verbatim from idea-brief.md §5.11
// "Payments coming soon" copy.
//
// Phase 7 plan 07-09: the runtime render site now reads from
// `t('profile.payments.body')` so this body translates per locale. The
// constant is RETAINED as a design-canon drift detector — Task 1's
// byte-parity gate asserts `en.json profile.payments.body` is byte-equal
// to this literal, so any future edit to either side surfaces in code
// review. The constant is intentionally unused at runtime; the
// eslint-disable below documents that fact.
// prettier-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PAYMENTS_BODY =
  'Payouts process offline. Your earnings will reflect in the app soon. Keep recording — your data is safe and your payouts are guaranteed.';

// PROF-01 — gender choice picker. User-supplied verbatim spec; the column
// is `text` on the backend (UserPatchSchema accepts any string up to 40 chars),
// so the enum is enforced client-side only at MVP. Adding values here is the
// single source of truth.
const GENDER_OPTIONS: string[] = ['Male', 'Female', "Don't want to disclose"];

// Bug 10 (2026-06-04) — lifetime-block loading deadline. `/me` renders the
// screen immediately (fast PK read); the lifetime `/contributions` aggregate can
// be slow for heavy contributors, so cap its spinner at 13s (inside the 12–15s
// window from the plan) then surface an inline error + Retry instead of an
// indefinite spinner. The api.ts transport abort (~30s) is the hard backstop;
// this is the UX deadline that self-heals on the next focus / Retry / upload.
const LIFETIME_DEADLINE_MS = 13_000;

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
  // Bug 11 (2026-06-04) — refetch the lifetime block when the upload queue
  // mutates (a finalized upload changes the server-side contribution totals).
  const contributionsVersion = useAppStore((s) => s.contributionsVersion);
  // Phase 7 plan 07-04 — useTranslation for the Language row label + sheet
  // title; i18n.language drives both the Native-name right-side value AND
  // the formatDate locale for the Joined row.
  const { t, i18n } = useTranslation();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [me, setMe] = useState<ProfileLocal | null>(null);
  const [lifetime, setLifetime] = useState<{ totalSeconds: number; taskCount: number } | null>(
    null,
  );
  // Bug 10 — the lifetime block loads independently of `/me` with its own
  // status, so a slow `/contributions` never blocks the (fast) `/me` render:
  // 'loading' → spinner, 'ready' → numeric, 'error' → inline error + Retry.
  // The error state is only surfaced while `lifetime` is still null — a
  // background refetch that fails keeps showing the last-good numeric.
  const [lifetimeStatus, setLifetimeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // `/me` failure → whole-screen error (it's the screen's identity read). A
  // `/contributions` failure does NOT set this — it only flips lifetimeStatus.
  const [error, setError] = useState<string | null>(null);
  // Head-level inline edit (Task 1 of quick-260510-005). Mirrors the
  // InlineEditField pattern but lives directly in the head so the user can
  // tap the displayed name (which has the "tap to edit" caption).
  const [headEditing, setHeadEditing] = useState(false);
  const [headDraft, setHeadDraft] = useState('');
  // Bug 10 — guard async setState after unmount, and supersede a stale lifetime
  // resolve when a newer load (Retry / focus / contributions bump) is in flight
  // (the slow first request must not clobber a fresher one's result).
  const mountedRef = useRef(true);
  const lifetimeReqRef = useRef(0);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

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

  // Bug 10 — `/me` is the fast PK read that renders the screen. On success it
  // also write-throughs to the shared user slice so TopBar (Home) can read the
  // Google avatar without re-fetching /me (self-heals sessions that pre-date the
  // user-slice introduction). A failure sets the whole-screen error.
  const loadMe = useCallback(async () => {
    try {
      const meRes = await fetchMe();
      if (!mountedRef.current) return;
      setMe({
        name: meRes.name,
        age: meRes.age,
        gender: meRes.gender,
        createdAt: meRes.createdAt,
        avatarUrl: meRes.avatarUrl,
      });
      setUser({
        id: meRes.id,
        email: meRes.email,
        name: coalesceDisplayName(meRes.name, meRes.email),
        avatarUrl: meRes.avatarUrl,
      });
      setError(null);
    } catch (e: unknown) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'load_failed');
    }
  }, [setUser]);

  // Bug 10 — the (possibly slow) lifetime aggregate loads independently with a
  // 13s UX deadline. `lifetimeReqRef` makes the latest call win: a stale resolve
  // (or its deadline) no-ops once a newer load supersedes it.
  const loadLifetime = useCallback(async () => {
    const reqId = (lifetimeReqRef.current += 1);
    // NOTE: do NOT setState('loading') synchronously here. loadLifetime runs
    // inside the useFocusEffect callback, which some test mocks invoke DURING
    // render — a render-phase setState there loops ("Too many re-renders").
    // The initial spinner comes from the useState('loading') seed; Retry
    // (a press handler, not render) re-enters 'loading' via onRetryLifetime; a
    // background refetch keeps the current numeric (lifetime != null wins in
    // render), so an explicit 'loading' reset isn't needed.
    let settled = false;
    const deadline = setTimeout(() => {
      if (!settled && mountedRef.current && lifetimeReqRef.current === reqId) {
        setLifetimeStatus('error');
      }
    }, LIFETIME_DEADLINE_MS);
    try {
      const contribRes = await fetchLifetimeContribution();
      settled = true;
      clearTimeout(deadline);
      if (!mountedRef.current || lifetimeReqRef.current !== reqId) return;
      setLifetime({ totalSeconds: contribRes.totalSeconds, taskCount: contribRes.taskCount });
      setLifetimeStatus('ready');
    } catch {
      settled = true;
      clearTimeout(deadline);
      if (mountedRef.current && lifetimeReqRef.current === reqId) setLifetimeStatus('error');
    }
  }, []);

  // Bug 10 — render off `/me` immediately; the lifetime block fills in lazily.
  // useFocusEffect (not a mount-only effect) so a transient `/contributions`
  // failure self-heals the next time the user opens Profile. Promise.allSettled
  // so neither leg blocks or rejects the other.
  useFocusEffect(
    useCallback(() => {
      void Promise.allSettled([loadMe(), loadLifetime()]);
      return undefined;
    }, [loadMe, loadLifetime]),
  );

  // Bug 11 — refetch the lifetime block when the upload queue mutates
  // (debounced ~1.5s; skip the initial 0 — the focus effect already loaded).
  useEffect(() => {
    if (contributionsVersion === 0) return undefined;
    const id = setTimeout(() => {
      void loadLifetime();
    }, 1500);
    return () => clearTimeout(id);
  }, [contributionsVersion, loadLifetime]);

  const onRetryLifetime = useCallback(() => {
    // Press handler (NOT render) — safe to set 'loading' so the spinner returns
    // when retrying from the error state.
    setLifetimeStatus('loading');
    void loadLifetime();
  }, [loadLifetime]);

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
        Alert.alert(
          t('profile.errors.couldNotUpdate.title'),
          t('profile.errors.couldNotUpdate.body'),
        );
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
  // Bug 10 — gate the whole-screen loading on `/me` ONLY (the fast PK read).
  // The lifetime block renders its own spinner / numeric / error+Retry below,
  // so a slow `/contributions` no longer holds the entire screen on "Loading…".
  if (!me) {
    return (
      <ScreenContainer accessibilityLabel="Profile screen">
        <View accessibilityLabel="profile-loading" style={styles.loadingWrap}>
          <Text variant="body" tone="tertiary" style={styles.loadingLine}>
            {t('common.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // Phase 7 plan 07-04 (I18N-09 / D-37) — locale-aware date formatting via
  // formatDate(), which forces `numberingSystem: 'latn'` so digits stay
  // Latin (0-9) across all 8 MVP locales.
  const joined = formatDate(new Date(me.createdAt), i18n.language);

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
              {t('profile.head.tapToEdit')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Lifetime block — PROF-03 (44 px / 700 mono numeric + caption).
          Bug 10 — renders independently of `/me`: the numeric once `/contributions`
          resolves, a spinner while it loads, or an inline error + Retry once the
          13s deadline passes — never an indefinite spinner. A background refetch
          with data already present keeps showing the data. */}
      <View style={styles.lifetime} accessibilityLabel="profile-lifetime">
        {lifetime != null ? (
          <>
            <Text variant="lifetimeNumber" style={styles.lifetimeNumeric}>
              {formatDuration(lifetime.totalSeconds)}
            </Text>
            <Text variant="caption" tone="secondary">
              {t('profile.lifetime.contributed')}
            </Text>
            <Text variant="caption" tone="secondary">
              {t('profile.lifetime.acrossNTasks', { count: lifetime.taskCount })}
            </Text>
          </>
        ) : lifetimeStatus === 'error' ? (
          <View accessibilityLabel="profile-lifetime-error" style={styles.lifetimeError}>
            <Text variant="caption" tone="secondary">
              {t('profile.lifetime.loadError')}
            </Text>
            <Pressable
              onPress={onRetryLifetime}
              accessibilityRole="button"
              accessibilityLabel="profile-lifetime-retry"
              style={styles.lifetimeRetry}
            >
              <Text variant="caption" style={styles.lifetimeRetryLabel}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator accessibilityLabel="profile-lifetime-loading" color={colors.accent} />
        )}
      </View>

      {/* Earnings card — PROF-02 (verbatim copy) */}
      <View style={styles.earningsCard} accessibilityLabel="profile-payments-card">
        <View style={styles.earningsHeader}>
          <Text variant="btnLabel" style={styles.earningsTitle}>
            {t('profile.payments.title')}
          </Text>
          <View style={styles.comingSoonBadge}>
            <Text variant="comingSoonBadge" style={styles.comingSoonText}>
              {t('profile.payments.comingSoon')}
            </Text>
          </View>
        </View>
        <Text variant="caption" tone="secondary" style={styles.earningsBody}>
          {t('profile.payments.body')}
        </Text>
      </View>

      {/* Personal info — PROF-01 inline-edit pattern (D-PROF-01) */}
      <View style={styles.section}>
        <InlineEditField
          label={t('profile.fields.name')}
          value={me.name}
          onSave={(v) => saveField('name', v)}
        />
        <InlineEditField
          label={t('profile.fields.age')}
          value={me.age == null ? null : String(me.age)}
          keyboardType="numeric"
          nullable
          onSave={(v) => saveField('age', v)}
        />
        <InlineEditField
          label={t('profile.fields.gender')}
          value={me.gender}
          nullable
          options={GENDER_OPTIONS}
          onSave={(v) => saveField('gender', v)}
        />
        <View style={styles.row} accessibilityLabel="profile-joined">
          <Text variant="body" style={styles.fieldLabel}>
            {t('profile.fields.joined')}
          </Text>
          <Text variant="body" tone="secondary">
            {joined}
          </Text>
        </View>
      </View>

      {/* Actions — PROF-04 (modal bodies land in 02-19) */}
      <View style={styles.section}>
        {/* Phase 7 plan 07-04 (I18N-04) — Language row above Help Center. Tap
            opens the LanguageSheet (mounted below) which composes the
            existing Sheet primitive (D-17) + the shared LanguageList. The
            right-side value shows the current locale's NATIVE name (D-19);
            falls back to 'English' if i18n.language is somehow outside
            SUPPORTED_LOCALES. */}
        <Pressable
          style={styles.row}
          onPress={() => setLanguageSheetVisible(true)}
          accessibilityLabel="profile-action-language"
        >
          <Text variant="body" style={styles.fieldLabel}>
            {t('profile.language.row.label')}
          </Text>
          <Text variant="body" tone="tertiary">
            {LOCALE_NATIVE_NAMES[i18n.language as Locale] ?? 'English'} ›
          </Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => nav.navigate('HelpCenter')}
          accessibilityLabel="profile-action-help"
        >
          <Text variant="body" style={styles.fieldLabel}>
            {t('profile.actions.help')}
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
            {t('profile.actions.logout')}
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
            {t('profile.actions.delete')}
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

      {/* Phase 7 plan 07-04 — Profile language picker (D-02 + D-17 + D-19).
          Controlled by `languageSheetVisible` state; opens on Language-row
          tap, commits + dismisses on row tap (tap-to-commit). Mounted at
          ScrollView root so the scrim overlays the entire surface. */}
      <LanguageSheet
        visible={languageSheetVisible}
        onDismiss={() => setLanguageSheetVisible(false)}
      />
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
  // Bug 10 — inline lifetime-block error + Retry (shown after the 13s deadline
  // when the aggregate hasn't loaded). Reuses existing chip-style tokens — no
  // new design tokens.
  lifetimeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  lifetimeRetry: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.line,
  },
  lifetimeRetryLabel: {
    color: colors.accent,
    fontFamily: typography.fontFamily.semibold,
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
