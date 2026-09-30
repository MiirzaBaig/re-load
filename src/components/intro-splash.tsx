"use client";

import { useEffect, useRef } from "react";
import {
  AR_LOCKUP_VIEWBOX,
  AR_MARK_PATHS,
  AR_WORD_PATHS,
  MARK_PATHS,
  MARK_VIEWBOX,
} from "@/components/reload-logo";
import { useLanguage } from "@/components/language-provider";

/*
 * Opening brand intro, ~1.2s, on a fresh open of the home page only.
 *
 *   0.0–0.8s   Reveal  the two halves of the symbol slide in from a mask
 *   0.8–1.35s  Name    "Reload" slides out from behind the symbol, letter by
 *                      letter, as the symbol eases aside (English; the Arabic
 *                      lockup is one piece of artwork, so it stays symbol-only)
 *   1.35–1.5s  Hold
 *   1.5–1.95s  Whip    symbol and name snap into the navbar together while the
 *                      curtain lifts; the real logo takes over on the same frame
 *
 * Whether it plays is decided before first paint by the `intro-bootstrap`
 * script in app/layout.tsx (sets html[data-intro="play" | "skip"]). The
 * overlay is hidden unless it says "play", so the page can never be stuck
 * behind it. Reveal and settle are pure CSS so they start on the first frame,
 * before hydration; JS only runs the flight. Any click, key, scroll or touch
 * skips straight to the page.
 */

export const INTRO_DONE_EVENT = "reload:intro-done";

const EASE = "cubic-bezier(0.2, 0, 0, 1)";
/** The exit is a whip: slow to leave, fast through the middle, soft landing. */
const WHIP = "cubic-bezier(0.76, 0, 0.18, 1)";
/** Slower build-up (reveal, name, hold), then a quick exit. */
/** Fallback if the reveal's progress can't be read (e.g. tab in background). */
const FLIGHT_AT = 1520;
/** Pause on the finished lockup so the name can be read before it flies. */
const HOLD_MS = 650;
const FLIGHT_MS = 600;

