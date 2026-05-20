import type { IncomingMessage, ServerResponse } from 'node:http';

// Simple health endpoint. Real metrics (Prometheus, room counts, ccu) land
// in Step 10. For now, "is the process alive and responding" is enough for
// an external uptime probe like UptimeRobot.
export function createHealthHandler(startedAt: number) {
  return (_req: IncomingMessage, res: ServerResponse): void => {
    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptimeSeconds }));
  };
}
