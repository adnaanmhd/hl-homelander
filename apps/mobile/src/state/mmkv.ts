/**
 * Single shared MMKV instance for the entire app, encrypted at rest with
 * the same key as Phase 1 auth.ts. NEVER create a second MMKV instance —
 * import this singleton from anywhere that needs persistent state.
 *
 * D-STATE-01.
 *
 * Implementation note: react-native-mmkv v4 (Nitro modules) exports `MMKV`
 * as a TYPE only; the runtime constructor is the `createMMKV` factory.
 * Phase 1 auth.ts established this pattern. Plan 02-03's example used
 * `new MMKV(...)` which would fail at runtime — see deviation note in the
 * plan summary.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

export const secureMmkv: MMKV = createMMKV({
  id: 'humyn.secure',
  encryptionKey: 'humyn-mmkv-v1',
});
