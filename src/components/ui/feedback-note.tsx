"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE = [0.2, 0, 0, 1] as const;

/** A bare tick that traces itself (inherits size and colour). Use it wherever a
 *  check confirms something just happened: copied, saved, valid, approved. */
export function DrawTick({ className, play = true, delay = 0.05 }: { className?: string; play?: boolean; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5", className)} aria-hidden="true">
      <motion.path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={play && !reduce ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.42, ease: EASE, delay }}
      />
    </svg>
  );
}

/**
 * A check mark that draws itself inside a filled circle: the circle scales
 * in, then the tick traces from left to right. Static with reduced motion.
 */
export function AnimatedCheck({ className, delay = 0 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.32, ease: EASE, delay }}
      className={cn("feedback-check relative grid size-5 shrink-0 place-items-center rounded-full bg-eligible text-eligible-foreground", className)}
    >
      {!reduce && <span className="feedback-check-ring" style={{ animationDelay: `${delay + 0.28}s` }} />}
      <svg viewBox="0 0 16 16" className="size-3">
        <motion.path
          d="M3.5 8.5l3 3 6-7"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, ease: EASE, delay: delay + 0.18 }}
        />
      </svg>
    </motion.span>
  );
}

/**
 * Inline feedback after an action (saved, approved, failed). One look across
 * the app: a soft tint of the meaning colour, a clear icon and short text.
 * Tokens keep it readable in both light and dark themes. Mount it with a
 * `key` that changes per event so the entrance and tick replay.
 */
export function FeedbackNote({
  tone = "success",
  title,
  children,
  action,
  className,
}: {
  tone?: "success" | "error" | "info";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role={tone === "error" ? "alert" : "status"}
      initial={reduce ? false : { opacity: 0, y: 6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.18 } }}
      transition={{ duration: 0.34, ease: EASE }}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6",
        tone === "success" && "feedback-success border-eligible/25 bg-eligible-muted/60 dark:bg-eligible-muted",
        tone === "error" && "border-destructive/25 bg-destructive/[0.07]",
        tone === "info" && "border-border bg-muted/50",
        className,
      )}
    >
      <span className="mt-0.5">
        {tone === "success" ? (
          <AnimatedCheck />
        ) : tone === "error" ? (
          <span className="grid size-5 place-items-center rounded-full bg-destructive text-destructive-foreground" aria-hidden="true">
            <TriangleAlert className="size-3" strokeWidth={2.4} />
          </span>
        ) : (
          <span className="grid size-5 place-items-center rounded-full bg-foreground/10 text-foreground" aria-hidden="true">
            <Info className="size-3" strokeWidth={2.4} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1 text-foreground">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title ? "mt-0.5 text-muted-foreground" : "")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.div>
  );
}
