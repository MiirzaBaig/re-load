"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * Pixel edge between two colour chapters of a page (idea from phone-harness's
 * "dither band", own implementation). A canvas draws square pixels of one
 * colour along a soft, wavy contour and leaves the rest transparent, so it
 * blends into whatever sits behind it in light and dark mode.
 *
 * direction "up":   colour fills the bottom and scatters upward. Place it just
 *                   above a section of that colour (.dither-edge-top).
 * direction "down": colour fills the top and scatters downward, below a section.
 *
 * The shape is random per visit. It settles once when it scrolls into view,
 * then stays still; with reduced motion it is drawn in place. Hidden unless the
 * public site carries `theme-v2` (see .dither-edge in index.css).
 */

const PIXEL = 4;

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ Math.imul(seed, 0xc2b2ae3d);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
/** 1D value noise in [0, 1]. */
function noise(x: number, seed: number) {
  const i = Math.floor(x);
  const f = smooth(x - i);
  const a = hash(i, 0, seed);
  const b = hash(i + 1, 0, seed);
  return a + (b - a) * f;
}

/** Any CSS colour (including oklab/color-mix) to RGB, via a 1×1 canvas. */
function resolveColour(el: HTMLElement, cssVar: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;width:0;height:0;color:var(${cssVar})`;
  el.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  const c = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!c) return [86, 105, 224];
  c.fillStyle = value;
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

export function DitherEdge({
  color,
  direction = "up",
  className,
}: {
  /** CSS custom property holding the colour, e.g. "--brand-band". */
  color: string;
  direction?: "up" | "down";
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;
    const seed = Math.floor(Math.random() * 1e9);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rgb = resolveColour(host, color);
    let progress = reduce ? 1 : 0;
    let frame = 0;
    // Mouse stir: each column can be pushed away from the pointer, then eases
    // back. Only runs while the pointer is over the edge (fine pointers only).
    let push = new Float32Array(0);
    let stirring = false;

    const draw = () => {
      const cols = Math.max(1, Math.ceil(canvas.clientWidth / PIXEL));
      const rows = Math.max(1, Math.round(canvas.clientHeight / PIXEL));
      if (canvas.width !== cols || canvas.height !== rows) {
        canvas.width = cols;
        canvas.height = rows;
      }
      if (push.length !== cols) push = new Float32Array(cols);
      const image = ctx.createImageData(cols, rows);
      const px = image.data;
      // Settling: the contour starts low (almost no band) and rises into place.
      const lift = (1 - smooth(progress)) * 0.75;
      for (let x = 0; x < cols; x++) {
        // Contour for this column: a broad swell, a mid wave and a fine
        // wobble, so the edge feels drawn by hand rather than generated.
        const wave = 0.55 * noise(x / 140, seed) + 0.3 * noise(x / 46, seed + 7) + 0.15 * noise(x / 12, seed + 9);
        // A low, wide contour: solid colour only near the far end, and a deep
        // dissolve zone above it, so the edge melts in instead of forming a wall.
        const edge = 0.3 + 0.5 * wave + lift + push[x];
        const spread = 0.28 + 0.2 * noise(x / 60, seed + 3);
        for (let y = 0; y < rows; y++) {
          // t: 0 at the far side, 1 where the colour is solid.
          const t = direction === "up" ? y / (rows - 1 || 1) : 1 - y / (rows - 1 || 1);
          const d = (t - (edge - spread)) / (2 * spread);
          // Eased twice: very sparse at the top, filling in only near the end.
          const density = d <= 0 ? 0 : d >= 1 ? 1 : smooth(d) ** 1.6;
          // Faint stray specks above the edge, thinning out upward.
          const speck = t < edge - spread && hash(x, y, seed + 11) < 0.014 * t * t;
          if (hash(x, y, seed) < density || speck) {
            const i = (y * cols + x) * 4;
            // Pixels far from the solid colour are partly see-through, so the
            // sparse part blends into the page behind it.
            const alpha = speck ? 0.35 : 0.4 + 0.6 * Math.min(1, density * 1.4);
            // Pixels near the edge are a touch lighter, which gives depth.
            // Lighten by scaling, not adding, so the pixel keeps its hue
            // (adding equal amounts drifted towards grey on dark green).
            const glow = density < 0.92 && hash(x, y, seed + 5) < 0.3 ? 1.32 : 1;
            px[i] = Math.min(255, Math.round(rgb[0] * glow));
            px[i + 1] = Math.min(255, Math.round(rgb[1] * glow));
            px[i + 2] = Math.min(255, Math.round(rgb[2] * glow));
            px[i + 3] = Math.round(255 * alpha);
          }
        }
      }
      ctx.putImageData(image, 0, 0);
    };

    const settle = () => {
      const start = performance.now();
      const step = (now: number) => {
        progress = Math.min(1, (now - start) / 1300);
        draw();
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    // Pointer over the edge: columns near it dip away a little and spring back.
    let pointerCol = -1;
    const stir = () => {
      let moving = false;
      for (let x = 0; x < push.length; x++) {
        const target = pointerCol < 0 ? 0 : 0.16 * Math.exp(-((x - pointerCol) ** 2) / 260);
        push[x] += (target - push[x]) * 0.14;
        if (Math.abs(target - push[x]) > 0.002) moving = true;
      }
      draw();
      if (moving) frame = requestAnimationFrame(stir);
      else stirring = false;
    };
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onMove = (event: PointerEvent) => {
      if (progress < 1) return;
      const r = canvas.getBoundingClientRect();
      const inside = event.clientY >= r.top - 20 && event.clientY <= r.bottom + 20 && event.clientX >= r.left && event.clientX <= r.right;
      const col = inside ? Math.round((event.clientX - r.left) / PIXEL) : -1;
      if (col === pointerCol) return;
      pointerCol = col;
      if (!stirring) {
        stirring = true;
        frame = requestAnimationFrame(stir);
      }
    };
    if (fine && !reduce) window.addEventListener("pointermove", onMove, { passive: true });

    draw();
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seen.disconnect();
          if (!reduce) settle();
        }
      },
      { threshold: 0.2 },
    );
    seen.observe(canvas);
    const resized = new ResizeObserver(() => draw());
    resized.observe(canvas);
    // Theme switch: re-read the colour and redraw.
    const themed = new MutationObserver(() => {
      rgb = resolveColour(host, color);
      draw();
    });
    themed.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      seen.disconnect();
      resized.disconnect();
      themed.disconnect();
    };
  }, [color, direction]);

  return <canvas ref={ref} aria-hidden="true" className={cn("dither-edge", direction === "up" ? "dither-edge-top" : "dither-edge-bottom", className)} />;
}
