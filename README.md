# MazeRush

3D multiplayer maze game in the browser. TypeScript + Three.js client, authoritative Colyseus server, shared package for deterministic maze generation and protocol types.

## Stack

- **Client**: TypeScript (strict), Vite, Three.js, colyseus.js
- **Server**: Node 20+, TypeScript, Colyseus 0.16, `@colyseus/schema`
- **Shared**: pure TS, used by both sides (maze gen, types, constants)
- **Tooling**: pnpm workspaces, ESLint, Prettier, Vitest

## Repository layout

```
MazeRush/
├── apps/
│   ├── client/      # Vite + Three.js
│   └── server/      # Colyseus authoritative server
├── packages/
│   └── shared/      # Pure TS used on both sides
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .eslintrc.cjs
└── .prettierrc
```

## Requirements

- Node.js >= 20
- pnpm >= 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)

## Common scripts (run at repo root)

```bash
pnpm install      # install all workspaces
pnpm dev          # build shared once, then watch client + server + shared in parallel
pnpm build        # production build of every workspace
pnpm typecheck    # tsc --noEmit on each workspace
pnpm test         # Vitest across packages that ship tests
pnpm lint         # ESLint + Prettier --check
pnpm format       # Prettier --write
pnpm clean        # nuke all dist/ and node_modules/
```

Per-workspace scripts (run with `pnpm --filter <pkg> <script>`):

| Package             | dev                      | build                | test           |
| ------------------- | ------------------------ | -------------------- | -------------- |
| `@mazerush/shared`  | `tsc -w`                 | `tsc`                | `vitest run`   |
| `@mazerush/client`  | `vite`                   | `tsc --noEmit && vite build` | `vitest run` |
| `@mazerush/server`  | `tsx watch src/index.ts` | `tsc`                | `vitest run`   |

## Why a monorepo

The maze generator runs on both sides: the server generates authoritatively, the client regenerates from the seed it receives. Sharing message types and constants in a pure-TS package eliminates client/server desync.

## Deployment

See [DEPLOY.md](DEPLOY.md). MVP setup is **client on Vercel** (free
forever) and **server on your own machine + Cloudflare Tunnel** (also
free). Total cost while your machine is on: $0/month.

## Roadmap

1. ✅ Monorepo skeleton — pnpm workspaces, tsconfig base, ESLint/Prettier, root scripts.
2. ✅ `shared` package — types, constants, seeded RNG, recursive backtracker + Vitest determinism tests.
3. ✅ Standalone client — Three.js scene, `InstancedMesh` walls, PointerLock FPS controls, local AABB collision.
4. ✅ Minimal Colyseus server — `MazeRoom` that generates a seed, accepts connections, tracks players.
5. ✅ Wire client ↔ server — input messages up, state down, naive remote rendering.
6. ✅ Client prediction + reconciliation for local player; remote interpolation buffer.
7. ✅ Server-side validation — speed cap, AABB vs maze, snap-back on cheat.
8. ✅ Game modes — flag pickup, exits, win conditions.
9. ✅ Lobby + HUD + EndScreen.
10. ✅ Deploy guide — Vercel client + Cloudflare Tunnel server, Origin check, env config.
