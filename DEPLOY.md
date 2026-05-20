# Deploy guide

The MVP architecture: **client on Vercel (static hosting, free), server on
your own machine** exposed to the internet via Cloudflare Tunnel (also free,
no credit card). Total cost: $0/month while your PC is on.

```
   Browser ──► mazerush.vercel.app          (Vercel: static, free forever)
                       │
                       │   WSS over HTTPS
                       ▼
            <random>.trycloudflare.com      (Cloudflare Tunnel: free)
                       │
                       ▼
              localhost:2567                (your machine, running pnpm start)
```

---

## 1. Server: your machine + Cloudflare Tunnel

### Install dependencies once

```bash
brew install cloudflared           # macOS — see cloudflare.com docs for other OSes
```

### Configure the server

Copy `apps/server/.env.example` to `apps/server/.env` and fill it in. The
two important fields:

```bash
HOST=127.0.0.1                                  # only the tunnel can reach you
ALLOWED_ORIGINS=https://mazerush.vercel.app     # whatever Vercel assigns
```

If you don't know your Vercel URL yet, leave `ALLOWED_ORIGINS` empty for
the first round, deploy the client, then come back and fill it in.

### Build and start the server

```bash
pnpm install                                                       # once
pnpm --filter @mazerush/shared build
pnpm --filter @mazerush/server build
pnpm --filter @mazerush/server start
```

You should see:

```
mazerush server listening   { port: 2567, host: '127.0.0.1', allowedOrigins: [...] }
```

### Open the tunnel

In a separate terminal:

```bash
cloudflared tunnel --url http://localhost:2567
```

Look for a line like:

```
INF +--------------------------------------------------------------------------+
INF | Your quick Tunnel has been created! Visit it at (it may take a few...) |
INF | https://random-words-here.trycloudflare.com                              |
INF +--------------------------------------------------------------------------+
```

That HTTPS URL is your server. **Important**: in the client you point at
`wss://` (WebSocket Secure), not `https://`. Same hostname, different
scheme.

> **Note**: quick tunnels get a new URL every time `cloudflared` restarts.
> For a stable URL, follow [Cloudflare's named-tunnel guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/) — still free.

### Keep it running in the background (optional)

Foreground for testing is fine. For a "leave it running" setup, install
`pm2` and:

```bash
npm install -g pm2
pm2 start "pnpm --filter @mazerush/server start" --name mazerush-server
pm2 start "cloudflared tunnel --url http://localhost:2567" --name mazerush-tunnel
pm2 save
```

`pm2 logs` shows both processes. `pm2 stop all` to shut down.

---

## 2. Client: Vercel

### One-time setup

1. Go to [vercel.com/new](https://vercel.com/new), import the GitHub repo
   `JamesWillian/MazeRush`.
2. **Framework Preset**: Other (don't pick Vite — we already configured the
   build via `vercel.json`).
3. **Root Directory**: leave as `./` (repo root). The `vercel.json` at the
   root tells Vercel to build the monorepo correctly.
4. **Build & Output Settings**: leave the auto-detected values — they come
   from `vercel.json`.
5. **Environment Variables**: add `VITE_SERVER_URL` with your tunnel URL,
   prefixed with `wss://`:
   ```
   VITE_SERVER_URL = wss://your-tunnel.trycloudflare.com
   ```
6. Click **Deploy**.

Vercel gives you a URL like `mazerush-yourname.vercel.app`. Visit it — the
client should connect to your server.

### Updating

Every push to `main` triggers a Vercel rebuild automatically. No manual
step needed.

### Adding a custom domain (optional)

Vercel → Project → Settings → Domains. Free with HTTPS automatic. After
adding, update the server's `ALLOWED_ORIGINS` to include the new domain.

---

## 3. Wiring it together

After both sides are live, double-check the loop:

1. Visit your Vercel URL. Status overlay should say "Connecting to
   server…" then "Connected as guest-XXXX".
2. Browser DevTools → Network → WS tab. You should see an upgrade to
   `wss://your-tunnel...` returning 101.
3. Server terminal should log `maze room created` when the first client
   connects.
4. If the WebSocket fails:
   - **403 Forbidden origin** in server logs → `ALLOWED_ORIGINS` doesn't
     include the Vercel URL. Add it, restart the server.
   - **Connection refused / 502** → the tunnel isn't pointing at a running
     server, or the server crashed.
   - **CORS error in browser** → you're hitting an HTTPS endpoint, not a
     WSS one. Recheck `VITE_SERVER_URL`.

---

## 4. Future: deploying the server to a cloud VM

If you outgrow self-hosting:

- **Fly.io**: smallest machine ~$2/mo, region `gru` (São Paulo) is closest
  for Brazilian players. Needs a credit card; $5/mo of free credit covers
  this size.
- **Hetzner**: €4/mo (~R$ 20), no free tier but cheaper than Fly long-term.
- **Oracle Cloud Always Free**: free forever, ARM-based VMs, annoying
  signup but the resources are real.

For any of these, you'd want a `Dockerfile` (not currently in the repo —
self-hosting doesn't need one). Easy to add when the time comes:

```dockerfile
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mazerush/shared build
RUN pnpm --filter @mazerush/server build
RUN pnpm --filter @mazerush/server deploy --prod /out

FROM node:20-alpine
WORKDIR /app
COPY --from=build /out .
EXPOSE 2567
CMD ["node", "dist/index.js"]
```
