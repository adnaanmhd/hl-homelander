// Wire DTOs for /contributions (lifetime aggregate) and /contributions/timeseries
// (daily-bucket time series). Plan 01-08 / API-10.
//
// The lifetime endpoint is the source of truth for the Profile screen counters
// + the Home "Today / Yesterday / Week / Month / All" tile chips. The timeseries
// endpoint backs the History "weekly heatmap" and the daily-bucket variant of
// the Home tiles.

import { z } from 'zod';

export const ContributionsLifetimeSchema = z.object({
  durationMs: z.number().int().min(0),
  recordingCount: z.number().int().min(0),
  taskCount: z.number().int().min(0),
  perTask: z
    .array(
      z.object({
        taskId: z.string().length(26),
        taskName: z.string(),
        recordingCount: z.number().int(),
        durationMs: z.number().int(),
      }),
    )
    .max(10),
});
export type ContributionsLifetime = z.infer<typeof ContributionsLifetimeSchema>;

export const ContributionsTimeseriesQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('30d'),
});
export type ContributionsTimeseriesQuery = z.infer<typeof ContributionsTimeseriesQuerySchema>;

export const ContributionsTimeseriesSchema = z.object({
  buckets: z.array(
    z.object({
      bucketDate: z.string(), // 'YYYY-MM-DD' UTC
      durationMs: z.number().int(),
      recordingCount: z.number().int(),
      taskCount: z.number().int(),
    }),
  ),
});
export type ContributionsTimeseries = z.infer<typeof ContributionsTimeseriesSchema>;