export function IntroSplash() {
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const arRef = useRef<HTMLDivElement>(null);
  const { isArabic } = useLanguage();

  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.intro !== "play") return;
    try {
      sessionStorage.setItem("reload-intro-seen", "1");
    } catch {
      /* private mode: it simply plays again next time */
    }
    window.scrollTo(0, 0);

    const root = rootRef.current;
    const curtain = curtainRef.current;
    // English flies the symbol and the name separately; Arabic flies the
    // whole lockup, which is one piece of artwork in the navbar too.
    const mark = markRef.current ?? arRef.current;
    if (!root || !mark || !curtain) return;

    // Scroll lock lives here, not in CSS, so a failed script can't leave the
    // page unscrollable.
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    const unlock = () => {
      html.style.overflow = previousOverflow;
    };

    let finished = false;
    let landed = false;
    let revealed = false;
    /** The page underneath may start its own entrance (hero headline). Fired
     *  as the curtain begins to lift, so the hero animates in as it's
     *  uncovered instead of flashing blank afterwards. */
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      window.dispatchEvent(new Event(INTRO_DONE_EVENT));
    };
    const running: Animation[] = [];

    const finish = () => {
      if (finished) return;
      finished = true;
      // "landed": the flown name sits exactly on the navbar wordmark, so it
      // appears instantly; "done" (skipped) fades it in instead.
      html.dataset.intro = landed ? "landed" : "done";
      unlock();
      reveal();
      detach();
    };

    const skip = () => {
      if (finished) return;
      running.forEach((a) => a.cancel());
      root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: EASE, fill: "forwards" })
        .finished.then(finish, finish);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") skip();
    };
    const attach = () => {
      window.addEventListener("pointerdown", skip, { once: true });
      window.addEventListener("wheel", skip, { once: true, passive: true });
      window.addEventListener("touchstart", skip, { once: true, passive: true });
      window.addEventListener("keydown", onKey);
    };
    const detach = () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
      window.removeEventListener("keydown", onKey);
    };
    attach();

    // Start the flight when the reveal has *actually* finished, read from the
    // running CSS animations, plus a hold long enough to read the name.
    // Timing from page load instead broke on real phones: first paint can
    // land a second or more after navigation, so the flight fired while the
    // name was still appearing and nobody could read it.
    const wait = revealRemaining(root) + HOLD_MS;
    const flight = window.setTimeout(() => {
      if (finished) return;
      const target = arRef.current ? arabicTarget() : flightTarget();
      if (!target) return skip();
      if (arRef.current) landed = true;
      html.dataset.intro = "lift";
      reveal();

      running.push(
        flyTo(mark, target, target.color),
        // The curtain whips upward, uncovering the page beneath.
        // transform, not clip-path: clip-path repaints the whole screen every
        // frame, which stutters on mid-range phones; a translate stays on the
        // GPU and looks the same.
        curtain.animate(
          [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
          { duration: FLIGHT_MS + 40, easing: WHIP, fill: "forwards" },
        ),
      );
      // The name lands on the navbar wordmark (English only).
      const word = wordRef.current;
      const wordTarget = document.querySelector<HTMLElement>("[data-intro-target] [data-intro-word]");
      if (word && wordTarget && getComputedStyle(word).display !== "none") {
        // Release the slide-out clip, or the name is cut off as it leaves.
        if (word.parentElement) word.parentElement.style.overflow = "visible";
        const r = wordTarget.getBoundingClientRect();
        running.push(flyTo(word, { left: r.left, top: r.top, width: r.width, height: r.height }, target.color));
        landed = true;
      }
      Promise.all(running.map((a) => a.finished)).then(finish, () => {});
    }, wait);

    return () => {
      window.clearTimeout(flight);
      detach();
      running.forEach((a) => a.cancel());
      unlock();
    };
  }, []);

  return (
    <div ref={rootRef} className="intro" aria-hidden="true">
      {/* The curtain is its own layer: when it lifts, the flying symbol must
          not be clipped with it (that made the logo vanish mid-flight). */}
      <div ref={curtainRef} className="intro-curtain" />
      {isArabic ? (
        // Arabic: the supplied lockup, lettering and symbol animated as
        // separate groups of the same unchanged paths. Cursive lettering is
        // revealed as one piece (never letter by letter), flowing leftward.
        <div ref={arRef} className="intro-ar">
          <svg viewBox={AR_LOCKUP_VIEWBOX} fill="currentColor" className="intro-svg">
            <g className="intro-ar-word">
              {AR_WORD_PATHS.map((p) => (
                <path key={p.d.slice(0, 24)} fillRule={p.rule} d={p.d} />
              ))}
            </g>
            <path className="intro-half intro-half-b" d={AR_MARK_PATHS[1]} />
            <path className="intro-half intro-half-a" d={AR_MARK_PATHS[0]} />
          </svg>
        </div>
      ) : (
        <div className="intro-lockup">
          <div ref={markRef} className="intro-mark">
            <svg viewBox={MARK_VIEWBOX} fill="currentColor" className="intro-svg">
              {/* Bottom-left half rises into place first, then the top-right
                  half drops in to meet it. */}
              <path className="intro-half intro-half-b" d={MARK_PATHS[1]} />
              <path className="intro-half intro-half-a" d={MARK_PATHS[0]} />
            </svg>
          </div>
          {/* The name slides out from behind the symbol. */}
          <span className="intro-word-clip">
            <span ref={wordRef} className="intro-word">
              {"Reload".split("").map((letter, i) => (
                <span key={i} style={{ ["--i" as string]: i }}>{letter}</span>
              ))}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

/** Milliseconds left until the intro's reveal animations have all finished.
 *  Ignores the 6s fail-safe animations, which aren't part of the reveal. */
function revealRemaining(root: HTMLElement) {
  try {
    let remaining = 0;
    let found = false;
    for (const animation of root.getAnimations({ subtree: true })) {
      const name = (animation as CSSAnimation).animationName ?? "";
      if (!name.startsWith("intro-") || name === "intro-failsafe") continue;
      const timing = animation.effect?.getComputedTiming();
      const current = Number(animation.currentTime ?? NaN);
      const end = Number(timing?.endTime ?? NaN);
      if (!Number.isFinite(current) || !Number.isFinite(end)) continue;
      found = true;
      remaining = Math.max(remaining, end - current);
    }
    return found ? remaining : FLIGHT_AT;
  } catch {
    return FLIGHT_AT;
  }
}

/** FLIP an element onto a target rect, centre to centre. */
function flyTo(
  el: HTMLElement,
  target: { left: number; top: number; width: number; height: number },
  color: string,
) {
  const from = el.getBoundingClientRect();
  const dx = target.left + target.width / 2 - (from.left + from.width / 2);
  const dy = target.top + target.height / 2 - (from.top + from.height / 2);
  const scale = target.height / from.height;
  return el.animate(
    [
      { transform: "translate(0, 0) scale(1)", color: "#f8f7f4" },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, color },
    ],
    { duration: FLIGHT_MS, easing: WHIP, fill: "forwards" },
  );
}

/** Arabic: the whole lockup lands on the navbar lockup (same artwork). */
function arabicTarget() {
  const lockup = document.querySelector<HTMLElement>("[data-intro-target] [data-intro-lockup]");
  if (!lockup) return null;
  const r = lockup.getBoundingClientRect();
  const color = getComputedStyle(lockup).color;
  return { left: r.left, top: r.top, width: r.width, height: r.height, color };
}

/** Where the symbol lands: the navbar mark (English), or the icon end of the
 *  Arabic lockup, which is one piece of artwork with the symbol on its right. */
function flightTarget() {
  const logo = document.querySelector<HTMLElement>("[data-intro-target]");
  if (!logo) return null;
  const color = getComputedStyle(logo).color;
  const markEl = logo.querySelector<HTMLElement>("[data-intro-mark]");
  if (markEl) {
    const r = markEl.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, color };
  }
  const lockup = logo.querySelector<HTMLElement>("[data-intro-lockup]");
  if (!lockup) return null;
  const r = lockup.getBoundingClientRect();
  // In the supplied Arabic lockup the symbol is ~69% of the artwork height,
  // top-aligned, flush with the right edge.
  const height = r.height * 0.69;
  const width = height * 1.0252;
  return { left: r.right - width, top: r.top, width, height, color };
}
