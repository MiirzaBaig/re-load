/**
 * Eased in-page scrolling.
 *
 * A bare `#anchor` link jumps instantly, and the browser's own
 * `behavior: "smooth"` uses a short fixed curve that still reads as a jump
 * across a tall page. This glides with a duration that scales with distance,
 * respects the target's `scroll-margin-top` (so it clears the floating
 * header), stops the moment the visitor scrolls themselves, and honours
 * "Reduce motion" by jumping directly.
 */

let activeFrame = 0;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function smoothScrollToId(id: string, { updateHash = true } = {}) {
  const target = document.getElementById(id);
  if (!target) return false;

  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const end = target.getBoundingClientRect().top + window.scrollY - margin;
  const start = window.scrollY;
  const distance = end - start;

  if (updateHash) history.replaceState(null, "", `#${id}`);

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || Math.abs(distance) < 2) {
    window.scrollTo(0, end);
    return true;
  }

  // 650ms for a short hop, up to 1100ms across the page.
  const duration = Math.min(1100, 650 + Math.abs(distance) * 0.12);
  const startedAt = performance.now();

  cancelAnimationFrame(activeFrame);
  const stop = () => {
    cancelAnimationFrame(activeFrame);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };
  // The visitor takes over: never fight a scroll they started.
  window.addEventListener("wheel", stop, { passive: true, once: true });
  window.addEventListener("touchstart", stop, { passive: true, once: true });
  window.addEventListener("keydown", stop, { once: true });

  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));
    if (progress < 1) activeFrame = requestAnimationFrame(tick);
    else stop();
  };
  activeFrame = requestAnimationFrame(tick);
  return true;
}

/** onClick for `<a href="#id">`: glides instead of jumping. */
export function smoothAnchorClick(event: React.MouseEvent<HTMLAnchorElement>) {
  const href = event.currentTarget.getAttribute("href") ?? "";
  if (!href.startsWith("#")) return;
  if (smoothScrollToId(href.slice(1))) event.preventDefault();
}
