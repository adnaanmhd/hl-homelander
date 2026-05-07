import type { FastifyInstance } from 'fastify';
import tasksListRoute from './list.js';
import tasksGetRoute from './get.js';
import tasksSearchRoute from './search.js';
import taskRequestRoutes from './create-request.js';

// /tasks/search must register BEFORE /tasks/:id so the literal route beats
// the wildcard parameter route in Fastify's radix tree.
export default async function tasksRoutes(app: FastifyInstance) {
  await app.register(tasksListRoute);
  await app.register(tasksSearchRoute);
  await app.register(tasksGetRoute);
  await app.register(taskRequestRoutes);
}
