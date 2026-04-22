"use client";

import { useEffect, useRef, useState } from "react";

export type HealthState = "healthy" | "degraded" | "down" | "unknown";

type Options = {
  intervalMs?: number;
  failureThreshold?: number;
};

export function useHeyGenHealth({
  intervalMs = 30_000,
  failureThreshold = 2,
}: Options = {}) {
  const [state, setState] = useState<HealthState>("unknown");
  const [useFallback, setUseFallback] = useState(false);
  const failCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/heygen-health", { cache: "no-store" });
        const data = (await res.json()) as { state: HealthState };
        if (cancelled) return;

        setState(data.state);

        if (data.state === "healthy") {
          failCount.current = 0;
          setUseFallback(false);
        } else {
          failCount.current += 1;
          if (failCount.current >= failureThreshold) setUseFallback(true);
        }
      } catch {
        if (cancelled) return;
        failCount.current += 1;
        setState("down");
        if (failCount.current >= failureThreshold) setUseFallback(true);
      }
    };

    check();
    const id = window.setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs, failureThreshold]);

  return { state, useFallback };
}
