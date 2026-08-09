<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# traincore project notes

Free fitness PWA: challenges (admin-created, badge on ML-verified completion), competitions (admin-only, best-attempt leaderboard), text-only communities (open to all). No roles — every account is a plain user; the only special account is the admin (ADMIN_EMAIL). Live rep counting runs fully client-side (MediaPipe Pose Landmarker); only final rep counts reach the server.

## Commands
- `docker compose up -d` — Postgres 16 on **localhost:5433**
- `npm run dev` / `npm run build && npm start` (SW active in prod only)
- `npx prisma migrate dev`, `npm run db:seed` (idempotent), `npx prisma studio`
- Phone/camera testing: `npm run dev -- --experimental-https` + LAN IP

## Conventions
- Reads: server components call Prisma directly. Mutations + polled reads: `src/app/api/*` route handlers with zod + `src/lib/authz.ts` helpers (`requireUser/Admin/Member`), errors via `src/lib/api.ts#handleRouteError`.
- Auth: Auth.js v5, Google only, JWT sessions; DB (not the token) is the source of truth for isAdmin/onboarded. Admin = `ADMIN_EMAIL` env matched in `events.createUser`.
- Attempts are anti-cheat gated: single-use server-timed `AttemptToken` (`src/lib/anticheat.ts`) — never trust client reps/duration blindly.
- ML: `src/ml/` — per-exercise hysteresis state machines over joint angles; assets self-hosted in `public/{models,mediapipe}` (gitignored, restored by `npm install` postinstall).
- Deployment: intentionally none; localhost only. Do NOT propose Vercel.
- Git: author is arafatmollik, no AI attribution in commit messages.
