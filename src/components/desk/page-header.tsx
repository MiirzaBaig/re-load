"use client";

import { useEffect, useId, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CircleHelp } from "lucide-react";
import { QUICK, TWEEN } from "@/components/desk/primitives";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

/*
 * The heading at the top of every workspace page. One component, so the icon,
 * the title size, the spacing and where the buttons sit are the same wherever
 * you are.
 *
 * The sentence under the title carries one highlighted phrase (<Key>): the
 * part a new merchant should take away if they read nothing else. "New here?"
 * opens a short plain-language note on what the page is for.
 */

/** The phrase in the page sentence that should catch the eye. */
export function Key({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}

export function PageHeader({ icon: Icon, eyebrow, title, children, help, helpId, meta, actions, className }: {
  /** The page's sidebar icon, so the heading and the menu match. */
  icon: ComponentType<{ className?: string }>;
  /** A small line above the title (the greeting on Overview). */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** The sentence under the title. Wrap the important phrase in <Key>. */
  children?: ReactNode;
  /** Two or three plain sentences on what this page is for. */
  help?: ReactNode;
  /** Remembers per page whether the note is open. */
  helpId?: string;
  /** Status on the right: a chip or count. */
  meta?: ReactNode;
  /** Buttons on the right. */
  actions?: ReactNode;
  className?: string;
}) {
  const { t } = useLanguage();
  const panel = useId();
  const key = helpId ? `reload-help-${helpId}` : null;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!key) return;
    try { if (window.localStorage.getItem(key) === "open") setOpen(true); } catch { /* private mode */ }
  }, [key]);
  const toggle = () => setOpen((value) => {
    if (key) { try { window.localStorage.setItem(key, value ? "closed" : "open"); } catch { /* ignore */ } }
    return !value;
  });

  return (
    <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={TWEEN} className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="flex min-w-0 items-start gap-3.5">
        <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...QUICK, delay: 0.08 }}
          className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground shadow-[0_1px_2px_rgba(15,15,18,.05)] sm:size-11 sm:rounded-2xl" aria-hidden="true">
          <Icon className="size-[18px] sm:size-5" />
        </motion.span>
        <div className="min-w-0">
          {eyebrow && <p className="mb-0.5 text-sm text-muted-foreground">{eyebrow}</p>}
          <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[30px]">{title}</h1>
          {(children || help) && (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              {children}
              {help && (
                <button type="button" onClick={toggle} aria-expanded={open} aria-controls={panel}
                  className="ms-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full align-baseline text-xs font-medium text-muted-foreground underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline">
                  <CircleHelp className="size-3.5" />{t("New here?", "جديد هنا؟")}
                  <ChevronDown className={cn("size-3 transition-transform duration-300", open && "rotate-180")} />
                </button>
              )}
            </p>
          )}
          <AnimatePresence initial={false}>
            {help && open && (
              <motion.div key="help" id={panel} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ...TWEEN, duration: 0.3 }} className="overflow-hidden">
                <div className="mt-3 max-w-2xl rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-6 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">{help}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {(meta || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {meta}
          {actions}
        </div>
      )}
    </motion.header>
  );
}

/** A small status chip for the right side of a page heading. */
export function HeaderChip({ tone = "muted", pulse = false, children }: { tone?: "muted" | "ok" | "attention"; pulse?: boolean; children: ReactNode }) {
  const dot = tone === "ok" ? "bg-eligible" : tone === "attention" ? "bg-review" : "bg-muted-foreground/60";
  return (
    <span className={cn("inline-flex h-9 w-fit items-center gap-2 rounded-full border px-3 text-xs font-medium",
      tone === "ok" ? "border-eligible/30 bg-eligible-muted/60 text-eligible" : tone === "attention" ? "border-review/30 bg-review-muted/60 text-foreground" : "border-border bg-card text-muted-foreground")}>
      <span className="relative grid size-2 place-items-center">
        {pulse && <span className={cn("absolute size-2 animate-ping rounded-full opacity-60 motion-reduce:hidden", dot)} />}
        <span className={cn("size-2 rounded-full", dot)} />
      </span>
      {children}
    </span>
  );
}
