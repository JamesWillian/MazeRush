import type { IncomingMessage, ServerResponse } from 'node:http';

// Simple health endpoint. Real metrics (Prometheus, room counts, ccu) land
// later. For now, "is the process alive and responding" is enough for an
// external uptime probe.
//
// CORS `*` is intentional: this is a public liveness probe, not a
// privileged API. Monitoring tools (UptimeRobot, browser-side dashboards)
// need to read it from any origin.
export function createHealthHandler(startedAt: number) {
  return (_req: IncomingMessage, res: ServerResponse): void => {
    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ status: 'ok', uptimeSeconds }));
  };
}
