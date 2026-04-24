"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import AnimatedFallback from "@/components/AnimatedFallback";

type Props = {
  /** HeyGen share URL, e.g. https://labs.heygen.com/guest/streaming-embed?share=... */
  embedUrl: string;
};

/**
 * Renders HeyGen's hosted streaming-embed iframe as an automatic fallback
 * when our primary Live Avatar API integration is unhealthy (spec §4.4).
 *
 * This is a cleaned-up React port of the embed script HeyGen provides —
 * same behaviour (init/show/hide postMessage handshake) but without the
 * fixed-position circle overlay, since we already own the full viewport.
 */
export default function HeyGenFallback({ embedUrl }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const iframe = iframeRef.current;
    if (!wrap || !iframe) return;

    let host: string;
    try {
      host = new URL(embedUrl).origin;
    } catch {
      return;
    }

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== host) return;
      const data = e.data as { type?: string; action?: string } | undefined;
      if (!data || data.type !== "streaming-embed") return;
      switch (data.action) {
        case "init":
          wrap.classList.add("opacity-100");
          break;
        case "show":
        case "hide":
          // Our fallback takes over the full viewport, so HeyGen's
          // circle→expanded transition is a no-op here. We still receive
          // and process these events so the embed considers its parent
          // handshake complete.
          break;
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedUrl]);

  if (!embedUrl) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <AnimatedFallback className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-8 text-center text-white/80">
          <p className="text-sm">
            Avatar temporarily unavailable. Please check back shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-black opacity-0 transition-opacity duration-300"
    >
      {/* Animated poster shown beneath the iframe. Visible while HeyGen's
          embed is loading (or if it never loads) and fades out once the
          iframe signals `load`. */}
      <AnimatedFallback
        className={clsx(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
          iframeLoaded ? "opacity-0" : "opacity-100",
        )}
      />
      <iframe
        ref={iframeRef}
        allow="microphone"
        className={clsx(
          "absolute inset-0 h-full w-full border-0 transition-opacity duration-500",
          iframeLoaded ? "opacity-100" : "opacity-0",
        )}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        src={embedUrl}
        title="HeyGen Streaming Embed (fallback)"
        onLoad={() => setIframeLoaded(true)}
      />
    </div>
  );
}
