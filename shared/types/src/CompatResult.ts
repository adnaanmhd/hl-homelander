// Wire shape for the device-compatibility check result.
// Persisted in MMKV at `compat.lastResult.v1`; consumed by:
//   - apps/mobile/src/services/compatService.ts (assemble + persist)
//   - apps/mobile/src/screens/compat/CompatFailScreen.tsx (read failedKeys + measured*)
//   - apps/mobile/src/state/initialRoute.ts (compatSignature staleness gate)
//
// Phase 2 D-COMPAT-05. Schema follows Phase 1 app-version.ts conventions —
// schema declared first, type alias inferred via `z.infer`, no discriminated
// union (single shape). Nested per-check objects expose both pass/fail and
// the measured value so the fail screen can render diagnostic copy without a
// second probe call.

import { z } from 'zod';

export const CompatChecksSchema = z.object({
  resolution: z.boolean(),
  fps: z.boolean(),
  ultrawideDfov: z.object({ pass: z.boolean(), measuredDeg: z.number() }),
  imuSustained100Hz: z.object({ pass: z.boolean(), measuredHz: z.number() }),
  imuP99Ms: z.object({ pass: z.boolean(), measuredMs: z.number() }),
  micSampleRate: z.boolean(),
  realtimeTimestamp: z.boolean(),
  root: z.object({ pass: z.boolean(), verdict: z.string() }),
  freeStorageGB: z.object({
    pass: z.boolean(),
    warningOnly: z.boolean(),
    measuredGB: z.number(),
  }),
  encoderNoBFrames: z.boolean(),
  oisOff: z.boolean(),
  hdrSdrForced: z.boolean(),
});
export type CompatChecks = z.infer<typeof CompatChecksSchema>;

export const CompatResultSchema = z.object({
  signature: z.string(),
  runAt: z.string().datetime(),
  checks: CompatChecksSchema,
  passed: z.boolean(),
  failedKeys: z.array(z.string()),
});
export type CompatResult = z.infer<typeof CompatResultSchema>;
