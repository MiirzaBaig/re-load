"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { WELCOME_DONE_EVENT } from "@/components/admin/welcome-script";

/*
 * Desk motion follows Brand System 3.0: one easing (--ease-brand), short
 * durations, no bounce, no glow. Things resolve once, then stay still.
 */
export const EASE = [0.2, 0, 0, 1] as const;
export const TWEEN = { type: "tween", ease: EASE, duration: 0.28 } as const;
export const QUICK = { type: "tween", ease: EASE, duration: 0.2 } as const;

/** Status colours are separate from the brand accent's job (focus, selection),
 *  except "new", which is the desk's call to action. */
export const STATUS_COLOR: Record<string, string> = {
  new: "var(--brand-accent)",
  contacted: "var(--chart-3)",
  interested: "var(--review)",
  demo_booked: "var(--chart-4)",
  customer: "var(--eligible)",
  not_interested: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
};

export function StatusDot({ status, className }: { status: string; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full transition-colors duration-200", className)} style={{ background: STATUS_COLOR[status] ?? "var(--muted-foreground)" }} />;
}

export function StatusPill({ status, label, className }: { status: string; label: string; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium transition-colors duration-200", className)}>
    <StatusDot status={status} className="size-1.5" />{label}
  </span>;
}

/** A number that counts up once when it first appears, then eases between
 *  later values. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return; }
    let frame = 0;
    const run = () => {
      const start = performance.now();
      const origin = from.current;
      const duration = origin === 0 ? 700 : 320;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(Math.round(origin + (value - origin) * eased));
        if (p < 1) frame = requestAnimationFrame(tick);
        else from.current = value;
      };
      frame = requestAnimationFrame(tick);
    };
    // Behind the desk's welcome curtain, wait and count up as it lifts.
    if (document.documentElement.dataset.adminWelcome === "play") {
      window.addEventListener(WELCOME_DONE_EVENT, run, { once: true });
      return () => { window.removeEventListener(WELCOME_DONE_EVENT, run); cancelAnimationFrame(frame); };
    }
    run();
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);
  return <span className={cn("tabular-nums", className)}>{shown}</span>;
}

/** A tiny trend line. Draws itself once. */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const id = useId().replace(/:/g, "");
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const w = 120;
  const h = 36;
  const points = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - (v / max) * (h - 8)] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-9 w-full overflow-visible", className)} aria-hidden="true">
    <defs><linearGradient id={`spark-${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".14" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
    <path d={`${line}L${w} ${h}L0 ${h}Z`} fill={`url(#spark-${id})`} className="admin-spark-area" />
    <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1} className="admin-spark-line" />
  </svg>;
}

export function Metric({ label, value, suffix, note, delta, series, icon: Icon, onClick, tone }: {
  label: string;
  value: number;
  /** Shown after the number, e.g. "%". */
  suffix?: string;
  note: string;
  delta?: string;
  series?: number[];
  icon?: LucideIcon;
  onClick?: () => void;
  tone?: "accent" | "review";
}) {
  const body = <>
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {Icon && <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors duration-200 group-hover:text-foreground"><Icon className="size-3.5" /></span>}
    </div>
    <div className="mt-4 flex items-end justify-between gap-4">
      <div>
        <span className="block font-display text-[34px] font-semibold leading-none tracking-[-.05em]"><CountUp value={value} />{suffix && <span className="ms-0.5 text-[22px] text-muted-foreground">{suffix}</span>}</span>
        <span className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {delta && <span className={cn("rounded-md px-1.5 py-0.5 font-medium", tone === "review" ? "bg-review-muted text-review" : "bg-brand-accent-soft text-brand-accent")}>{delta}</span>}
          {note}
        </span>
      </div>
      {series && series.some(Boolean) && <Sparkline data={series} className={cn("max-w-[96px]", tone === "review" ? "text-review" : "text-brand-accent")} />}
    </div>
  </>;
  const cls = "admin-card group block w-full rounded-2xl border border-border bg-card p-5 text-start";
  return onClick
    ? <button type="button" onClick={onClick} className={cn(cls, "admin-lift")}>{body}</button>
    : <div className={cls}>{body}</div>;
}

export function Panel({ title, subtitle, action, children, className, bodyClassName }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return <section className={cn("admin-card rounded-2xl border border-border bg-card", className)}>
    <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
      <div className="min-w-0"><h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>{subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}</div>
      {action}
    </header>
    <div className={cn("px-5 pb-5 pt-4 sm:px-6", bodyClassName)}>{children}</div>
  </section>;
}

export function EmptyState({ icon: Icon = Check, title, text, className }: { icon?: LucideIcon; title: string; text?: string; className?: string }) {
  return <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
    <span className="grid size-10 place-items-center rounded-full border border-border bg-muted/50 text-muted-foreground"><Icon className="size-4" /></span>
    <p className="mt-3 text-sm font-medium">{title}</p>
    {text && <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{text}</p>}
  </div>;
}

/** Four setup milestones as one segmented bar. */
export function MilestoneBar({ steps, className }: { steps: boolean[]; className?: string }) {
  return <span className={cn("flex gap-1", className)} aria-hidden="true">
    {steps.map((done, i) => <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="admin-grow block h-full rounded-full bg-foreground" style={{ width: done ? "100%" : "0%", animationDelay: `${i * 80}ms` }} /></span>)}
  </span>;
}

/** Segmented control with a sliding selection. */
export function Segmented<T extends string>({ value, options, onChange, label, className }: {
  value: T;
  options: { value: T; label: ReactNode; icon?: LucideIcon }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const group = useId();
  return <div role="radiogroup" aria-label={label} className={cn("relative inline-flex rounded-xl border border-border bg-muted/50 p-0.5", className)}>
    {options.map(({ value: option, label: text, icon: Icon }) => {
      const active = option === value;
      return <button key={option} type="button" role="radio" aria-checked={active} onClick={() => onChange(option)} className={cn("relative z-0 inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-xs font-medium transition-colors duration-200", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
        {active && <motion.span layoutId={`seg-${group}`} transition={TWEEN} className="absolute inset-0 -z-10 rounded-[10px] border border-border bg-background shadow-[0_1px_2px_rgba(15,15,18,.06)]" />}
        {Icon && <Icon className="size-3.5" />}{text}
      </button>;
    })}
  </div>;
}

export function FilterChip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-[background-color,border-color,color] duration-200 active:scale-[.98]", active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")}>
    {children}{count !== undefined && <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground/80")}>{count}</span>}
  </button>;
}

export function SaveIndicator({ state }: { state?: "saving" | "saved" }) {
  const { t } = useLanguage();
  return <span aria-live="polite" className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-opacity duration-200", state ? "opacity-100" : "opacity-0")}>
    {state === "saving" ? <><Loader2 className="size-3 animate-spin" />{t("Saving", "جارٍ الحفظ")}</> : state === "saved" ? <><Check className="size-3 text-eligible" />{t("Saved", "تم الحفظ")}</> : null}
  </span>;
}

export function Initial({ name, className }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-muted/60 text-[13px] font-semibold uppercase", className)}>{name.trim().slice(0, 1) || "·"}</span>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{children}</h3>;
}

/** Horizontal bar used across Returns and Today. */
export function BarRow({ label, value, total, color, onClick }: { label: string; value: number; total: number; color?: string; onClick?: () => void }) {
  const pct = total ? (value / total) * 100 : 0;
  const inner = <>
    <span className="mb-1.5 flex justify-between gap-2 text-xs"><span className="truncate">{label}</span><strong className="tabular-nums font-semibold">{value}</strong></span>
    <span className="block h-1.5 overflow-hidden rounded-full bg-muted"><span className="admin-grow block h-full rounded-full" style={{ width: `${pct}%`, background: color ?? "var(--foreground)" }} /></span>
  </>;
  return onClick
    ? <button type="button" onClick={onClick} className="block w-full rounded-lg text-start transition-opacity duration-200 hover:opacity-80">{inner}</button>
    : <div>{inner}</div>;
}
