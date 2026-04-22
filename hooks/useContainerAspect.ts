"use client";

import { useEffect, useRef, useState } from "react";

export type Orientation = "landscape" | "portrait";

export function useContainerAspect<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("landscape");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setOrientation(width >= height ? "landscape" : "portrait");
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, orientation } as const;
}
