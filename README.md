# Alex ZAP — Live Avatar (rebuild)

Interactive AI avatar for ZAPTEST, built on HeyGen's new Live Avatar API. Designed from day one to be embedded as an `<iframe>` on the ZAPTEST corporate site, in both 16:9 (desktop) and 9:16 (mobile) aspect ratios.

Current status: **Phase 1, MVP step 1** — start screen with background image / hover GIF / intro video on click, plus an automatic health-monitor fallback to HeyGen's hosted embed when our primary API is unhealthy.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 3
- Prisma 6 + SQLite (local dev)
- `@heygen/liveavatar-web-sdk` — wired in a later step

## Prerequisites

- Node.js 20.x or 22.x (see `engines` in [package.json](./package.json))
- npm 10+
- Git with SSH access to [AlexChumaslov-zap/AlexZap-LiveAvatar](https://github.com/AlexChumaslov-zap/AlexZap-LiveAvatar) (private)

## First-time setup

```bash
npm install                # runs `prisma generate` via postinstall
cp .env.example .env       # then fill in real values
npm run db:migrate         # applies migrations, creates ./dev.db
```

Minimum env vars to boot the app:

| Var | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | server | SQLite file location (`file:./dev.db`) |
| `HEYGEN_API_KEY` | server | Used by `/api/heygen-health` to probe HeyGen |
| `NEXT_PUBLIC_HEYGEN_FALLBACK_EMBED_URL` | client | HeyGen share URL rendered as the fallback iframe |
| `ALLOWED_PARENT_ORIGINS` | server | Space-separated parent origins allowed to embed us |

See [.env.example](./.env.example) for the full list including Phase 2 placeholders.

## Running locally

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint
npm run build
npm start
```

### Test the iframe

Open a minimal host page on another origin (or just a local file) that embeds `http://localhost:3000` in the two target aspect ratios:

```html
<!-- 16:9 -->
<iframe src="http://localhost:3000" allow="microphone"
        style="width:960px;height:540px;border:0"></iframe>
<!-- 9:16 -->
<iframe src="http://localhost:3000" allow="microphone"
        style="width:360px;height:640px;border:0"></iframe>
```

The `allow="microphone"` attribute is required for Phase 2 voice mode and must also be added by the parent site (zaptest.com). Document this to the web team when it's time.

### Test the fallback

The client polls `/api/heygen-health` every `NEXT_PUBLIC_HEALTH_POLL_INTERVAL_MS` (default 30s). After `NEXT_PUBLIC_HEALTH_FAILURE_THRESHOLD` consecutive non-healthy responses, it swaps our start screen for `HeyGenFallback`, which renders the share URL from `NEXT_PUBLIC_HEYGEN_FALLBACK_EMBED_URL` inside an iframe.

To simulate an outage in dev:
- Unset `HEYGEN_API_KEY` in `.env` and restart (`/api/heygen-health` reports `down` immediately), **or**
- Point `HEYGEN_API_KEY` at an invalid value so HeyGen returns 401/403 → `degraded`.

State transitions are logged to the `HealthEvent` table.

## Project layout

```
app/
  api/heygen-health/route.ts   # server-side health probe + audit log
  layout.tsx                   # root layout, global CSS, iframe-safe metadata
  page.tsx                     # mounts StartScreen
  globals.css                  # Tailwind + tiny aspect-ratio helpers
components/
  StartScreen.tsx              # bg image / hover gif / "Talk" CTA / intro video
  HeyGenFallback.tsx           # HeyGen hosted-embed iframe (fallback)
hooks/
  useContainerAspect.ts        # orientation from ResizeObserver (iframe-safe)
  useHeyGenHealth.ts           # client polling of /api/heygen-health
lib/
  prisma.ts                    # PrismaClient singleton
prisma/
  schema.prisma                # HealthEvent model (Phase 2 expands this)
public/                        # AZa-bg.*, AZa-intro*.mp4 — provided assets
next.config.ts                 # security headers (CSP, HSTS, X-Robots-Tag...)
```

## Security posture (Phase 1)

All in place from this commit:

- `Content-Security-Policy` with `frame-ancestors` scoped to `ALLOWED_PARENT_ORIGINS`.
- `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Robots-Tag: noindex, nofollow`.
- `poweredByHeader: false`.
- HeyGen API key stays server-side (consumed only by `/api/heygen-health`); the browser only ever gets the public fallback share URL.

The CSP is deliberately permissive for inline styles/scripts today (Next inlines runtime chunks); we'll tighten to a nonce-based policy before production.

## Deploying to Cloudways

Cloudways hosts the app as a **Node.js application** with Git-based deployment — no Docker needed. Throughout this guide, `<app>` is the Cloudways application short-name **`AlexZap-LiveAvatar`**.

### 1. Create the Cloudways app

- **Application → Create**: pick **Node.js**.
- Runtime: **Node 20.x** (also accepts 22.x per this repo's `engines`).
- Note the app SSH path: `/home/master/applications/AlexZap-LiveAvatar/`.
- Take note of the default Cloudways-assigned URL (e.g. `phpstack-<id>.cloudwaysapps.com` or similar) — we'll use this until a custom domain is bound.

### 2. Persistent storage for SQLite

Cloudways replaces `public_html/` on each deploy — never put the DB there. Create a sibling directory under `private_html/` that the deploy doesn't touch:

```bash
ssh master@<cloudways-server> \
  "mkdir -p /home/master/applications/AlexZap-LiveAvatar/private_html/.data"
```

### 3. Link the GitHub repo

**Application Management → Deployment via Git:**
- Repo: `git@github.com:AlexChumaslov-zap/AlexZap-LiveAvatar.git`
- Branch: `main`
- Deploy path: `public_html`
- Copy Cloudways' generated deploy key and add it as a **Deploy Key** under the GitHub repo's **Settings → Deploy keys** (read-only is enough).

### 4. Deploy command

In **Deployment via Git → Pre-Launch Actions** (Cloudways runs this before starting the app):

```
npm ci && npx prisma migrate deploy && npm run build
```

`prisma generate` runs automatically via `postinstall`. `migrate deploy` applies [prisma/migrations/](./prisma/migrations/) without prompting.

### 5. Start command

**Application Settings → Node.js:**
- Entry point: `node_modules/next/dist/bin/next` with args `start -p 3000`, or `npm start` if the UI accepts it.
- Port: `3000` (Cloudways reverse-proxies from 80/443).

### 6. Environment variables

In **Application Management → Environment Variables**, set:

| Var | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `file:/home/master/applications/AlexZap-LiveAvatar/private_html/.data/alex-zap.db` |
| `HEYGEN_API_KEY` | (real key, server-only) |
| `NEXT_PUBLIC_HEYGEN_FALLBACK_EMBED_URL` | HeyGen share URL |
| `ALLOWED_PARENT_ORIGINS` | `https://www.zaptest.com https://zaptest.com` |
| `NEXT_PUBLIC_HEALTH_POLL_INTERVAL_MS` | `30000` |
| `NEXT_PUBLIC_HEALTH_FAILURE_THRESHOLD` | `2` |
| `NEXT_TELEMETRY_DISABLED` | `1` |

### 7. Domain + SSL

For the initial deploy, use the Cloudways-assigned URL — no extra setup. Two things to know:

- SSL is still essential on the Cloudways URL. Enable **Application Management → SSL Certificate → Let's Encrypt** against the Cloudways hostname. Browsers block mixed content when the parent page is HTTPS.
- When you later bind a real domain (e.g. `avatar.zaptest.com`): add it under **Domain Management**, re-issue Let's Encrypt for that hostname, and update `ALLOWED_PARENT_ORIGINS` if anything other than zaptest.com will embed this app.

### 8. Iframe parent requirements

The page on `zaptest.com` that embeds this app must use:

```html
<iframe src="https://<cloudways-or-custom-domain>/"
        allow="microphone; autoplay"
        style="width:100%; aspect-ratio: 16/9; border:0"></iframe>
```

`allow="microphone"` is mandatory for Phase 2 voice mode — without it, the pre-grant prompt throws `NotAllowedError` and the chat won't work.

### 9. Post-deploy smoke test

Replace `<deploy-url>` with the Cloudways-assigned URL (or your custom domain once bound):

```bash
curl -sI https://<deploy-url>/ | grep -iE "content-security|x-frame|referrer|strict-transport"
curl -s   https://<deploy-url>/api/health          # expect { status: "ok" }
curl -s   https://<deploy-url>/api/heygen-health   # expect { state: "healthy" }
```

### 10. Uptime monitoring

Point an external monitor (UptimeRobot / Better Stack) at **`/api/health`** — it returns 200 as long as the Next.js process is alive, independent of HeyGen. Use `/api/heygen-health` as a separate check if you want a dedicated alert on HeyGen availability.

## Next steps (not yet built)

- Access-token endpoint that issues short-lived HeyGen tokens to the browser
- Real Live Avatar session: voice + text conversation, transcript, mode switching
- Conversation persistence (Visitor / Conversation / Message models)
- Admin dashboard (auth, list/detail views, analytics, CRM push)

See the full spec in project memory for the Phase 2 roadmap.
