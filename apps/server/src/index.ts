import { createServer } from 'node:http';

import { WebSocketTransport } from '@colyseus/ws-transport';
import { Server } from 'colyseus';

import { createHealthHandler } from './monitoring/health.js';
import { MazeRoom } from './rooms/MazeRoom.js';
import { logger } from './util/logger.js';

const PORT = Number.parseInt(process.env.PORT ?? '2567', 10);
const startedAt = Date.now();

// We build the http.Server ourselves so the same port serves HTTP routes
// (currently just /health) AND the WebSocket upgrade Colyseus needs.
// WebSocketTransport hooks the 'upgrade' event; this handler only sees
// normal GET/POST requests.
const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/healthz')) {
    createHealthHandler(startedAt)(req, res);
    return;
  }
  res.statusCode = 404;
  res.end();
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// `filterBy(['code'])` makes the matchmaker only route a join to a room
// whose metadata.code matches the value the client sent. Result: codes are
// the only way into a private room, and a brute-force scanner has ~30 bits
// of entropy to chew through per attempt.
gameServer.define('maze', MazeRoom).filterBy(['code']);

await gameServer.listen(PORT);
logger.info({ port: PORT }, 'mazerush server listening');

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
