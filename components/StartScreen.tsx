"use client";

import { useCallback, useRef, useState } from "react";
import clsx from "clsx";

import HeyGenFallback from "@/components/HeyGenFallback";
import { useContainerAspect } from "@/hooks/useContainerAspect";
import { useHeyGenHealth } from "@/hooks/useHeyGenHealth";

type Mode = "idle" | "intro";

export default function StartScreen() {
  const { ref, orientation } = useContainerAspect<HTMLDivElement>();
  const [mode, setMode] = useState<Mode>("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fallbackUrl = process.env.NEXT_PUBLIC_HEYGEN_FALLBACK_EMBED_URL ?? "";
  const pollIntervalMs = Number(
    process.env.NEXT_PUBLIC_HEALTH_POLL_INTERVAL_MS ?? 30_000,
  );
  const failureThreshold = Number(
    process.env.NEXT_PUBLIC_HEALTH_FAILURE_THRESHOLD ?? 2,
  );

  const { useFallback } = useHeyGenHealth({
    intervalMs: pollIntervalMs,
    failureThreshold,
  });

  const videoSrc =
    orientation === "portrait" ? "/AZa-intro-mob.mp4" : "/AZa-intro.mp4";

  const playIntro = useCallback(async () => {
    setMode("intro");
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = true;
      v.playsInline = true;
      await v.play();
    } catch {
      // Autoplay rejected despite user gesture — leave the poster frame up.
    }
  }, []);

  const returnToIdle = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    setMode("idle");
  }, []);

  if (useFallback) {
    return (
      <main ref={ref} className="h-full w-full">
        <HeyGenFallback embedUrl={fallbackUrl} />
      </main>
    );
  }

  return (
    <main ref={ref} className="relative h-full w-full overflow-hidden bg-black">
      <div
        className={clsx(
          "absolute inset-0 bg-cover bg-center transition-opacity duration-500",
          "bg-[url('/AZa-bg.webp')] hover:bg-[url('/AZa-bg-hover-gif.webp')]",
          mode === "idle"
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <div
        className={clsx(
          "absolute inset-0 flex items-end justify-center pb-[10%] transition-opacity duration-300",
          mode === "idle"
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          onClick={playIntro}
          className={clsx(
            "rounded-full px-8 py-3 text-xl font-bold text-white shadow-xl",
            "bg-gradient-to-tr from-zap-red to-zap-red-dark",
            "animate-pulse-ring hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400/50",
            "sm:text-2xl",
          )}
        >
          Talk
        </button>
      </div>

      {mode === "intro" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            playsInline
            preload="auto"
            onEnded={returnToIdle}
            className={clsx(
              "absolute",
              orientation === "portrait"
                ? "left-0 right-0 h-auto w-full"
                : "top-0 bottom-0 h-full w-auto",
            )}
          >
            <track kind="captions" />
          </video>
          <button
            type="button"
            aria-label="Close intro"
            onClick={returnToIdle}
            className="absolute right-4 top-4 z-30 rounded-full bg-black/50 px-3 py-1 text-sm text-white backdrop-blur hover:bg-black/70"
          >
            Close
          </button>
        </div>
      )}
    </main>
  );
}
