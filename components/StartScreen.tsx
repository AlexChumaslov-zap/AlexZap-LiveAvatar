"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

import HeyGenFallback from "@/components/HeyGenFallback";
import Spinner from "@/components/Spinner";
import { useContainerAspect } from "@/hooks/useContainerAspect";
import { useHeyGenHealth } from "@/hooks/useHeyGenHealth";
import { prewarmMicrophonePermission } from "@/lib/microphone";

type Mode = "idle" | "intro" | "fallback";

export default function StartScreen() {
  const { ref, orientation } = useContainerAspect<HTMLDivElement>();
  const [mode, setMode] = useState<Mode>("idle");
  const [introKey, setIntroKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Phase 1 placeholder for the Live Avatar session status. Phase 2 will
  // flip this to `true` once the SDK reports a working session; for now
  // every intro naturally resolves to the fallback path because no
  // connection is ever established.
  const connectionEstablishedRef = useRef(false);

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

  // Dev-only override: append `?fallback=1` to the URL to preview the
  // HeyGen hosted embed without breaking the API key.
  const [forceFallback, setForceFallback] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setForceFallback(params.get("fallback") === "1");
  }, []);
  const showFallback = mode === "fallback" || forceFallback || useFallback;

  const videoSrc =
    orientation === "portrait" ? "/AZa-intro-mob.mp4" : "/AZa-intro.mp4";

  const playIntro = useCallback(() => {
    setMode("intro");
    setIntroKey((k) => k + 1);
    connectionEstablishedRef.current = false;

    // Call play() synchronously within the click handler so the browser
    // still treats this as a user-gesture and allows audio playback.
    const v = videoRef.current;
    if (v) {
      v.muted = false;
      v.currentTime = 0;
      v.play().catch((err) => {
        // Audio blocked despite the gesture (older iOS, strict autoplay
        // policies). Retry muted so the visual still plays.
        console.warn("Audio playback blocked, retrying muted:", err);
        v.muted = true;
        v.play().catch(() => {});
      });
    }

    // Pre-grant mic permission in parallel so the prompt appears while
    // the intro plays. Fire-and-forget.
    void prewarmMicrophonePermission();

    // Phase 2 will kick off the Live Avatar session here and set
    // connectionEstablishedRef.current = true once the SDK confirms
    // the session is ready.
  }, []);

  const returnToIdle = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    setMode("idle");
  }, []);

  // Fired when the intro video finishes playing. If the Live Avatar
  // session hasn't reported a working connection by now, we drop to the
  // fallback state (Step 3 of the user flow). Phase 2 will branch here
  // to the active avatar UI when `connectionEstablishedRef.current` is
  // true.
  const handleIntroEnded = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    if (connectionEstablishedRef.current) {
      // Phase 2: transition to live avatar session here.
      setMode("idle");
      return;
    }
    setMode("fallback");
  }, []);

  // iOS Safari can pause background media when the mic is activated.
  // Resume automatically while the intro is still meant to be playing.
  const handleVideoPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.ended) return;
    if (mode !== "intro") return;
    if (document.visibilityState === "hidden") return;
    v.play().catch(() => {});
  }, [mode]);

  if (showFallback) {
    return (
      <main ref={ref} className="relative h-full w-full">
        <HeyGenFallback embedUrl={fallbackUrl} />
        {mode === "fallback" && (
          <button
            type="button"
            onClick={returnToIdle}
            aria-label="Back to start"
            className="absolute right-4 top-4 z-30 rounded-full bg-black/50 px-3 py-1 text-sm text-white backdrop-blur hover:bg-black/70"
          >
            Back
          </button>
        )}
      </main>
    );
  }

  return (
    <main ref={ref} className="relative h-full w-full overflow-hidden bg-black">
      <div
        className={clsx(
          "absolute inset-0 bg-cover bg-center transition-opacity duration-500",
          "bg-[url('/AZa-bg.webp')] hover:bg-[url('/AZa-bg-hover-gif.webp')]",
          mode === "idle" ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div
        className={clsx(
          "absolute inset-0 flex items-end justify-center pb-[10%] transition-opacity duration-300",
          mode === "idle" ? "opacity-100" : "pointer-events-none opacity-0",
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

      {/* Intro video stays mounted so play() runs synchronously from the
          click and the user-gesture audio permission is preserved. */}
      <div
        className={clsx(
          "absolute inset-0 z-20 flex items-center justify-center bg-black transition-opacity duration-300",
          mode === "intro" ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          preload="auto"
          onEnded={handleIntroEnded}
          onPause={handleVideoPause}
          className={clsx(
            "absolute",
            orientation === "portrait"
              ? "left-0 right-0 h-auto w-full"
              : "top-0 bottom-0 h-full w-auto",
          )}
        >
          <track kind="captions" />
        </video>

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Spinner runKey={introKey} />
        </div>

        <button
          type="button"
          aria-label="Close intro"
          onClick={returnToIdle}
          className="absolute right-4 top-4 z-30 rounded-full bg-black/50 px-3 py-1 text-sm text-white backdrop-blur hover:bg-black/70"
        >
          Close
        </button>
      </div>
    </main>
  );
}
