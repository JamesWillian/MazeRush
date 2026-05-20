import { createServer, type IncomingMessage } from 'node:http';

import { WebSocketTransport } from '@colyseus/ws-transport';
import { Server } from 'colyseus';

import { createHealthHandler } from './monitoring/health.js';
import { MazeRoom } from './rooms/MazeRoom.js';
import { logger } from './util/logger.js';

const PORT = Number.parseInt(process.env.PORT ?? '2567', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

// Comma-separated origin whitelist. Empty list = allow any origin (dev).
// In production, set this to your client URL(s) so a malicious site can't
// embed your game and silently sign visitors into a match.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

const startedAt = Date.now();

const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/healthz')) {
    createHealthHandler(startedAt)(req, res);
    return;
  }
  res.statusCode = 404;
  res.end();
});

// Origin gate. The `ws` library hands us the upgrade request's Origin
// header before Colyseus accepts it. We reject anything that didn't come
// from a whitelisted client — protects against:
//   - random websites embedding our WebSocket and tricking visitors,
//   - basic drive-by exploit scanners,
//   - misconfigured production deployments accepting dev traffic.
// CLI clients can spoof Origin, so this is NOT a substitute for the
// per-message validation in MovementValidator; it's a cheap first gate.
function verifyClient(
  info: { origin: string; secure: boolean; req: IncomingMessage },
  callback: (allow: boolean, code?: number, message?: string) => void,
): void {
  if (ALLOWED_ORIGINS.length === 0) {
    callback(true);
    return;
  }
  if (ALLOWED_ORIGINS.includes(info.origin)) {
    callback(true);
    return;
  }
  logger.warn(
    { origin: info.origin, allowed: ALLOWED_ORIGINS },
    'rejected ws upgrade: origin not in whitelist',
  );
  callback(false, 403, 'Forbidden origin');
}

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    verifyClient,
  }),
});

// `filterBy(['code'])` makes the matchmaker only route a join to a room
// whose metadata.code matches the value the client sent. Result: codes are
// the only way into a private room, and a brute-force scanner has ~30 bits
// of entropy to chew through per attempt.
gameServer.define('maze', MazeRoom).filterBy(['code']);

await gameServer.listen(PORT, HOST, undefined, () => {
  logger.info(
    { port: PORT, host: HOST, allowedOrigins: ALLOWED_ORIGINS },
    'mazerush server listening',
  );
});

// Graceful shutdown so in-flight matches get a chance to finish cleanly.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    logger.info({ signal: sig }, 'shutdown requested');
    gameServer
      .gracefullyShutdown()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        logger.error({ err }, 'shutdown error');
        process.exit(1);
      });
  });
}
