"use client";

import { useEffect, useRef } from "react";
import { MARK_PATHS, MARK_VIEWBOX } from "@/components/reload-logo";
import { WELCOME_DONE_EVENT } from "@/components/admin/welcome-script";

/*
 * The desk's welcome, once per sign-in (~1.3s): the symbol builds from its
 * two halves (as on the website), a greeting and today's one-line summary
 * rise beneath it, then the symbol flies into the header logo while the
 * curtain lifts. Any click or key skips it.
 *
 * Whether it plays is decided before first paint by WELCOME_BOOTSTRAP
 * (html[data-admin-welcome="play"]); otherwise the overlay never renders
 * visibly. While it plays, the dashboard's own entrance waits, then starts as
 * the curtain lifts (see the .desk-stagger rules in index.css).
 */


const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const WHIP = "cubic-bezier(0.76, 0, 0.18, 1)";
/** Build (~0.75s) plus a beat to read the greeting. */
const FLIGHT_AT = 1250;
const FLIGHT_MS = 520;

export function AdminWelcome({ greeting, summary }: { greeting: string; summary: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.adminWelcome !== "play") return;
    const root = rootRef.current;
    const curtain = curtainRef.current;
    const mark = markRef.current;
    const text = textRef.current;
    if (!root || !curtain || !mark || !text) return;

    let finished = false;
    const running: Animation[] = [];
    const finish = () => {
      if (finished) return;
      finished = true;
      html.dataset.adminWelcome = "done";
      window.dispatchEvent(new Event(WELCOME_DONE_EVENT));
      detach();
    };
    const lift = () => {
      // The dashboard starts its entrance as it is uncovered.
      html.dataset.adminWelcome = "lift";
      window.dispatchEvent(new Event(WELCOME_DONE_EVENT));
    };
    const skip = () => {
      if (finished) return;
      running.forEach((a) => a.cancel());
      lift();
      root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: EASE, fill: "forwards" }).finished.then(finish, finish);
    };
    const attach = () => {
      window.addEventListener("pointerdown", skip, { once: true });
      window.addEventListener("keydown", skip, { once: true });
      window.addEventListener("wheel", skip, { once: true, passive: true });
    };
    const detach = () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
    };
    attach();

    const timer = window.setTimeout(() => {
      if (finished) return;
      const target = logoTarget();
      lift();
      running.push(
        text.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px)" }], { duration: 240, easing: EASE, fill: "forwards" }),
        curtain.animate([{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }], { duration: FLIGHT_MS + 60, easing: WHIP, fill: "forwards" }),
      );
      if (target) {
        const from = mark.getBoundingClientRect();
        const dx = target.left + target.width / 2 - (from.left + from.width / 2);
        const dy = target.top + target.height / 2 - (from.top + from.height / 2);
        running.push(mark.animate(
          [{ transform: "translate(0, 0) scale(1)", color: "#f8f7f4" }, { transform: `translate(${dx}px, ${dy}px) scale(${target.height / from.height})`, color: target.color }],
          { duration: FLIGHT_MS, easing: WHIP, fill: "forwards" },
        ));
      } else {
        running.push(mark.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: EASE, fill: "forwards" }));
      }
      Promise.all(running.map((a) => a.finished)).then(finish, () => {});
    }, FLIGHT_AT);

    return () => {
      window.clearTimeout(timer);
      detach();
      running.forEach((a) => a.cancel());
      // Leave the state alone: React runs effects twice in development, and
      // the second run must still see "play". The CSS fail-safe covers a
      // genuine unmount mid-welcome.
    };
  }, []);

  return <div ref={rootRef} className="admin-welcome" aria-hidden="true">
    <div ref={curtainRef} className="admin-welcome-curtain" />
    <div className="admin-welcome-stack">
      <div ref={markRef} className="admin-welcome-mark">
        <svg viewBox={MARK_VIEWBOX} fill="currentColor" className="block size-full overflow-hidden">
          <path className="intro-half admin-welcome-b" d={MARK_PATHS[1]} />
          <path className="intro-half admin-welcome-a" d={MARK_PATHS[0]} />
        </svg>
      </div>
      <div ref={textRef} className="admin-welcome-text">
        <p suppressHydrationWarning className="admin-welcome-greeting">{greeting}</p>
        <p suppressHydrationWarning className="admin-welcome-summary">{summary}</p>
      </div>
    </div>
  </div>;
}

/** The header's symbol (English lockup), or the symbol end of the Arabic
 *  lockup, which is one piece of artwork with the symbol on its right. */
function logoTarget() {
  const logo = document.querySelector<HTMLElement>(".admin-desk header [data-intro-target]");
  if (!logo) return null;
  const color = getComputedStyle(logo).color;
  const mark = logo.querySelector<HTMLElement>("[data-intro-mark]");
  if (mark) {
    const r = mark.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, color };
  }
  const lockup = logo.querySelector<HTMLElement>("[data-intro-lockup]");
  if (!lockup) return null;
  const r = lockup.getBoundingClientRect();
  const height = r.height * 0.69;
  const width = height * 1.0252;
  return { left: r.right - width, top: r.top, width, height, color };
}
