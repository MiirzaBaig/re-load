"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Plays the workspace entrance on every navigation.
 *
 * The previous version kept a `visible` flag in state. On navigation the new
 * page mounted while that flag was still `true` from the old page, so it
 * painted fully visible before an effect hid it and showed it again — every
 * page looked instant (or flickered). Keying the wrapper on the path and
 * driving the entrance with a CSS animation means it always starts from the
 * hidden frame, with no state to get out of sync. See `.page-enter` in
 * index.css, which also staggers the page's top-level sections.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
