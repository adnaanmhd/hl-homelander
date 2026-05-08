import { NativeModules } from 'react-native';

/**
 * Native module contract for `NativeModules.PlayIntegrity`. The Kotlin module
 * (apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt)
 * wraps Google Play `IntegrityManager.requestIntegrityToken` (Standard
 * request, per RESEARCH §2.3) and returns the encrypted Play Integrity token
 * as a string.
 *
 * The nonce is server-minted via POST /auth/nonce (apps/api/src/routes/auth/nonce.ts)
 * and passed in here so this module never decides freshness or single-use
 * semantics — those live in the backend nonce store.
 */
interface PlayIntegrityNativeModule {
  /**
   * Calls Google Play IntegrityManager.requestIntegrityToken with the supplied
   * nonce. Returns the encrypted Play Integrity token (a string) on success.
   *
   * Rejects with:
   * - `PLAY_INTEGRITY_ERROR` — IntegrityManager returned a failure (e.g.
   *   emulator pre-check, network).
   * - `PLAY_INTEGRITY_EXCEPTION` — synchronous throw from
   *   IntegrityManagerFactory or IntegrityTokenRequest.builder() (rare;
   *   misconfigured app).
   */
  requestIntegrityToken(nonce: string): Promise<string>;
}

const native = NativeModules.PlayIntegrity as PlayIntegrityNativeModule | undefined;

/**
 * Returns the encrypted Play Integrity token bound to the supplied nonce.
 * Throws if the native module is not registered (e.g. running on web or in a
 * unit test that hasn't mocked NativeModules.PlayIntegrity).
 */
export async function requestIntegrityToken(nonce: string): Promise<string> {
  if (!native) {
    throw new Error(
      'PlayIntegrity native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native.requestIntegrityToken(nonce);
}
