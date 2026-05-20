import { pino } from 'pino';

// Structured JSON logs — easy to ship to any log aggregator, easy to grep in
// dev. To make dev output readable, pipe through pino-pretty:
//   pnpm --filter @mazerush/server dev | pnpm dlx pino-pretty
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'mazerush-server' },
});
