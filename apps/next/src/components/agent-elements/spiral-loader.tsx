"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import * as lottieReact from "lottie-react";
import type { LottieRefCurrentProps } from "lottie-react";
import { cn } from "./utils/cn";
import { spiralFastData, spiralSlowData } from "./spiral-loader-data";
// Island edit: the island is a Vite SPA with no `next-themes` provider, so its `useTheme()` returns
// `resolvedTheme: undefined` and `needsInvert` was permanently true (loader inverted in BOTH themes).
// Read the island's own theme (uiStore toggles `.dark` on <html>) and resolve it instead.
import { resolveTheme, useUiStore } from "@/state/uiStore";

// Island edit: this kit file shipped with Next.js `next/dynamic` (`ssr:false`) — the island is a
// Vite SPA with no SSR, so import lottie-react directly. Vite's default `mainFields` prefers
// lottie-react's `browser` (UMD) build, and esbuild's dev interop does NOT honor its `__esModule`
// flag — so the namespace's `.default` is the whole `module.exports` object and the real component
// sits one (or more) `.default` levels deeper. Drill through `.default` wrappers until we reach the
// actual function component, which works for every interop shape (ESM default, CJS-namespace, UMD).
// (Editing the installed component is the Agent Elements convention.)
function resolveComponent(mod: unknown): ComponentType<Record<string, unknown>> {
  let candidate: unknown = mod;
  while (
    candidate &&
    typeof candidate !== "function" &&
    typeof candidate === "object" &&
    "default" in (candidate as Record<string, unknown>)
  ) {
    candidate = (candidate as { default: unknown }).default;
  }
  return candidate as ComponentType<Record<string, unknown>>;
}
const Lottie = resolveComponent(lottieReact);

const FAST_REPEATS = 4;
const SLOW_REPEATS = 2;

export type SpiralLoaderProps = {
  size?: number;
  className?: string;
};

export function SpiralLoader({ size = 16, className }: SpiralLoaderProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [phase, setPhase] = useState<"fast" | "slow">("fast");
  const repeatCountRef = useRef(0);
  const fastRef = useRef<LottieRefCurrentProps | null>(null);
  const slowRef = useRef<LottieRefCurrentProps | null>(null);
  const themePref = useUiStore((s) => s.theme);
  const resolvedTheme = resolveTheme(themePref);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const startFastPhase = useCallback(() => {
    repeatCountRef.current = 0;
    setPhase("fast");
    slowRef.current?.stop();
    fastRef.current?.goToAndPlay(0, true);
  }, []);

  const startSlowPhase = useCallback(() => {
    repeatCountRef.current = 0;
    setPhase("slow");
    fastRef.current?.stop();
    slowRef.current?.goToAndPlay(0, true);
  }, []);

  const handleFastComplete = useCallback(() => {
    repeatCountRef.current += 1;
    if (repeatCountRef.current < FAST_REPEATS) {
      fastRef.current?.goToAndPlay(0, true);
    } else {
      startSlowPhase();
    }
  }, [startSlowPhase]);

  const handleSlowComplete = useCallback(() => {
    repeatCountRef.current += 1;
    if (repeatCountRef.current < SLOW_REPEATS) {
      slowRef.current?.goToAndPlay(0, true);
    } else {
      startFastPhase();
    }
  }, [startFastPhase]);

  if (!isMounted) return null;
  const needsInvert = resolvedTheme !== "dark";

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-75",
          needsInvert && "bg-foreground",
          phase === "fast" ? "opacity-100" : "opacity-0",
        )}
      >
        <Lottie
          lottieRef={fastRef}
          animationData={spiralFastData}
          loop={false}
          autoplay={true}
          onComplete={handleFastComplete}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-75",
          needsInvert && "invert",
          phase === "slow" ? "opacity-100" : "opacity-0",
        )}
      >
        <Lottie
          lottieRef={slowRef}
          animationData={spiralSlowData}
          loop={false}
          autoplay={false}
          onComplete={handleSlowComplete}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
