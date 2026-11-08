import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Inner-page header with a dithered Riyadh print behind the title (theme-v2).
 * It wraps the page's existing breadcrumb, H1 and intro, so the markup and
 * search content stay the same. Without theme-v2 the print is hidden and the
 * header looks exactly as before. Prints come from scripts/dither-print.py;
 * photos are from Unsplash (Unsplash License).
 */
export type PrintName = "kingdom" | "faisaliah" | "square-green" | "twisted";

export function PrintHeader({ print, children, className }: { print: PrintName; children: ReactNode; className?: string }) {
  return (
    <header className={cn("print-header", print.endsWith("-green") && "print-header-brand", className)}>
      <div className="print-header-art" aria-hidden="true">
        <img src={`/brand/prints/${print}.png`} alt="" decoding="async" />
      </div>
      <div className="print-header-body">{children}</div>
    </header>
  );
}
