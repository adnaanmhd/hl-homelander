import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import fp from 'fastify-plugin';
import { buildProblemDetail, PROBLEM_SLUGS } from '../lib/problem-detail.js';

const PROBLEM_CONTENT_TYPE = 'application/problem+json' as const;

async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) => {
    const requestId = (req.id as string) ?? undefined;

    // 1. Zod validation errors → 400 problem-detail with `errors` extension.
    //    fastify-type-provider-zod re-wraps Zod failures inside a FastifyError
    //    with the original ZodError attached as `.cause` or `.validation`,
    //    so we sniff both shapes here.
    const zodIssues =
      err instanceof ZodError
        ? err.issues
        : (err as { cause?: unknown }).cause instanceof ZodError
          ? (err as { cause: ZodError }).cause.issues
          : Array.isArray((err as { validation?: unknown }).validation)
            ? ((err as { validation: unknown[] }).validation as unknown[])
            : null;
    if (zodIssues) {
      const pd = buildProblemDetail({
        slug: PROBLEM_SLUGS.validation,
        title: 'Validation failed',
        status: 400,
        detail: 'Request body or params did not match the schema',
        instance: requestId,
        extensions: { errors: zodIssues },
      });
      req.log.warn({ err, problem: pd }, 'validation_error');
      return reply.status(400).type(PROBLEM_CONTENT_TYPE).send(pd);
    }

    // 2. Fastify-thrown errors with statusCode set
    const fErr = err as FastifyError;
    if (typeof fErr.statusCode === 'number' && fErr.statusCode >= 400 && fErr.statusCode < 600) {
      const status = fErr.statusCode;
      const slug =
        status === 401
          ? PROBLEM_SLUGS.unauthorized
          : status === 403
            ? PROBLEM_SLUGS.forbidden
            : status === 404
              ? PROBLEM_SLUGS.notFound
              : status === 409
                ? PROBLEM_SLUGS.conflict
                : status === 429
                  ? PROBLEM_SLUGS.rateLimited
                  : status >= 500
                    ? PROBLEM_SLUGS.internal
                    : PROBLEM_SLUGS.validation;
      const pd = buildProblemDetail({
        slug,
        title: fErr.name || 'Error',
        status,
        detail: fErr.message,
        instance: requestId,
      });
      if (status >= 500) req.log.error({ err }, 'server_error');
      else req.log.warn({ err }, 'client_error');
      return reply.status(status).type(PROBLEM_CONTENT_TYPE).send(pd);
    }

    // 3. Anything else → 500 with internal slug, message scrubbed
    const pd = buildProblemDetail({
      slug: PROBLEM_SLUGS.internal,
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      instance: requestId,
    });
    req.log.error({ err }, 'unhandled_error');
    return reply.status(500).type(PROBLEM_CONTENT_TYPE).send(pd);
  });
}

export default fp(errorHandlerPlugin, { name: 'error-handler' });
