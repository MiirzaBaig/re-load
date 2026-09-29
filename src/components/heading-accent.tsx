"use client";

import { useRef, type ReactNode } from "react";
import { useInView } from "framer-motion";

/*
 * Heading emphasis, used sparingly across the home page:
 *
 * - <Tone> sets the second half of a heading in a quieter grey, so the first
 *   half carries the statement and the rest completes it (the hero's pattern).
 * - <Mark> sweeps a soft highlighter behind one key word, once, the first time
 *   the heading scrolls into view. Keep it to two or three headings on a page.
 *
 * Neither underlines (reads as a link) nor slants (Arabic has no true italic).
 */

export function Tone({ children }: { children: ReactNode }) {
  return <span className="heading-tone">{children}</span>;
}

export function Mark({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 1, margin: "0px 0px -12% 0px" });
  return (
    <span ref={ref} className="heading-mark" data-on={inView || undefined}>
      {children}
    </span>
  );
}
