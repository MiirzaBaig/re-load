"use client";

import { useEffect, useRef } from "react";

/*
 * A one-time burst of small green squares behind a success mark, for real
 * milestones only (a policy going live). Squares fly out, slow down and fade,
 * then the canvas is empty. Nothing runs with reduced motion.
 */
export function PixelBurst({ size = 220 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    ctx.scale(ratio, ratio);
    const colour = getComputedStyle(canvas).color || "#059669";
    const bits = Array.from({ length: 42 }, (_, i) => {
      const angle = (i / 42) * Math.PI * 2 + Math.random() * 0.3;
      const reach = size * (0.24 + Math.random() * 0.22);
      return { angle, reach, side: Math.random() < 0.35 ? 6 : 4, delay: Math.random() * 120 };
    });
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      ctx.clearRect(0, 0, size, size);
      let alive = false;
      for (const b of bits) {
        const t = Math.min(1, Math.max(0, (now - start - b.delay) / 900));
        if (t < 1) alive = true;
        const ease = 1 - (1 - t) ** 3;
        const r = 18 + ease * b.reach;
        // Snap to a 2px grid so the squares stay crisp, like the pixel edges.
        const x = Math.round((size / 2 + Math.cos(b.angle) * r) / 2) * 2;
        const y = Math.round((size / 2 + Math.sin(b.angle) * r) / 2) * 2;
        ctx.globalAlpha = t === 0 ? 0 : (1 - t) ** 1.4;
        ctx.fillStyle = colour;
        ctx.fillRect(x - b.side / 2, y - b.side / 2, b.side, b.side);
      }
      if (alive) frame = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, size, size);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [size]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-eligible"
      style={{ width: size, height: size }}
    />
  );
}
