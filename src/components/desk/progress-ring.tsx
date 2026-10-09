"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { TWEEN } from "@/components/desk/primitives";
import { cn } from "@/lib/utils";

/** Setup progress as a ring that fills once, count in the middle, a tick when done. */
export function ProgressRing({ done, total, label, className }: { done: number; total: number; label: string; className?: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative grid size-14 shrink-0 place-items-center", className)} role="img" aria-label={label}>
      <svg viewBox="0 0 52 52" className="absolute inset-0 size-full -rotate-90 rtl:-scale-x-100">
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <motion.circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-eligible"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - done / total) }}
          transition={{ ...TWEEN, duration: 0.9, delay: 0.2 }} style={{ opacity: done ? 1 : 0 }} />
      </svg>
      {done === total
        ? <Check className="size-5 text-eligible" strokeWidth={2.75} />
        : <span className="text-sm font-semibold tabular-nums">{done}<span className="text-muted-foreground">/{total}</span></span>}
    </div>
  );
}
