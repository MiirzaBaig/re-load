"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Clock, Lock } from "lucide-react";
import { QUICK, TWEEN } from "@/components/desk/primitives";
import { ProgressRing } from "@/components/desk/progress-ring";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Everything a new merchant has to do, in order, on one card. Each step says
 * what it is for in one line and where it stands; opening it shows why it
 * matters and one button. Finished steps tick green and fold. The same card
 * shrinks to a single "finish setup" bar once the store is live.
 */

export type SetupStep = {
  id: string;
  done: boolean;
  title: string;
  /** One line under the title: what this is for, or what's in place once done. */
  status: string;
  /** Shown when the step is open. */
  body: string;
  cta: string;
  href: string;
  external?: boolean;
  minutes: number;
  /** Why it can't be started yet, if it depends on an earlier step. */
  locked?: string;
};

export function SetupChecklist({ steps, compact = false }: { steps: SetupStep[]; compact?: boolean }) {
  const { t } = useLanguage();
  const doneCount = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done && !step.locked) ?? steps.find((step) => !step.done);
  const [openId, setOpenId] = useState<string | null>(next?.id ?? null);
  const [expanded, setExpanded] = useState(!compact);
  const minutesLeft = steps.filter((step) => !step.done).reduce((sum, step) => sum + step.minutes, 0);

  // When a step gets done elsewhere, move on to the next one.
  useEffect(() => { setOpenId(next?.id ?? null); }, [next?.id]);

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.06 }}
      aria-label={t("Your setup", "إعدادك")} className="admin-card overflow-hidden rounded-3xl border border-border bg-card">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5 sm:px-7 sm:py-6">
        <ProgressRing done={doneCount} total={steps.length} label={t(`${doneCount} of ${steps.length} done`, `${doneCount} من ${steps.length} مكتملة`)} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
            {compact ? t("Finish your setup", "أكمل إعدادك") : t("Your setup, step by step", "إعدادك خطوة بخطوة")}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {t(`${doneCount} of ${steps.length} done`, `${doneCount} من ${steps.length} مكتملة`)}
            {minutesLeft > 0 && <><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{t(`about ${minutesLeft} min left`, `باقي ${minutesLeft} دقيقة تقريبًا`)}</span></>}
          </p>
        </div>
        {compact && next && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {!expanded && (
              <Button asChild size="sm" className="group h-9 rounded-xl transition-transform active:scale-[.98]">
                <Link href={next.href} target={next.external ? "_blank" : undefined}>{next.cta}<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" /></Link>
              </Button>
            )}
            <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}
              className="inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {expanded ? t("Hide steps", "إخفاء الخطوات") : t("Show all steps", "عرض كل الخطوات")}
              <ChevronDown className={cn("size-3.5 transition-transform duration-300", expanded && "rotate-180")} />
            </button>
          </div>
        )}
      </div>

      {/* ── Steps ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div key="steps" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ...TWEEN, duration: 0.34 }} className="overflow-hidden">
            <ol className="border-t border-border">
              {steps.map((step, index) => {
                const open = openId === step.id;
                const isNext = next?.id === step.id;
                const last = index === steps.length - 1;
                return (
                  <motion.li key={step.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...QUICK, delay: 0.1 + index * 0.05 }}
                    className={cn("relative", !last && "border-b border-border", open && "bg-muted/25")}>
                    <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : step.id)}
                      className="flex w-full items-center gap-3.5 px-5 py-4 text-start transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4 sm:px-7">
                      <Marker done={step.done} locked={Boolean(step.locked) && !step.done} active={isNext} n={index + 1} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[15px] font-semibold tracking-tight transition-colors duration-300", step.done && "text-foreground/75")}>{step.title}</span>
                        <span className={cn("mt-0.5 block text-xs leading-5", step.done ? "text-eligible" : "text-muted-foreground")}>{step.status}</span>
                      </span>
                      {!step.done && (
                        <span className={cn("hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex", isNext ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                          {isNext ? t("Next", "التالي") : t(`${step.minutes} min`, `${step.minutes} د`)}
                        </span>
                      )}
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ...TWEEN, duration: 0.3 }} className="overflow-hidden">
                          <div className="px-5 pb-5 ps-[4.25rem] sm:px-7 sm:ps-[5.25rem]">
                            <p className="max-w-xl text-sm leading-6 text-muted-foreground">{step.body}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                              {step.locked && !step.done ? (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground"><Lock className="size-3.5" />{step.locked}</span>
                              ) : (
                                <Button asChild variant={step.done || !isNext ? "outline" : "default"} className="group h-10 rounded-xl transition-transform active:scale-[.98]">
                                  <Link href={step.href} target={step.external ? "_blank" : undefined}>
                                    {step.cta}<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                                  </Link>
                                </Button>
                              )}
                              {!step.done && !step.locked && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" />{t(`About ${step.minutes} min`, `${step.minutes} دقيقة تقريبًا`)}</span>}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function Marker({ done, locked, active, n }: { done: boolean; locked: boolean; active: boolean; n: number }) {
  return (
    <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold transition-colors duration-300",
      done ? "border-eligible bg-eligible text-eligible-foreground" : active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground")}>
      <AnimatePresence initial={false} mode="wait">
        {done
          ? <motion.span key="done" initial={{ scale: 0.3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={QUICK}><Check className="size-4" strokeWidth={3} /></motion.span>
          : locked
            ? <motion.span key="lock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={QUICK}><Lock className="size-3.5" /></motion.span>
            : <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={QUICK} className="tabular-nums">{n}</motion.span>}
      </AnimatePresence>
    </span>
  );
}
