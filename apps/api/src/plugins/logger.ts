import type { LoggerOptions } from 'pino';

export const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-idempotency-key"]',
      'res.headers["set-cookie"]',
    ],
    censor: '[redacted]',
  },
  // Pretty in dev, JSON in prod
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            // Wave-1.5 Item 10 — pin the pino-pretty worker-thread's output to
            // the parent process's stdout fd (fd 1). pino transports run in a
            // worker_thread whose own `process.stdout` is a private fd, so
            // without this `destination: 1` line the
            // `pnpm --filter @humyn/api dev > /tmp/humyn-api.log 2>&1` redirect
            // captures NO request log lines (the worker writes to its private
            // fd, not fd 1). With it, the worker writes back through fd 1 and
            // the redirect captures everything. See pino-pretty README
            // "Programmatic Integration" → `destination`.
            destination: 1,
          },
        },
      }
    : {}),
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.ip,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
};
