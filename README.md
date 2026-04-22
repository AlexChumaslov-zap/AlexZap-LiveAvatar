# Alex ZAP — Live Avatar (rebuild)

Interactive AI avatar for ZAPTEST, built on HeyGen's new Live Avatar API. Designed from day one to be embedded as an `<iframe>` on the ZAPTEST corporate site, in both 16:9 (desktop) and 9:16 (mobile) aspect ratios.

Current status: **Phase 1, MVP step 1** — start screen with background image / hover GIF / intro video on click, plus an automatic health-monitor fallback to HeyGen's hosted embed when our primary API is unhealthy.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 3
- Prisma 6 + SQLite (local dev)
- `@heygen/liveavatar-web-sdk` — wired in a later step

## Prerequisites

- Node.js ≥ 22.13 (22.12 works but throws an `EBADENGINE` warning on one transitive ESLint dep)
- npm 10+

## First-time setup

```bash
npm install
cp .env.example .env       # then fill in real values
npx prisma generate
npx prisma db push         # creates ./dev.db and the HealthEvent table
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

## Next steps (not yet built)

- Access-token endpoint that issues short-lived HeyGen tokens to the browser
- Real Live Avatar session: voice + text conversation, transcript, mode switching
- Conversation persistence (Visitor / Conversation / Message models)
- Admin dashboard (auth, list/detail views, analytics, CRM push)

See the full spec in project memory for the Phase 2 roadmap.
