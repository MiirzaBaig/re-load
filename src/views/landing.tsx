"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { HeroTagline } from "@/components/hero-tagline";
import { Button } from "@/components/ui/button";
import {
  AnimatedDecisionTrace,
  type TraceStep,
} from "@/components/decision-trace";
import { OutcomeBadge } from "@/components/outcome-badge";
import { ScrollReveal } from "@/components/scroll-reveal";
import { OutcomeSequence } from "@/components/outcome-sequence";
import { ReturnsCostCalculator } from "@/components/returns-cost-calculator";
import { PolicyTransformation } from "@/components/policy-transformation";
import { SpeedComparison } from "@/components/speed-comparison";
import {
  PhoneFrame,
  WhatsAppThread,
  WhatsAppChannel,
  WhatsAppLogo,
  WHATSAPP_STATUS,
  type ThreadMessage,
} from "@/components/phone-frame";
import {
  ORDER_ELIGIBLE,
  ORDER_EXPIRED,
  ORDER_MISSING_DELIVERY,
  PUBLISHED_POLICY_V1,
} from "@/lib/fixtures";
import { evaluateEligibility } from "@/lib/engine";
import { OUTCOME_LABELS, DEMO_CLOCK, daysBetween } from "@/lib/domain";
import {
  FileText,
  Check,
  Package,
  ArrowRight,
  ShieldCheck,
  Lock,
  FileCheck2,
  MessageCircleMore,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import { getWhatsAppStartUrl } from "@/lib/whatsapp";

const HERO_STEPS: TraceStep[] = [
  {
    id: "clause",
    label: "Policy clause",
    value: "Items may be returned within 14 days of delivery",
    icon: FileText,
  },
  {
    id: "rule",
    label: "Approved rule",
    value: "Return window: 14 days from delivery date",
    icon: Check,
  },
  {
    id: "fact",
    label: "Order fact",
    value: "Delivered 6 days ago",
    icon: Package,
  },
];

const EXAMPLES = [ORDER_ELIGIBLE, ORDER_MISSING_DELIVERY, ORDER_EXPIRED].map(
  (facts) => {
    const decision = evaluateEligibility({
      policyVersion: PUBLISHED_POLICY_V1,
      facts,
      itemId: facts.items[0].id,
      quantity: 1,
      reason: "defective",
      condition: "new_unopened",
    });
    const elapsed = facts.deliveryDate
      ? daysBetween(new Date(facts.deliveryDate), DEMO_CLOCK.now)
      : null;
    const rule =
      elapsed === null
        ? "Delivery date unavailable · merchant review needed"
        : `Delivered ${elapsed} days ago · 14-day return window`;
    const messages: ThreadMessage[] = [
      {
        id: "customer",
        direction: "outgoing",
        text: `Can I return my ${facts.items[0].name.toLowerCase()}? My order is ${facts.orderId}.`,
      },
      {
        id: "decision",
        direction: "incoming",
        text: decision.explanation,
        decision,
        rule,
      },
    ];
    return { facts, decision, messages };
  },
);

const heroCopyItem = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1] as const } },
};

// Reduced motion: same end state, no travel and no duration.
const heroCopyItemStatic = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};


