"use client";

import { useSsrReducedMotion as useReducedMotion } from "@/hooks/use-ssr-reduced-motion";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { SAMPLE_POLICY_RULES } from "@/lib/fixtures";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { StoreMark } from "@/components/store-identity";

const DEMO_RULES = SAMPLE_POLICY_RULES.slice(0, 3);

const SOURCE_SECTIONS = [
  {
    title: "1. Return Window",
    excerpt: DEMO_RULES[0].sourceExcerpt,
    remainder:
      "The return window starts from the confirmed delivery date shown in the order tracking system.",
  },
  {
    title: "2. Eligible Reasons",
    excerpt: DEMO_RULES[1].sourceExcerpt,
    remainder: "Returns for “changed mind” are not accepted.",
  },
  {
    title: "3. Item Condition",
    excerpt: DEMO_RULES[2].sourceExcerpt,
    remainder: "Used items are not eligible for return.",
  },
];

export function PolicyTransformation() {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);
  // Which rules the visitor has approved. Approving all three publishes.
  const [approved, setApproved] = useState<boolean[]>([false, false, false]);
  const reduceMotion = useReducedMotion();
  const approvedCount = approved.filter(Boolean).length;
  const published = approvedCount === DEMO_RULES.length;
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const [canPin, setCanPin] = useState(false);
  // Set while the visitor is driving directly, so scroll does not yank the
  // panel out from under them. It releases on a timer — latching it forever
  // meant one click or tab killed the scroll sequence for the whole visit,
  // which is the entire point of the section.
  const userDriven = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdForUser = useCallback(() => {
    userDriven.current = true;
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => {
      userDriven.current = false;
    }, 2600);
  }, []);

  useEffect(
    () => () => {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
    },
    [],
  );

  useEffect(() => {
    const pin = pinRef.current;
    if (!pin) return;
    const measure = () => setCanPin(!reduceMotion && window.innerWidth >= 1024 && pin.offsetHeight <= window.innerHeight - 88);
    const observer = new ResizeObserver(measure);
    observer.observe(pin);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [reduceMotion]);

  /**
   * Scroll advances the active rule so the clause-to-rule link tells itself.
   * Most visitors never hover, so without this the section's whole point is
   * invisible. Desktop only — on mobile the layout is a plain stack and there
   * is no source column to highlight against.
   */
  useEffect(() => {
    const element = trackRef.current;
    if (!element || !canPin) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      if (userDriven.current) return;
      const pin = pinRef.current;
      if (!pin) return;
      const rect = element.getBoundingClientRect();
      // The scrub runs only while the panel is pinned: from the moment the
      // section's top passes the heading, until its bottom reaches the
      // viewport. Measuring the whole section would start it too early.
      const span = rect.height - pin.offsetHeight;
      if (span <= 0) return;
      const travelled = 72 - rect.top;
      const progress = Math.min(1, Math.max(0, travelled / span));
      const step = Math.floor(progress * DEMO_RULES.length);
      const next = Math.min(DEMO_RULES.length - 1, Math.max(0, step));
      setActive((current) => (current === next ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [canPin]);

  const approve = (index: number) => {
    holdForUser();
    if (approved[index]) return;
    const next = [...approved];
    next[index] = true;
    setApproved(next);
    // Advance to the next still-unapproved rule so the flow keeps moving.
    const pending = next.findIndex((ok) => !ok);
    if (pending !== -1) setActive(pending);
  };

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="policy-scroll-section scroll-mt-20 bg-muted/30"
    >
      {/* Heading scrolls away normally — keeping it inside the pin pushed the
          workspace off the bottom of the viewport. */}
      <div className="mx-auto w-full max-w-[1200px] px-5 pb-0 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold text-primary">
            {t("From policy to financing-ready decisions", "من السياسة إلى قرارات جاهزة للتمويل")}
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground md:text-[42px] md:leading-[1.08]">
            {t("Policy becomes a clear path to financing.", "تتحول السياسة إلى طريق واضح للتمويل.")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("Your store policy becomes an AI-assisted return decision, and every approved decision becomes a financing-ready case. You review each rule before it goes live.", "تتحول سياسة متجرك إلى قرار إرجاع مدعوم بالذكاء الاصطناعي، ويصبح كل قرار معتمد حالة جاهزة للتمويل. وتراجع كل قاعدة قبل نشرها.")}
          </p>
        </div>
      </div>

      <div ref={trackRef} className="policy-scroll-track" data-pinned={canPin || undefined}>
      <div ref={pinRef} className="policy-scroll-pin">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-10">
        <div className="policy-workspace overflow-hidden rounded-[28px] border border-border/75 bg-card shadow-[0_30px_90px_-55px_rgba(8,42,34,.55)]">
          {/* Workspace bar: progress lives here, not in a separate panel. */}
          <div className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <StoreMark size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {t("Nova Store return policy", "سياسة الإرجاع لمتجر نوفا")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {published
                    ? t("Published as Policy v1.0", "نُشرت باسم السياسة v1.0")
                    : t(`${approvedCount} of ${DEMO_RULES.length} rules approved`, `تم اعتماد ${approvedCount} من ${DEMO_RULES.length} قواعد`)}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "policy-status shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold",
                published
                  ? "border-eligible/25 bg-eligible-muted text-eligible"
                  : "border-review/25 bg-review-muted text-review",
              )}
            >
              {published ? t("Published", "منشورة") : t("Unpublished draft", "مسودة غير منشورة")}
            </span>
          </div>

          <div className="grid lg:grid-cols-[1fr_1fr]">
            {/* Source document — the active clause lights up. */}
            <div className="hidden border-b border-border/70 bg-background/50 p-5 sm:p-7 lg:block lg:border-b-0 lg:border-r">
              {/* No inner sticky: the whole panel is pinned by
                  .policy-scroll-pin, and nesting a second sticky context makes
                  this column drift against it. */}
              <div>
                <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("Source policy", "نص السياسة")}
                </p>
                <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                  <div className="mb-6 flex items-center gap-2 border-b border-border/60 pb-4">
                    <span className="size-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("Returns and Refunds Policy", "سياسة الإرجاع والاسترداد")}
                    </span>
                  </div>
                  <div className="space-y-6">
                    {SOURCE_SECTIONS.map((section, index) => (
                      <div
                        key={section.title}
                        className="policy-source-block"
                        data-active={active === index}
                      >
                        <p className="mb-2 text-xs font-semibold text-foreground">
                          {t(section.title, ["1. مدة الإرجاع", "2. أسباب الإرجاع المقبولة", "3. حالة المنتج"][index])}
                        </p>
                        <p className="text-sm leading-7 text-muted-foreground">
                          <mark
                            className="policy-source-highlight"
                            data-active={active === index}
                          >
                            {t(section.excerpt, ["يمكن للعملاء إرجاع المنتجات المؤهلة خلال 14 يومًا من تاريخ التسليم.", "تُقبل المرتجعات في حالات المنتج المعيب أو استلام منتج خاطئ أو عدم مطابقته للوصف أو تضرره أثناء الشحن.", "يجب أن يكون المنتج جديدًا وغير مفتوح، أو مفتوحًا دون استخدام مع كامل التغليف والملحقات الأصلية."][index])}
                          </mark>{" "}
                          {t(section.remainder, ["تبدأ مدة الإرجاع من تاريخ التسليم المؤكد في نظام تتبع الطلب.", "لا يُقبل الإرجاع بسبب تغيير الرأي.", "المنتجات المستخدمة غير مؤهلة للإرجاع."][index])}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Proposed rules — compact rows, each approvable. */}
            <div className="p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("Proposed rules", "القواعد المقترحة")}
                </span>
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <Sparkles className="size-3.5" />
                  {t("AI-assisted", "بمساعدة الذكاء الاصطناعي")}
                </span>
              </div>

              <ul className="space-y-3">
                {DEMO_RULES.map((rule, index) => {
                  const isApproved = approved[index];
                  const isActive = active === index;
                  return (
                    <li key={rule.id}>
                      <div
                        data-policy-rule={index + 1}
                        data-active={isActive}
                        data-approved={isApproved}
                        onMouseEnter={() => { if (!canPin) setActive(index); }}
                        onFocusCapture={() => { holdForUser(); setActive(index); }}
                        className="policy-rule-card rounded-2xl border border-border/70 bg-background p-4 sm:p-5"
                      >
                        <div className="flex items-start gap-3">
                          <span className="policy-rule-index mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold">
                            {isApproved ? (
                              <Check className="size-3.5" strokeWidth={3} />
                            ) : (
                              String(index + 1).padStart(2, "0")
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-snug text-foreground">
                              {t(rule.name, ["مدة الإرجاع", "أسباب الإرجاع المقبولة", "حالات المنتج المقبولة"][index])}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              {t(rule.description, ["يجب إرجاع المنتجات خلال 14 يومًا من التسليم", "منتج معيب، منتج خاطئ، غير مطابق للوصف، أو متضرر أثناء الشحن", "جديد وغير مفتوح، أو مفتوح دون استخدام"][index])}
                            </p>

                            {/* Source shown inline on small screens, where the
                                document column is hidden. */}
                            <p className="mt-3 border-l-2 border-primary/25 pl-3 text-xs leading-relaxed text-muted-foreground lg:hidden">
                              {t(SOURCE_SECTIONS[index].excerpt, ["يمكن للعملاء إرجاع المنتجات المؤهلة خلال 14 يومًا من تاريخ التسليم.", "تُقبل المرتجعات للأسباب المحددة في السياسة.", "يجب أن يكون المنتج جديدًا وغير مفتوح أو مفتوحًا دون استخدام."][index])}
                            </p>

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="text-xs text-muted-foreground">
                                {t(`Clause ${index + 1}`, `البند ${index + 1}`)}
                              </span>
                              <button
                                type="button"
                                onClick={() => approve(index)}
                                disabled={isApproved}
                                className="policy-approve-btn rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                              >
                                {isApproved ? t("Approved", "معتمدة") : t("Approve", "اعتماد")}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-5 text-center text-xs text-muted-foreground">
                {published
                  ? t("Published rules — not the AI — decide every return.", "القواعد المنشورة، وليس الذكاء الاصطناعي، هي التي تقرر نتيجة كل طلب.")
                  : t("Nothing goes live until you approve it.", "لن تُنشر أي قاعدة قبل اعتمادك لها.")}
              </p>
            </div>
          </div>

          {/* Publication bar appears only once every rule is approved. */}
          <motion.div
            initial={false}
            animate={{
              height: published ? "auto" : 0,
              opacity: published ? 1 : 0,
            }}
            transition={{
              duration: reduceMotion ? 0 : 0.42,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-eligible/20 bg-eligible-muted/60 px-5 py-4 text-center">
              <span className="flex size-6 items-center justify-center rounded-full bg-eligible text-eligible-foreground">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {t("Policy v1.0 published.", "تم نشر السياسة v1.0.")}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("Ready to answer customer requests.", "جاهزة لتقييم طلبات العملاء.")}
              </span>
            </div>
          </motion.div>
        </div>
        </div>
      </div>
      </div>
    </section>
  );
}
