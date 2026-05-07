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
          options: { translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
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
