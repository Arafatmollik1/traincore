# Traincore

A completely free, mobile-first fitness PWA. The admin posts challenges and runs weekly competitions, and everyone hangs out in text-only communities — with **live AI rep counting**: you open your selfie camera, do pushups, and the app counts them in real time.

**No video is ever uploaded or stored.** Pose estimation runs entirely on your device (MediaPipe Pose Landmarker, WASM/GPU); only the final rep count is sent to the server.

## Features

- 🏋️ **Challenges** — admin-created ("50 pushups in 5 minutes"); anyone attempts them with the camera, and hitting the target earns a badge on your profile.
- 🏆 **Competitions** — admin-only creation, time-boxed (e.g. one week), unlimited attempts, best verified attempt wins, live leaderboard.
- 💬 **Community** — Reddit-style but text-only: communities, posts, comments, nested replies. No votes, no images.
- 📲 **Installable PWA** — add to home screen on Android/iOS; ML assets are cached offline after first use.
- 🤖 **Exercises**: pushups, squats, sit-ups, jumping jacks — each counted by a joint-angle state machine on top of 33-point pose landmarks.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind v4 · Prisma + Postgres 16 (Docker) · Auth.js v5 (Google sign-in only) · MediaPipe Tasks Vision · hand-rolled service worker.

## Getting started

Prereqs: Node 20+, Docker Desktop.

```bash
# 1. Install deps (also copies the ML WASM runtime + downloads the pose model)
npm install

# 2. Start Postgres (localhost:5433)
docker compose up -d

# 3. Configure env
cp .env.example .env
#    - AUTH_SECRET:  openssl rand -base64 32
#    - ADMIN_EMAIL:  the Google account email that should get admin rights
#    - Google OAuth: see below

# 4. Create tables + demo data
npx prisma migrate dev
npm run db:seed

# 5. Run
npm run dev            # http://localhost:3000
```

### Google OAuth setup (one-time, ~2 minutes)

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) and create a project if needed.
2. Configure the OAuth consent screen (External, add yourself as a test user).
3. Create Credentials → OAuth client ID → **Web application**:
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Put the client ID/secret into `.env` as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` and restart the dev server.

The account whose email matches `ADMIN_EMAIL` becomes admin on first sign-in — only the admin can create challenges and competitions; everyone else attempts, competes, and uses communities.

### Testing the camera on your phone

Camera access needs HTTPS off-localhost:

```bash
npm run dev -- --experimental-https
# then open https://<your-mac-lan-ip>:3000 on the phone (accept the certificate)
```

Your phone and Mac must be on the same Wi-Fi. From there you can also test "Add to Home Screen".

### Useful commands

```bash
npx prisma studio      # browse the database
npm run db:seed        # idempotent demo data (3 users, challenges, competitions, a community)
npm run build && npm start   # production build (service worker is active only in production)
```

## How rep counting works

`src/ml/` — a lazy-loaded pose landmarker singleton (`pose.ts`), joint-angle helpers with EMA smoothing (`angles.ts`), and one hysteresis state machine per exercise (`exercises/*.ts`). A rep only counts on a full bottom→top cycle across two far-apart thresholds (e.g. pushup: elbow < 95° then > 150°), with a minimum cycle time so jitter can't double-count and a visibility gate that pauses counting when you leave the frame.

Anti-cheat is intentionally lightweight (`src/lib/anticheat.ts`): server-issued single-use attempt tokens (server-side timing), plausibility caps on reps/minute, and an attempt rate limit. It's a fun free app — a determined cheater is accepted as a cost.

## Deployment

Not set up yet by design — the app currently targets local development. All it needs eventually: a Node host for Next.js, a Postgres database, and updated Google OAuth redirect URIs.
