/**
 * Plan 04-01 — Phase 4 foundation smoke test.
 *
 * Asserts the three things plan 04-01 lands so every downstream Wave 2/3/4
 * plan can `import` + unit-test the recording surface:
 *
 *   1. The new RN libraries resolve under jsdom via the vitest.setup.ts mocks:
 *      react-native-vision-camera (preview + still-capture only),
 *      react-native-tts (idea-brief §13 voice fallback chain),
 *      react-native-fs (flat recordings/ + practice/ storage), and
 *      react-native-orientation-locker (RecordingScreen landscape lock).
 *   2. The canonical Phase 4 native-module stub shapes can be injected via the
 *      per-file `vi.doMock('react-native', ...)` convention (the same pattern
 *      __tests__/native/HumynCapture.test.ts uses) — HumynHandDetector +
 *      HumynScreenBrightness exercised here as representatives.
 *   3. The react-native-orientation-locker Android wiring is in place:
 *      AndroidManifest.xml's `android:configChanges` carries both `orientation`
 *      and `screenSize`, and MainActivity.kt overrides `onConfigurationChanged`
 *      (the OrientationActivityLifecycle broadcast contract).
 *
 * (1) is a runtime import; (2) uses vi.doMock + dynamic import (mirroring the
 * HumynCapture.test.ts idiom); (3) reads the source files via node:fs — the
 * mobile tsconfig now pins `types: ["node"]`, and the existing
 * __tests__/manifests/manifests.test.ts uses the same readFileSync idiom.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Static imports — the runtime values come from the vitest.setup.ts mocks;
// the *types* come from each package's bundled .d.ts (no casting needed).
import * as VisionCamera from 'react-native-vision-camera';
import Tts from 'react-native-tts';
import RNFS from 'react-native-fs';
import Orientation, { OrientationType } from 'react-native-orientation-locker';

const __dirname = dirname(fileURLToPath(import.meta.url));
// __tests__/native/ -> apps/mobile/
const MOBILE_ROOT = resolve(__dirname, '../../');

// ---------------------------------------------------------------------------
// 1. New RN libraries resolve via the vitest.setup.ts mocks.
// ---------------------------------------------------------------------------
describe('Phase 4 RN library mocks resolve under jsdom', () => {
  it('react-native-vision-camera exposes Camera + the device hooks (preview + takePhoto only)', () => {
    expect(VisionCamera.Camera).toBeDefined();
    expect(typeof VisionCamera.useCameraDevice).toBe('function');
    expect(typeof VisionCamera.useCameraDevices).toBe('function');
    expect(typeof VisionCamera.getCameraDevice).toBe('function');
    // imperative still-capture surface — the hand-gate frame source.
    expect(
      typeof (VisionCamera.Camera as unknown as { getAvailableCameraDevices?: unknown })
        .getAvailableCameraDevices,
    ).toBe('function');
    const dev = VisionCamera.useCameraDevice('back');
    expect(dev).toBeTruthy();
  });

  it('react-native-tts default export exposes getInitStatus + voices + speak (idea-brief §13 chain)', async () => {
    expect(typeof Tts.getInitStatus).toBe('function');
    expect(typeof Tts.voices).toBe('function');
    expect(typeof Tts.setDefaultVoice).toBe('function');
    expect(typeof Tts.speak).toBe('function');
    await expect(Tts.getInitStatus()).resolves.toBe('success');
    const voices = (await Tts.voices()).map((v: { language: string }) => v.language);
    expect(voices).toContain('en-IN');
  });

  it('react-native-fs exposes the FS surface (flat recordings/ + practice/ storage)', async () => {
    expect(typeof RNFS.getFSInfo).toBe('function');
    expect(typeof RNFS.mkdir).toBe('function');
    expect(typeof RNFS.moveFile).toBe('function');
    expect(typeof RNFS.unlink).toBe('function');
    expect(typeof RNFS.exists).toBe('function');
    expect(typeof RNFS.DocumentDirectoryPath).toBe('string');
    const info = await RNFS.getFSInfo();
    expect(info.freeSpace).toBeGreaterThan(0);
  });

  it('react-native-orientation-locker default export exposes lockToLandscape / unlockAllOrientations (RecordingScreen)', () => {
    expect(typeof Orientation.lockToLandscape).toBe('function');
    expect(typeof Orientation.unlockAllOrientations).toBe('function');
    expect(typeof Orientation.getOrientation).toBe('function');
    // named exports — the OrientationType enum the new bindings reference.
    expect(OrientationType.PORTRAIT).toBe('PORTRAIT');
    expect(OrientationType['LANDSCAPE-LEFT']).toBe('LANDSCAPE-LEFT');
  });
});

// ---------------------------------------------------------------------------
// 2. Phase 4 native-module stub shapes inject via the per-file vi.doMock
//    convention (mirrors __tests__/native/HumynCapture.test.ts). The canonical
//    stub shapes are documented in vitest.setup.ts; this exercises two of the
//    five (HumynHandDetector + HumynScreenBrightness) as representatives.
// ---------------------------------------------------------------------------
describe('Phase 4 native-module stub shapes (per-file vi.doMock convention)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('HumynHandDetector + HumynScreenBrightness expose the documented shapes', async () => {
    const handDetector = {
      detectHands: vi.fn().mockResolvedValue(0),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };
    const screenBrightness = { set: vi.fn().mockResolvedValue(undefined) };
    vi.doMock('react-native', () => ({
      NativeModules: {
        HumynHandDetector: handDetector,
        HumynScreenBrightness: screenBrightness,
      },
      NativeEventEmitter: class {
        addListener() {
          return { remove: vi.fn() };
        }
      },
    }));
    const rn = (await import('react-native')) as unknown as {
      NativeModules: Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>;
    };
    const hd = rn.NativeModules.HumynHandDetector!;
    const sb = rn.NativeModules.HumynScreenBrightness!;
    expect(typeof hd.detectHands).toBe('function');
    expect(typeof hd.cleanup).toBe('function');
    expect(typeof sb.set).toBe('function');
    await expect(hd.detectHands!('/tmp/frame.jpg')).resolves.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. react-native-orientation-locker Android wiring (source-grep invariants).
// ---------------------------------------------------------------------------
describe('react-native-orientation-locker Android wiring (plan 04-01)', () => {
  /** Strip XML comments so commentary about an attribute doesn't false-trigger. */
  function stripXml(file: string): string {
    return readFileSync(file, 'utf-8').replace(/<!--[\s\S]*?-->/g, '');
  }

  it('AndroidManifest.xml MainActivity android:configChanges carries orientation + screenSize', () => {
    const manifest = stripXml(resolve(MOBILE_ROOT, 'android/app/src/main/AndroidManifest.xml'));
    const match = manifest.match(/android:configChanges="([^"]*)"/);
    expect(match, 'android:configChanges attribute present on an activity').toBeTruthy();
    const flags = (match![1] || '').split('|').map((s) => s.trim());
    expect(flags).toContain('orientation');
    expect(flags).toContain('screenSize');
  });

  it('MainActivity.kt overrides onConfigurationChanged (OrientationActivityLifecycle broadcast contract)', () => {
    const src = readFileSync(
      resolve(MOBILE_ROOT, 'android/app/src/main/java/ai/humynlabs/capture/MainActivity.kt'),
      'utf-8',
    );
    expect(src).toMatch(/override fun onConfigurationChanged\(/);
    expect(src).toMatch(/"onConfigurationChanged"/);
    expect(src).toMatch(/sendBroadcast/);
  });
});
