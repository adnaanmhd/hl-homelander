import type { FastifyInstance } from 'fastify';
import contributionsListRoute from './list.js';
import contributionsTimeseriesRoute from './timeseries.js';

// /contributions/timeseries must register BEFORE /contributions in case the
// router ever materialises a /contributions/:id wildcard — Pattern 28 from
// STATE.md (literal beats parameterized only when registered first).
export default async function contributionsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(contributionsTimeseriesRoute);
  await app.register(contributionsListRoute);
}
