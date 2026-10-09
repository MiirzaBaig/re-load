"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { QUICK, TWEEN } from "@/components/desk/primitives";
import { cn } from "@/lib/utils";

/*
 * Guided setup as a vertical timeline: one step open at a time, finished
 * steps fold into a single line with a tick, the rail between steps fills as
 * they complete. Calm motion only (height + fade, brand easing).
 */

export type Step = {
  title: string;
  /** One line shown once the step is done. */
  summary?: string;
  content?: ReactNode;
};

export function ConnectStepper({ steps, current, busy = false, onBack, backLabel, accent = "var(--foreground)" }: {
  steps: Step[];
  /** Index of the open step; steps.length means all done. */
  current: number;
  /** Show a spinner on the open step (e.g. while connecting). */
  busy?: boolean;
  /** Re-open an earlier step. */
  onBack?: (index: number) => void;
  backLabel?: string;
  /** Colour of the open step's marker. */
  accent?: string;
}) {
  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const done = index < current;
        const open = index === current;
        const last = index === steps.length - 1;
        return (
          <li key={step.title} className="relative flex gap-4 pb-1">
            {/* Rail + marker */}
            <div className="relative flex w-8 shrink-0 flex-col items-center">
              <motion.span
                layout
                className={cn("relative z-[1] grid size-8 place-items-center rounded-full border-2 text-xs font-semibold transition-colors duration-300",
                  done ? "border-eligible bg-eligible text-white" : open ? "text-white" : "border-border bg-card text-muted-foreground")}
                style={open && !done ? { background: accent, borderColor: accent } : undefined}
                animate={open ? { scale: [0.9, 1] } : { scale: 1 }} transition={QUICK}>
                <AnimatePresence initial={false} mode="wait">
                  {done
                    ? <motion.span key="done" initial={{ scale: 0.3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={QUICK}><Check className="size-4" strokeWidth={3} /></motion.span>
                    : open && busy
                      ? <motion.span key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={QUICK}><Loader2 className="size-4 animate-spin" /></motion.span>
                      : <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={QUICK}>{index + 1}</motion.span>}
                </AnimatePresence>
              </motion.span>
              {!last && (
                <span className="relative mt-1 w-[2px] flex-1 overflow-hidden rounded-full bg-border">
                  <motion.span className="absolute inset-x-0 top-0 rounded-full bg-eligible" initial={false}
                    animate={{ height: done ? "100%" : "0%" }} transition={{ ...TWEEN, duration: 0.45 }} />
                </span>
              )}
            </div>

            {/* Body */}
            <div className={cn("min-w-0 flex-1", last ? "pb-1" : "pb-6")}>
              <div className="flex min-h-8 items-center justify-between gap-3">
                <p className={cn("text-[15px] font-semibold tracking-tight transition-colors duration-300",
                  open ? "text-foreground" : done ? "text-foreground/80" : "text-muted-foreground")}>{step.title}</p>
                {done && onBack && (
                  <button type="button" onClick={() => onBack(index)} className="shrink-0 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">{backLabel}</button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {done && step.summary && (
                  <motion.p key="summary" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={QUICK}
                    className="overflow-hidden text-xs text-muted-foreground">{step.summary}</motion.p>
                )}
                {open && step.content && (
                  <motion.div key="content" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ ...TWEEN, duration: 0.32 }} className="overflow-hidden">
                    <div className="pt-3">{step.content}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A line-by-line "working on it" list that ticks items off in order. */
export function ProgressChecklist({ items, done }: { items: string[]; done: number }) {
  return (
    <ul className="space-y-2.5 rounded-2xl border border-border bg-muted/30 p-4">
      {items.map((item, index) => {
        const finished = index < done;
        const active = index === done;
        return (
          <motion.li key={item} initial={{ opacity: 0, y: 4 }} animate={{ opacity: index <= done ? 1 : 0.45, y: 0 }} transition={{ ...QUICK, delay: index * 0.05 }}
            className="flex items-center gap-3 text-sm">
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-300",
              finished ? "bg-eligible text-white" : active ? "text-foreground" : "border border-border text-transparent")}>
              {finished ? <Check className="size-3" strokeWidth={3} /> : active ? <Loader2 className="size-4 animate-spin" /> : null}
            </span>
            <span className={cn(finished || active ? "text-foreground" : "text-muted-foreground")}>{item}</span>
          </motion.li>
        );
      })}
    </ul>
  );
}

/** A check mark that draws itself once, for the success moment. */
export function SuccessMark() {
  return (
    <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={TWEEN}
      className="grid size-14 place-items-center rounded-full bg-eligible-muted text-eligible">
      <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ ...TWEEN, duration: 0.55, delay: 0.15 }} />
      </svg>
    </motion.span>
  );
}
