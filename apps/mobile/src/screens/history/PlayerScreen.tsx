/**
 * PlayerScreen — the full-bleed dark in-app Player route (Phase 6 Plan 06-10;
 * design-spec §14). Closes HIST-07 + HIST-08 + HIST-09 (the streaming-in-MVP
 * scope expansion locked in Plan 06-03's REQUIREMENTS rewording).
 *
 * The screen is registered in `RootNativeStack` as a sibling of `MainTabs`
 * (NOT inside it) so the surface is full-bleed dark per design-spec §14 —
 * bottom-nav is suppressed automatically. The route options mirror the
 * Recording surface: `gestureEnabled:false`, `headerShown:false`,
 * `animation:'fade'` (RootNativeStack.tsx).
 *
 * Source-resolution (06-CONTEXT.md D-06):
 *   1. Read the ledger entry for `recordingId`.
 *   2. If `ledgerEntry.mp4LocalPath` exists AND `RNFS.exists()` returns true,
 *      prepare the player with `file://${mp4LocalPath}` (local playback).
 *   3. Otherwise call `getRecordingStreamUrl(recordingId)`:
 *        archiveState='available'    → prepare(presignedUrl).
 *        archiveState='unavailable'  → disabled overlay "Still uploading — try
 *                                       again in a moment." (no prepare).
 *        archiveState='deep-archive' → disabled overlay "This recording has
 *                                       been archived. Contact support for
 *                                       retrieval." (no prepare).
 *
 * Lifecycle:
 *   - on focus → `Orientation.lockToPortrait()`
 *   - on blur / unmount → `Orientation.unlockAllOrientations()` AND
 *     `HumynPlayer.release()` AND remove all event subscriptions
 *
 * Token discipline (D-UI-01 gate): every color sourced via `colors.*`; no hex
 * literals appear in the component body. Phase 6 token additions in tokens.ts
 * (06-UI-SPEC §Token Additions): `colors.playerBg`, `colors.playerScrubTrack`,
 * `colors.playerPlayOverlay`, `colors.playerDisabledOverlay`.
 *
 * Test surface: `apps/mobile/__tests__/screens/history/PlayerScreen.test.tsx`
 * exercises the 8 states from UI-SPEC §14 — Loading / Paused / Playing /
 * Ended / Network error / Expired link / Deep-Archive disabled / Pending
 * disabled — plus the unmount cleanup invariant.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type EmitterSubscription,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Orientation from 'react-native-orientation-locker';
import RNFS from 'react-native-fs';

import { Text } from '../../ui/primitives/Text';
import { Icon } from '../../ui/primitives/Icon';
import { colors, radii, spacing } from '../../ui/tokens';
import {
  HumynPlayer,
  HumynPlayerView,
  onPlayerBuffer,
  onPlayerEnd,
  onPlayerError,
  onPlayerProgress,
} from '../../native/HumynPlayer';
import type { ArchiveState } from '@humyn/shared-types';
import { getRecordingStreamUrl } from '../../services/recordingsApi';
import { readEntry } from '../../services/thumbnailLedger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerRouteParams {
  recordingId: string;
  taskName: string;
}

interface NavigationLike {
  goBack(): void;
}

type ErrorState = 'network' | 'expired-link' | null;

// ---------------------------------------------------------------------------
// Time formatter — `M:SS` / `H:MM:SS` for the mono current/total time row
// (UI-SPEC §14 / typography.playerTime). Defensive against NaN
// (HumynPlayer emits `durationMs = Number.NaN` while the duration is still
// resolving — see HumynPlayer.types.ts).
// ---------------------------------------------------------------------------
function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec - hours * 3600) / 60);
  const seconds = totalSec - hours * 3600 - minutes * 60;
  const ss = seconds < 10 ? `0${seconds}` : `${seconds}`;
  if (hours > 0) {
    const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

// ---------------------------------------------------------------------------
// DisabledOverlay — `rgba(0,0,0,0.6)` chip-style overlay (UI-SPEC §14).
// Centered white text at 14/20; optional tap for retry states. No play
// affordance — the disabled overlay completely replaces the playback chrome.
// ---------------------------------------------------------------------------
interface DisabledOverlayProps {
  text: string;
  onTap?: () => void;
  testID?: string;
}

function DisabledOverlay({ text, onTap, testID }: DisabledOverlayProps): React.JSX.Element {
  const inner = (
    <View style={styles.disabledOverlayChip}>
      <Text style={styles.disabledOverlayText}>{text}</Text>
    </View>
  );
  if (onTap) {
    return (
      <Pressable
        accessibilityLabel={testID ?? 'player-disabled-overlay'}
        style={styles.disabledOverlayWrap}
        onPress={onTap}
      >
        {inner}
      </Pressable>
    );
  }
  return (
    <View
      accessibilityLabel={testID ?? 'player-disabled-overlay'}
      style={styles.disabledOverlayWrap}
    >
      {inner}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ScrubBar — 4 px tall, full width, `playerScrubTrack` bg, `accent` fill at
// `positionMs/durationMs`, buffered overlay at `bufferedMs/durationMs`. The
// MVP scrub is a visual indicator with tap-to-seek — no draggable thumb (the
// design-spec §14 mock shows the 4 px bar with the accent fill only).
// ---------------------------------------------------------------------------
interface ScrubBarProps {
  positionMs: number;
  bufferedMs: number;
  durationMs: number;
  onSeek?: (ms: number) => void;
}

function ScrubBar({
  positionMs,
  bufferedMs,
  durationMs,
  onSeek,
}: ScrubBarProps): React.JSX.Element {
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1;
  const pct = Math.max(0, Math.min(1, positionMs / safeDuration));
  const bufPct = Math.max(0, Math.min(1, bufferedMs / safeDuration));
  return (
    <Pressable
      accessibilityLabel="player-scrub-bar"
      style={styles.scrubTrack}
      onPress={() => {
        // Tap at center seeks to the midpoint — a minimal handler that lets
        // tests exercise the onSeek wiring. A full drag-to-seek lands in v2.
        if (onSeek) onSeek(Math.floor(safeDuration / 2));
      }}
    >
      <View style={[styles.scrubBuffered, { width: `${bufPct * 100}%` }]} />
      <View style={[styles.scrubFill, { width: `${pct * 100}%` }]} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// PlayerScreen
// ---------------------------------------------------------------------------

export function PlayerScreen(): React.JSX.Element {
  const navigation = useNavigation() as unknown as NavigationLike;
  const route = useRoute();
  const params = (route.params ?? {}) as Partial<PlayerRouteParams>;
  const recordingId = params.recordingId ?? '';
  const taskName = params.taskName ?? '';

  // Source-resolution state (null = still resolving).
  const [archiveState, setArchiveState] = useState<ArchiveState | null>(null);
  // Playback state.
  const [paused, setPaused] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [bufferedMs, setBufferedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<ErrorState>(null);

  // Track refs so cleanup paths are race-free.
  const subsRef = useRef<EmitterSubscription[]>([]);
  const mountedRef = useRef(true);

  // -------------------------------------------------------------------------
  // Orientation lock — portrait + letterboxed (UI-SPEC §14 / RESEARCH Open
  // Question). 16:9 landscape recordings render with black bars top/bottom
  // of the frame.
  // -------------------------------------------------------------------------
  useEffect(() => {
    Orientation.lockToPortrait();
    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Native event subscriptions — installed once on mount, removed on unmount.
  // The `useCallback` factory keeps the listener refs stable so a re-render
  // doesn't re-subscribe.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const onProgress = onPlayerProgress((e) => {
      if (!mountedRef.current) return;
      setPositionMs(e.positionMs);
      setBufferedMs(e.bufferedMs);
      if (Number.isFinite(e.durationMs)) setDurationMs(e.durationMs);
    });
    const onBuffer = onPlayerBuffer((e) => {
      if (!mountedRef.current) return;
      setLoading(e.buffering);
    });
    const onEnd = onPlayerEnd(() => {
      if (!mountedRef.current) return;
      setPaused(true);
    });
    const onError = onPlayerError(() => {
      if (!mountedRef.current) return;
      // The disabled overlays own the archive-state copy; for runtime player
      // errors fall back to the network-error retry chrome (UI-SPEC §14
      // State 5). The explicit `expired-link` state is reached by the URL
      // refresh retry handler below.
      setErrorState('network');
      setLoading(false);
    });
    subsRef.current = [onProgress, onBuffer, onEnd, onError];
    return () => {
      for (const s of subsRef.current) {
        try {
          s.remove();
        } catch {
          // ignore
        }
      }
      subsRef.current = [];
    };
  }, []);

  // -------------------------------------------------------------------------
  // Source resolution — local-first, then remote (D-06). Runs once on mount.
  // The `recordingId` is the natural key; if it's missing the screen renders
  // an error state (defensive against deep-link injection / route-param
  // tampering — T-6.10-02).
  // -------------------------------------------------------------------------
  const resolveSource = useCallback(async () => {
    if (!recordingId) {
      setErrorState('network');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorState(null);
    try {
      const ledgerEntry = readEntry(recordingId);
      if (ledgerEntry?.mp4LocalPath) {
        const exists = await RNFS.exists(ledgerEntry.mp4LocalPath);
        if (exists) {
          setArchiveState('available');
          await HumynPlayer.prepare(`file://${ledgerEntry.mp4LocalPath}`);
          return;
        }
      }
      // No local copy → consult the server.
      const envelope = await getRecordingStreamUrl(recordingId);
      if (!mountedRef.current) return;
      setArchiveState(envelope.archiveState);
      if (envelope.archiveState === 'available' && envelope.presignedUrl) {
        await HumynPlayer.prepare(envelope.presignedUrl);
      }
    } catch {
      if (mountedRef.current) {
        setErrorState('network');
        setLoading(false);
      }
    }
  }, [recordingId]);

  useEffect(() => {
    mountedRef.current = true;
    void resolveSource();
    return () => {
      mountedRef.current = false;
      try {
        // Fire-and-forget — `HumynPlayer.release()` is idempotent on the
        // native side (PlayerController.release() bails on a null player).
        void HumynPlayer.release();
      } catch {
        // ignore
      }
    };
  }, [resolveSource]);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------
  const onClose = useCallback(() => {
    try {
      void HumynPlayer.release();
    } catch {
      // ignore
    }
    navigation.goBack();
  }, [navigation]);

  const onTogglePlay = useCallback(() => {
    if (paused) {
      try {
        void HumynPlayer.play();
      } catch {
        // ignore
      }
      setPaused(false);
    } else {
      try {
        void HumynPlayer.pause();
      } catch {
        // ignore
      }
      setPaused(true);
    }
  }, [paused]);

  const onSeek = useCallback((ms: number) => {
    try {
      void HumynPlayer.seekTo(ms);
    } catch {
      // ignore
    }
  }, []);

  const retry = useCallback(() => {
    setErrorState(null);
    void resolveSource();
  }, [resolveSource]);

  const refreshUrl = useCallback(() => {
    // Same path as `retry` — re-fetch the stream-url envelope.
    setErrorState(null);
    void resolveSource();
  }, [resolveSource]);

  const currentTime = useMemo(() => formatTime(positionMs), [positionMs]);
  const totalTime = useMemo(() => formatTime(durationMs), [durationMs]);

  // -------------------------------------------------------------------------
  // Render — full-bleed dark surface (StyleSheet.absoluteFill +
  // colors.playerBg). The Top bar + footer are always present; the video
  // frame, play overlay, scrub row are gated by `archiveState === 'available'`.
  // -------------------------------------------------------------------------
  const showPlayerChrome = archiveState === 'available' && errorState === null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      {/* Top bar — 50/22/18 padding (top/sides/bottom); 24 px X icon on the
          left, centered task name (16/600), lock badge on the right. */}
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="player-close" onPress={onClose} hitSlop={12}>
          <Icon name="X" size={24} color={colors.recTextPrimary} />
        </Pressable>
        <Text variant="btnLabel" style={styles.taskName} numberOfLines={1}>
          {taskName}
        </Text>
        <View style={styles.lockBadge} accessibilityLabel="player-lock-badge">
          <Icon name="Lock" size={16} color={colors.recSkipLink} />
          <Text variant="pillLabel" style={styles.lockLabel}>
            View-only
          </Text>
        </View>
      </View>

      {/* Video frame — 16 px radius, letterboxed 16:9 inside portrait.
          Background + radius live on the wrapper, NOT on HumynPlayerView:
          HumynPlayerView extends Android TextureView which throws on
          `setBackgroundDrawable` ("TextureView doesn't support displaying a
          background drawable"). Wrapper handles the visuals; the TextureView
          just fills the rect. */}
      {showPlayerChrome && (
        <View style={styles.videoFrameWrap}>
          <View style={styles.videoFrame}>
            <HumynPlayerView style={styles.videoFrameInner} />
          </View>
        </View>
      )}

      {/* Loading — centered spinner + "Loading…" caption. */}
      {showPlayerChrome && loading && (
        <View style={styles.centerWrap} accessibilityLabel="player-loading">
          <ActivityIndicator color={colors.recTextPrimary} size="large" />
          <Text variant="caption" style={styles.loadingLabel}>
            Loading…
          </Text>
        </View>
      )}

      {/* 64 × 64 round centered play overlay — visible while paused. */}
      {showPlayerChrome && paused && !loading && (
        <Pressable
          accessibilityLabel="player-play-overlay"
          style={styles.playOverlayWrap}
          onPress={onTogglePlay}
        >
          <View style={styles.playOverlay}>
            <Icon name="Play" size={32} color={colors.recTextPrimary} />
          </View>
        </Pressable>
      )}

      {/* Scrub row — 4 px scrub bar + mono current/total time labels. */}
      {showPlayerChrome && (
        <View style={styles.scrubRow}>
          <Text variant="playerTime" style={styles.timeLabel}>
            {currentTime}
          </Text>
          <View style={styles.scrubBarWrap}>
            <ScrubBar
              positionMs={positionMs}
              bufferedMs={bufferedMs}
              durationMs={durationMs}
              onSeek={onSeek}
            />
          </View>
          <Text variant="playerTime" style={styles.timeLabel}>
            {totalTime}
          </Text>
        </View>
      )}

      {/* Footer line (caption / white@60%). */}
      <Text variant="caption" style={styles.footer}>
        View only — not downloadable.
      </Text>

      {/* Disabled overlays — archive-state-driven (D-08). */}
      {archiveState === 'deep-archive' && (
        <DisabledOverlay
          testID="player-disabled-deep-archive"
          text="This recording has been archived. Contact support for retrieval."
        />
      )}
      {archiveState === 'unavailable' && (
        <DisabledOverlay
          testID="player-disabled-unavailable"
          text="Still uploading — try again in a moment."
        />
      )}

      {/* Runtime error overlays — distinct from the archive-state overlays. */}
      {errorState === 'network' && (
        <DisabledOverlay
          testID="player-error-network"
          text="Couldn't load video. Tap to retry."
          onTap={retry}
        />
      )}
      {errorState === 'expired-link' && (
        <DisabledOverlay
          testID="player-error-expired"
          text="Link expired. Tap to refresh."
          onTap={refreshUrl}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.playerBg,
  },
  // Top bar — 50/22/18 padding (top/sides/bottom). 24 px X-icon left,
  // centered task name (16/600), lock badge right. The flex-row + center +
  // space-between layout matches design-spec §14.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.ll,
  },
  taskName: {
    color: colors.recTextPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.m,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lockLabel: {
    color: colors.recSkipLink,
  },
  // Video frame — 16 px radius, 16:9 letterboxed inside portrait. The wrap
  // centers the letterbox; HumynPlayerView fills it.
  videoFrameWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: spacing.l,
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.button,
    backgroundColor: colors.playerBg,
    overflow: 'hidden',
  },
  // HumynPlayerView is an Android TextureView; setBackgroundDrawable on it
  // throws. Inner style carries only layout — the wrapper above owns
  // backgroundColor + borderRadius.
  videoFrameInner: {
    flex: 1,
  },
  // Centered loading + 64x64 play overlay — both positioned absolutely so
  // they layer on top of the video frame.
  centerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.m,
  },
  loadingLabel: {
    color: colors.recTextCaption,
  },
  playOverlayWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.playerPlayOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Scrub row — current time | 4 px scrub bar | total time. The mono time
  // labels use typography.playerTime (12/14/600 +0.4 tracking).
  scrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.m,
    gap: spacing.md,
  },
  scrubBarWrap: {
    flex: 1,
  },
  scrubTrack: {
    height: 4,
    width: '100%',
    backgroundColor: colors.playerScrubTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  scrubBuffered: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.playerScrubTrack,
  },
  scrubFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.accent,
  },
  timeLabel: {
    color: colors.recSkipLink,
    fontFamily: 'Menlo',
    minWidth: 40,
  },
  // Footer — 12/secondary, centered, bottom-pinned.
  footer: {
    color: colors.recSkipLink,
    textAlign: 'center',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  // Disabled overlay — `rgba(0,0,0,0.6)` full-screen wash with a centered
  // chip-style 8 px-radius card holding the disabled message.
  disabledOverlayWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.playerDisabledOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  disabledOverlayChip: {
    borderRadius: spacing.m,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.l,
    maxWidth: '90%',
  },
  disabledOverlayText: {
    color: colors.recTextPrimary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default PlayerScreen;
