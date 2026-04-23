import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight liveness probe for uptime monitoring (UptimeRobot, Better Stack,
 * Cloudways monitoring, load-balancer health check). Deliberately does **not**
 * probe HeyGen — that's what /api/heygen-health is for. This endpoint should
 * return 200 as long as the Next.js process can accept requests.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok", ts: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
