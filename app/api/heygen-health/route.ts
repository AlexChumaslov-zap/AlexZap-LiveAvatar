import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// HeyGen's Streaming Avatar API (api.heygen.com/v1/streaming.*) was sunset
// in March 2026. The new LiveAvatar API lives at a different host. Probing
// `/v1/users/credits` validates the key, confirms the service is up, and
// doesn't consume session quota.
const PROBE_URL = "https://api.liveavatar.com/v1/users/credits";
const TIMEOUT_MS = 5_000;

type HealthState = "healthy" | "degraded" | "down";

let lastLoggedState: HealthState | null = null;

async function probe(): Promise<{
  state: HealthState;
  latencyMs: number;
  detail?: string;
}> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return { state: "down", latencyMs: 0, detail: "HEYGEN_API_KEY missing" };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(PROBE_URL, {
      method: "GET",
      headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;

    if (res.ok) return { state: "healthy", latencyMs };
    if (res.status >= 500) {
      return { state: "down", latencyMs, detail: `HTTP ${res.status}` };
    }
    return { state: "degraded", latencyMs, detail: `HTTP ${res.status}` };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
    return { state: "down", latencyMs, detail };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const result = await probe();

  if (result.state !== lastLoggedState) {
    lastLoggedState = result.state;
    try {
      await prisma.healthEvent.create({
        data: {
          state: result.state,
          detail: result.detail,
          latencyMs: result.latencyMs,
        },
      });
    } catch {
      // DB logging is best-effort; never fail the probe because of it.
    }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