export function LandingPage() {
  const router = useRouter();
  const { t, isArabic } = useLanguage();
  const reduceMotion = useReducedMotion();
  const heroItem = reduceMotion ? heroCopyItemStatic : heroCopyItem;
  const [heroIntroDone, setHeroIntroDone] = useState(!!reduceMotion);
  const onHeroIntroComplete = useCallback(() => setHeroIntroDone(true), []);
  const heroLine1 = t("Faster return decisions.", "قرارات إرجاع أسرع.");
  const heroLine2 = t("A clearer path to financing.", "وطريق أوضح للتمويل.");
  const heroBody = t(
    "AI helps structure your return policy. Merchant-approved rules give customers a clear answer in seconds and create reliable data for future financing assessment.",
    "يساعد الذكاء الاصطناعي في تنظيم سياسة الإرجاع. وتمنح القواعد التي يعتمدها التاجر العملاء إجابة واضحة خلال ثوانٍ، وتبني بيانات موثوقة لتقييم فرص التمويل مستقبلًا.",
  );
  const heroSteps = HERO_STEPS.map((step, index) => ({ ...step, label: [t("Policy clause", "نص السياسة"), t("Approved rule", "قاعدة معتمدة"), t("Order fact", "بيانات الطلب")][index], value: [t("Items may be returned within 14 days of delivery", "يمكن إرجاع المنتجات خلال 14 يومًا من التسليم"), t("Return window: 14 days from delivery date", "مدة الإرجاع: 14 يومًا من تاريخ التسليم"), t("Delivered 6 days ago", "تم التسليم قبل 6 أيام")][index] }));
  // "Required for the live pilot" was an internal note, not a customer claim.
  const productPrinciples = [t("Human-approved rules", "قواعد يعتمدها التاجر"), t("Frozen evidence", "أدلة محفوظة"), t("Deterministic engine", "محرك قواعد حتمي"), t("Store-isolated data", "بيانات معزولة لكل متجر"), t("Traced to your policy", "مرتبطة بسياستك"), t("Answers in seconds", "إجابات خلال ثوانٍ")];
  const examples = EXAMPLES.map((example) => isArabic ? ({ ...example, messages: [{ ...example.messages[0], text: `هل يمكنني إرجاع هذا المنتج؟ رقم طلبي ${example.facts.orderId}.` }, { ...example.messages[1], text: example.decision.outcome === "ELIGIBLE" ? "هذا المنتج مؤهل للإرجاع. تم استيفاء جميع شروط السياسة." : example.decision.outcome === "MANUAL_REVIEW" ? "لا يتوفر تاريخ التسليم، لذلك يحتاج المتجر إلى مراجعة الطلب." : "هذا المنتج خارج مدة الإرجاع المحددة في السياسة.", rule: example.decision.outcome === "MANUAL_REVIEW" ? "تاريخ التسليم غير متوفر · يلزم مراجعة التاجر" : "مدة الإرجاع 14 يومًا من تاريخ التسليم" }] }) : example);
  const startWhatsAppSetup = () => {
    window.open(getWhatsAppStartUrl(), "_blank", "noopener,noreferrer");
  };
  const setupSteps = [
    { label: t("Connect your store", "اربط متجرك"), icon: "salla" as const },
    { label: t("Approve your policy", "اعتمد سياستك"), icon: FileCheck2 },
    { label: t("Activate WhatsApp", "فعّل واتساب"), icon: "whatsapp" as const },
    { label: t("Run your first test", "نفّذ أول اختبار"), icon: MessageCircleMore },
  ];

  return (
    <div className="overflow-x-clip bg-background">
      {/* Hero — an inset card floating on the page, nav included by the
          layout. Centred copy, no imagery: the card itself is the object. */}
      <section id="whatsapp" className="hero-shell scroll-mt-24">
        <div className="hero-card">
          <div className="hero-aurora" aria-hidden="true" />
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { delayChildren: reduceMotion ? 0 : 0.08, staggerChildren: reduceMotion ? 0 : 0.11 } } }}
            className="hero-card-content"
          >
            <motion.span variants={heroItem} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur">
              <span className="size-1.5 rounded-full bg-primary" />
              {t("AI-powered returns for Saudi ecommerce", "مرتجعات مدعومة بالذكاء الاصطناعي للتجارة الإلكترونية السعودية")}
            </motion.span>

            <HeroTagline
              line1={heroLine1}
              line2={heroLine2}
              body={heroBody}
              isArabic={isArabic}
              onComplete={onHeroIntroComplete}
            />

            <motion.div
              variants={heroItem}
              initial="hidden"
              animate={heroIntroDone ? "visible" : "hidden"}
              className="flex flex-wrap items-center justify-center gap-3"
            >
              <Button size="lg" onClick={startWhatsAppSetup} className="group">
                <WhatsAppLogo className="size-4" />
                {t("Start on WhatsApp", "ابدأ عبر واتساب")}
                <ArrowRight className={cn("size-4 transition-transform group-hover:translate-x-1", isArabic && "rotate-180")} />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push("/return")}
                className="border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.1] hover:text-white"
              >
                {t("Try the return flow", "جرّب رحلة الإرجاع")}
              </Button>
            </motion.div>

            <motion.div
              variants={heroItem}
              initial="hidden"
              animate={heroIntroDone ? "visible" : "hidden"}
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/55"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" />
                {t("Human-approved rules", "قواعد يعتمدها التاجر")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-4 text-primary" />
                {t("Evidence with every answer", "أدلة مع كل إجابة")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <WhatsAppChannel showStatus={false} />
              </span>
            </motion.div>

            <motion.div
              variants={heroItem}
              initial="hidden"
              animate={heroIntroDone ? "visible" : "hidden"}
              className="grid w-full max-w-3xl grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-2.5 text-start backdrop-blur-sm sm:grid-cols-4"
              aria-label={t("Merchant setup flow", "خطوات إعداد التاجر")}
            >
              {setupSteps.map((step, index) => {
                const Icon = typeof step.icon === "string" ? null : step.icon;
                return (
                  <div key={step.label} className="group flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-white/[0.07]">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.08] ring-1 ring-white/10 transition-transform duration-200 group-hover:-translate-y-0.5">
                      {step.icon === "salla" ? (
                        <Image src="/salla-logo.png" alt="" width={22} height={22} className="rounded-md" />
                      ) : step.icon === "whatsapp" ? (
                        <WhatsAppLogo className="size-5" />
                      ) : Icon ? (
                        <Icon className="size-4 text-primary" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">{String(index + 1).padStart(2, "0")}</span>
                      <span className="block text-xs font-medium leading-4 text-white/80">{step.label}</span>
                    </span>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Sits on the shell background so it reads as part of the page the hero
          card floats on, not as a strip running under the card's edge. */}
      <section
        aria-label="Product principles"
        className="principles-strip py-7"
      >
        <div className="principles-marquee">
          <div className="principles-track">
            {[false, true].map((duplicate) => (
              <div
                key={String(duplicate)}
                className="flex shrink-0 items-center gap-12 pr-12"
                aria-hidden={duplicate || undefined}
              >
                {productPrinciples.map((claim) => (
                  <div
                    key={claim}
                    className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium text-foreground"
                  >
                    <ShieldCheck className="size-4 shrink-0 text-primary" />
                    <span>{claim}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <SpeedComparison />

      {/* Problem */}
      <section id="product" className="scroll-mt-20">
        <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
          <ScrollReveal>
            <div className="max-w-2xl">
              <span className="text-sm font-semibold text-primary">
                {t("Why Relod", "لماذا ريلود")}
              </span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-[40px] md:leading-[1.1] text-balance">
                {t("Returns tie up cash. Relod shortens the gap.", "المرتجعات تجمّد نقدك. ريلود يقصّر الفجوة.")}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
                {t("Every day a return sits undecided is working capital locked in stock you cannot sell. Relod applies your approved rules consistently, helping cases move sooner and making return data clearer for future financing assessment.", "كل يوم يبقى فيه طلب الإرجاع دون قرار هو رأس مال عامل محتجز في بضاعة لا يمكن بيعها. يطبّق ريلود قواعدك المعتمدة باستمرار، مما يساعد على تسريع معالجة الحالات وتوضيح بيانات المرتجعات لتقييم فرص التمويل مستقبلًا.")}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {[
                {
                  label: t("Policy automation", "أتمتة السياسة"),
                  desc: t("AI reads your policy and turns it into repeatable return decisions.", "يقرأ الذكاء الاصطناعي سياستك ويحوّلها إلى قرارات إرجاع قابلة للتكرار."),
                },
                {
                  label: t("Financing readiness", "الاستعداد للتمويل"),
                  desc: t("Build documented return data that can support a future financing assessment.", "أنشئ بيانات مرتجعات موثّقة يمكن أن تدعم تقييم التمويل مستقبلًا."),
                },
                {
                  label: t("Evidence and control", "الأدلة والتحكم"),
                  desc: t("Every decision stays connected to the clause that produced it.", "يبقى كل قرار مرتبطًا بالبند الذي أنتجه."),
                },
              ].map((item) => (
                <div key={item.label}>
                  <h3 className="text-sm font-semibold text-foreground">
                    {item.label}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <ReturnsCostCalculator />

      <PolicyTransformation />

      <OutcomeSequence>
        {examples.map(({ facts, decision, messages }) => (
          <article
            key={facts.orderId}
            aria-label={`${OUTCOME_LABELS[decision.outcome]} example`}
            className="outcome-card-body"
          >
            <PhoneFrame scale="compact">
              <WhatsAppThread messages={messages} />
            </PhoneFrame>
            <div className="outcome-card-label">
              <OutcomeBadge outcome={decision.outcome} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {facts.customerName} · {facts.orderId}
              </p>
            </div>
          </article>
        ))}
      </OutcomeSequence>

      {/* Merchant experience */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
          <ScrollReveal>
            <div className="grid items-center gap-12 md:grid-cols-2">
              <div className="order-2 md:order-1">
                <div className="relative rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("Return cases", "طلبات الإرجاع")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("3 total", "3 إجمالًا")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        order: "SA-10492",
                        name: "Sara Ahmed",
                        item: "White Everyday Sneakers",
                        outcome: "ELIGIBLE" as const,
                      },
                      {
                        order: "SA-10567",
                        name: "Noura Salem",
                        item: "Olive Cotton Hoodie",
                        outcome: "MANUAL_REVIEW" as const,
                      },
                      {
                        order: "SA-10331",
                        name: "Khalid Othman",
                        item: "White Everyday Sneakers",
                        outcome: "NOT_ELIGIBLE" as const,
                      },
                    ].map((c, index) => (
                      <CaseEntrance
                        key={c.order}
                        index={index}
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {c.order} · {c.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.item}
                          </div>
                        </div>
                        <OutcomeBadge outcome={c.outcome} size="sm" />
                      </CaseEntrance>
                    ))}
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-border bg-card p-6">
                  <div className="mb-5 flex justify-between text-xs text-muted-foreground">
                    <span>{t("Example decision evidence", "مثال على أدلة القرار")}</span>
                    <span>{t("Policy v1.0", "السياسة v1.0")}</span>
                  </div>
                  <AnimatedDecisionTrace
                    steps={heroSteps}
                    outcome="ELIGIBLE"
                  />
                </div>
              </div>
              <div className="order-1 md:order-2">
                <span className="text-sm font-semibold text-primary">
                  {t("Merchant experience", "تجربة التاجر")}
                </span>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-[40px] md:leading-[1.1] text-balance">
                  {t("A real queue, with evidence behind every row.", "قائمة عمل واضحة، وأدلة وراء كل حالة.")}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
                  {t("Cases that need attention surface first. Open any case to see the exact rules, order facts, and policy version that produced the decision.", "تظهر الحالات التي تحتاج إلى تدخل أولًا. افتح أي حالة للاطلاع على القواعد وبيانات الطلب وإصدار السياسة الذي نتج عنه القرار.")}
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  {[
                    t("Color-coded by outcome — eligible, review, or not eligible", "ألوان واضحة للنتائج: مؤهل، مراجعة، أو غير مؤهل"),
                    t("Click any case to see the full decision trace", "افتح أي حالة لمراجعة مسار القرار كاملًا"),
                    t("Add notes and update operational status", "أضف ملاحظات وحدّث حالة المعالجة"),
                  ].map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="size-4 text-primary" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Path split — For merchants / For customers */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold text-primary">
                {t("Two sides of every return", "جانبان لكل طلب إرجاع")}
              </span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-[40px] md:leading-[1.1] text-balance">
                {t("One platform. Two clear paths.", "منصة واحدة، ومساران واضحان.")}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
                {t("Merchants get a decision workspace with evidence behind every case. Customers get a clear answer in seconds.", "يحصل التاجر على مساحة عمل مدعومة بالأدلة، ويحصل العميل على إجابة واضحة خلال ثوانٍ.")}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {/* Merchant path */}
              <button
                onClick={() => router.push("/app")}
                className="group flex flex-col gap-4 p-6 text-left transition-all duration-200 hover:-translate-y-0.5 md:p-8"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                    <ShieldCheck className="size-5" />
                  </div>
                    <ArrowRight className={cn("size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1", isArabic && "rotate-180")} />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-primary">
                    {t("For merchants", "للتجار")}
                  </div>
                  <h3 className="mt-1 font-display text-xl font-semibold text-foreground">
                    {t("A decision workspace with evidence", "مساحة قرارات مدعومة بالأدلة")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t("Approve policy rules, review cases that need attention, and trace every decision back to the exact rule and order facts that produced it.", "اعتمد قواعد السياسة، وراجع الحالات التي تحتاج إلى تدخل، وتتبع كل قرار إلى القاعدة وبيانات الطلب التي أنتجته.")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    t("Policy approval", "اعتماد السياسة"),
                    t("Case queue", "قائمة الحالات"),
                    t("Decision trace", "مسار القرار"),
                    t("Frozen evidence", "أدلة محفوظة"),
                  ].map((tag, i) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {i > 0 && (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                      {tag}
                    </span>
                  ))}
                </div>
              </button>

              {/* Customer path */}
              <button
                onClick={() => router.push("/return")}
                className="group flex flex-col gap-4 p-6 text-left transition-all duration-200 hover:-translate-y-0.5 md:p-8"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                    <Package className="size-5" />
                  </div>
                    <ArrowRight className={cn("size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1", isArabic && "rotate-180")} />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-primary">
                    {t("For customers", "للعملاء")}
                  </div>
                  <h3 className="mt-1 font-display text-xl font-semibold text-foreground">
                    {t("A clear answer in seconds", "إجابة واضحة خلال ثوانٍ")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t("Verify your order, choose the item and reason, and get an explained eligibility decision instantly. No waiting, no guessing.", "تحقق من الطلب، واختر المنتج وسبب الإرجاع، واحصل فورًا على قرار واضح ومفسّر.")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    t("3-step flow", "3 خطوات"),
                    t("Instant answer", "إجابة فورية"),
                    t("Rule explanation", "شرح القاعدة"),
                    t("Request submission", "إرسال الطلب"),
                  ].map((tag, i) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {i > 0 && (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Confidence */}
      <section className="bg-muted/30 px-5 py-20 md:py-28">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl border border-border bg-card px-6 py-12 text-foreground shadow-sm sm:px-10 md:px-14 md:py-16">
          <ScrollReveal>
            <div className="max-w-2xl">
              <span className="text-sm font-semibold text-primary">
                {t("Confidence", "الثقة")}
              </span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-[40px] md:leading-[1.1] text-balance">
                {t("Every decision is frozen with its evidence.", "يُحفظ كل قرار مع أدلته.")}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
                {t("When a policy is published, the version and the relevant order facts are frozen with each evaluation. Editing a policy creates a new draft — old decisions keep their original evidence.", "عند نشر السياسة، يُحفظ إصدارها وبيانات الطلب ذات الصلة مع كل تقييم. يؤدي تعديل السياسة إلى إنشاء مسودة جديدة، بينما تحتفظ القرارات السابقة بأدلتها الأصلية.")}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: t("Frozen policy version", "إصدار سياسة محفوظ"),
                  desc: t("Each decision records which version of the policy was applied.", "يسجل كل قرار إصدار السياسة الذي تم تطبيقه."),
                },
                {
                  title: t("Relevant order facts", "بيانات الطلب ذات الصلة"),
                  desc: t("Delivery date, item, quantity, reason, and condition are preserved.", "يُحفظ تاريخ التسليم والمنتج والكمية والسبب والحالة."),
                },
                {
                  title: t("Evaluation time", "وقت التقييم"),
                  desc: t("Every decision is timestamped and reproducible.", "لكل قرار وقت محدد ويمكن إعادة إنتاجه."),
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
          <ScrollReveal>
            <div className="flex flex-col items-center gap-6 text-center">
              <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-[40px] md:leading-[1.1] text-balance">
                {t("See a policy become an answer.", "شاهد السياسة تتحول إلى إجابة.")}
              </h2>
              <p className="max-w-md text-lg leading-relaxed text-muted-foreground text-pretty">
                {t("Connect your store and approve its return policy in the workspace. Customers can then receive clear decisions through WhatsApp.", "اربط متجرك واعتمد سياسة الإرجاع من مساحة العمل، ثم يحصل العملاء على قرارات واضحة عبر واتساب.")}
              </p>
              <a
                href="#whatsapp"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <WhatsAppChannel />
                <span>
                  {WHATSAPP_STATUS === "coming-soon"
                    ? t("Preview the channel", "معاينة القناة")
                    : t("See the conversation", "عرض المحادثة")}
                </span>
                <ArrowRight className="size-4" />
              </a>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  size="lg"
                  onClick={startWhatsAppSetup}
                  className="group"
                >
                  <WhatsAppLogo className="size-4" />
                  {t("Start on WhatsApp", "ابدأ عبر واتساب")}
                  <ArrowRight className={cn("size-4 transition-transform group-hover:translate-x-1", isArabic && "rotate-180")} />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push("/return")}
                >
                  {t("Try the return flow", "جرّب رحلة الإرجاع")}
                </Button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

function CaseEntrance({ index, children }: { index: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="overflow-hidden rounded-lg">
      <motion.div
        data-case-entrance={index}
        initial={reduceMotion ? false : { opacity: 0.25, x: 24 + index * 6 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-between gap-3 rounded-lg p-3 hover:bg-muted/40"
      >
        {children}
      </motion.div>
    </div>
  );
}
