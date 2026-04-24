"use client";

import { useState } from "react";

type Props = {
  className?: string;
  alt?: string;
};

/**
 * Multi-tier visual fallback used when the avatar integration is
 * unreachable. Prefers animated WebP (smaller, higher quality), falls
 * back to animated GIF if the browser can't decode animated WebP, then
 * to a static WebP poster if the animated sources fail to load at
 * runtime (network issue, corrupt asset, etc.).
 */
export default function AnimatedFallback({
  className,
  alt = "Avatar temporarily unavailable",
}: Props) {
  const [staticOnly, setStaticOnly] = useState(false);

  if (staticOnly) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/AZa-bg.webp" alt={alt} className={className} />
    );
  }

  return (
    <picture>
      <source srcSet="/AZa-bg-hover-gif.webp" type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/AZa-bg-hover.gif"
        alt={alt}
        className={className}
        onError={() => setStaticOnly(true)}
      />
    </picture>
  );
}
