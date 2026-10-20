"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Minus } from "lucide-react";
import { useSsrReducedMotion } from "@/hooks/use-ssr-reduced-motion";
import { BILLING_PLANS } from "../../supabase/functions/_shared/billing-contract";
import { Segmented } from "@/components/desk/primitives";
import { publicEvent } from "@/components/public-analytics";
import { useLanguage } from "@/components/language-provider";
import { ScrollReveal } from "@/components/scroll-reveal";
import { cn } from "@/lib/utils";
import { RiyalSign } from "@/components/riyal-sign";

const EASE = [0.2, 0, 0, 1] as const;
const fmt = (n: number, decimals = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * Starts at the real value (so the server HTML shows the true price for
 * search engines) and only tweens when the value changes, e.g. monthly to
 * yearly. Each frame keeps the final number's decimals.
 */
function RollingNumber({ value, decimals }: { value: number; decimals: number }) {
  const reduce = useSsrReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 520);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(origin + (value - origin) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, reduce]);
  return <span>{fmt(shown, decimals)}</span>;
}

export function PublicPricing() {
  const [interval, setIntervalChoice] = useState<"monthly" | "annual">("monthly");
  const { t, locale } = useLanguage();
  const reduce = useSsrReducedMotion();
  const yearly = interval === "annual";
  const plans = [
    { key: "standard" as const, ...BILLING_PLANS.standard },
    { key: "premium" as const, ...BILLING_PLANS.premium },
  ];

  /* Previous rows (Codex, 2026-10-20), kept for review:
    // One source for the cards and the comparison table. [standard, premium]
    const rows: Array<{ label: string; values: [boolean | string, boolean | string] }> = [
      {
        label: t("Delivered messages / month", "الرسائل المسلّمة شهريًا"),
        values: [fmt(BILLING_PLANS.standard.messages), fmt(BILLING_PLANS.premium.messages)],
      },
      { label: t("Return requests on WhatsApp", "طلبات الإرجاع عبر واتساب"), values: [true, true] },
      { label: t("Checks against your approved policy", "التحقق وفق سياستك المعتمدة"), values: [true, true] },
      { label: t("Order verification", "التحقق من الطلب"), values: [true, true] },
      { label: t("Merchant dashboard and case tracking", "لوحة التحكم ومتابعة الحالات"), values: [true, true] },
      { label: t("Arabic and English", "العربية والإنجليزية"), values: [true, true] },
      { label: t("AI customer support", "خدمة العملاء بالذكاء الاصطناعي"), values: [true, true] },
      { label: t("Product questions and links", "أسئلة المنتجات وروابطها"), values: [true, true] },
      { label: t("Verified order tracking", "تتبع الطلبات بعد التحقق"), values: [true, true] },
      { label: t("Support tickets", "تذاكر الدعم"), values: [true, true] },
      { label: t("Stores", "عدد المتاجر"), values: ["1", "1"] },
    ];
  */
  // One source for the cards and the comparison table (v201 list). [standard, premium]
  // "soon" marks upcoming Premium actions; it is not evidence of provider readiness.
  const rows: Array<{ label: string; values: [boolean | string, boolean | string]; soon?: boolean }> = [
    { label: t("Customer support", "خدمة العملاء"), values: [true, true] },
    { label: t("Returns management", "إدارة المرتجعات"), values: [true, true] },
    { label: t("Every conversation in your dashboard", "كل المحادثات في لوحة التاجر"), values: [true, true] },
    { label: t("Reply yourself in any conversation", "ترد بنفسك على أي محادثة"), values: [true, true] },
    { label: t("One store", "متجر واحد"), values: [true, true] },
    { label: t("Product suggestions with links", "اقتراح المنتجات وإرسال روابطها"), values: [true, true] },
    { label: t("Return shipping labels", "بوليصات شحن الإرجاع"), values: [false, true], soon: true },
    { label: t("Cart and payment link in chat", "إنشاء السلة وإرسال رابط الدفع"), values: [false, true], soon: true },
  ];

  return (
    <section id="pricing" className="scroll-mt-24 border-y bg-background">
      <div className="mx-auto max-w-5xl px-5 py-20 md:py-28">
        {/* Header */}
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("Pricing", "الأسعار")}</p>
            <h2 className="mt-3 font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-balance md:text-5xl">
              {t("Simple pricing for every store.", "أسعار واضحة لكل متجر.")}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-muted-foreground text-pretty">
              {t(
                "Set up for free. Pay when you’re ready to turn on WhatsApp for your customers. Prices include VAT.",
                "جهّز متجرك مجانًا، وادفع عندما تكون جاهزًا لتفعيل واتساب لعملائك. الأسعار شاملة الضريبة.",
              )}
            </p>
          </div>
        </ScrollReveal>

        {/* Billing switch */}
        <ScrollReveal delay={60}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Segmented
              label={t("Billing frequency", "مدة الاشتراك")}
              value={interval}
              onChange={(value) => {
                setIntervalChoice(value);
                publicEvent("reload_pricing_interval_selected", { billing_interval: value, language: locale });
              }}
              options={[
                { value: "monthly", label: t("Monthly", "شهري") },
                { value: "annual", label: t("Yearly", "سنوي") },
              ]}
            />
            <span className="text-sm font-medium text-eligible">{t("Save 20% yearly", "وفّر 20٪ سنويًا")}</span>
          </div>
        </ScrollReveal>

        {/* Plans */}
        <div className="mt-10 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 md:gap-5">
          {plans.map((plan, i) => {
            const premium = plan.key === "premium";
            const monthly = plan.price / 100;
            const perMonth = yearly ? plan.annualPrice / 100 / 12 : monthly;
            // Previous: only included rows, with Premium showing "Everything in Standard, plus".
            // const features = rows.filter((r) => r.values[i] === true && (!premium || r.values[0] === false || r.label === t("AI customer support", "خدمة العملاء بالذكاء الاصطناعي"))).map((r) => r.label);
            return (
              <ScrollReveal key={plan.key} delay={100 + i * 80} className="h-full">
                <article className={cn("price-card relative flex h-full min-w-0 flex-col rounded-2xl border bg-card p-6 sm:p-8", premium && "price-card-pick")}>
                  {premium && (
                    <span className="absolute -top-3 start-6 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background sm:start-8">
                      {t("Recommended", "الموصى به")}
                    </span>
                  )}
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {/* Previous: "More messages. Premium checkout and shipping planned." / "Customer support, product questions and returns." */}
                    {premium
                      ? t("For stores with busy chats that ship their returns.", "للمتاجر اللي محادثاتها كثيرة وتشحن مرتجعاتها.")
                      : t("For stores starting to organize support and returns.", "للمتاجر اللي تبدأ تنظّم خدمة العملاء والمرتجعات.")}
                  </p>

                  <div className="mt-6" aria-live="polite" aria-atomic="true">
                    <div className="flex items-baseline gap-1.5">
                      {/* Riyal sign sits to the left of the amount in both languages. */}
                      <span className="inline-flex items-baseline gap-2" dir="ltr">
                        <RiyalSign className="h-[0.78em] self-center text-[40px] text-foreground" label={t("SAR", "ريال")} />
                        <span className="font-display text-5xl font-semibold tracking-[-0.04em] [font-variant-numeric:proportional-nums]">
                          <RollingNumber value={perMonth} decimals={yearly ? 2 : 0} />
                        </span>
                      </span>
                      <span className="ms-1 text-sm text-muted-foreground">{t("/month", "/ شهريًا")}</span>
                    </div>
                    <div className="mt-2 h-5 text-sm text-muted-foreground">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                          key={interval}
                          initial={reduce ? false : { opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduce ? undefined : { opacity: 0, y: -3 }}
                          transition={{ duration: 0.2, ease: EASE }}
                        >
                          {yearly ? (
                            <>
                              <span className="inline-flex items-center gap-1 align-middle" dir="ltr">
                                <RiyalSign label={t("SAR", "ريال")} />
                                {fmt(plan.annualPrice / 100, 2)}
                              </span>{" "}
                              {t("billed yearly", "تُدفع سنويًا")}
                            </>
                          ) : (
                            t("Billed monthly", "يُدفع شهريًا")
                          )}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  </div>

                  <Link
                    href="/auth"
                    onClick={() => publicEvent("reload_signup_click", { plan: plan.key, billing_interval: interval, language: locale })}
                    className={cn(
                      "group mt-6 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-[background-color,border-color,transform] duration-200 active:scale-[.98]",
                      premium ? "bg-foreground text-background hover:bg-foreground/85" : "border bg-background hover:bg-muted",
                    )}
                  >
                    {t(`Get ${plan.name}`, `اشترك في ${plan.name}`)}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                  </Link>

                  <div className="mt-7 border-t pt-6">
                    <p className="text-sm font-semibold">
                      {t(`${fmt(plan.messages)} messages a month`, `${fmt(plan.messages)} رسالة شهريًا`)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("Only delivered outgoing messages count", "تُحتسب الرسائل الصادرة المسلّمة فقط")}
                    </p>
                    <ul className="mt-5 space-y-2.5 text-sm">
                      {/* Previous list, kept for review:
                      {premium && (
                        <li className="pb-1 text-muted-foreground">{t("Everything in Standard, plus:", "كل ما في ستاندرد، بالإضافة إلى:")}</li>
                      )}
                      {premium && <li className="text-xs leading-6 text-muted-foreground">{t("Coming soon: customer-confirmed checkout links and merchant-approved OTO shipping. Courier charges are separate.", "قريبًا: روابط دفع بعد تأكيد العميل وشحن أوتو بموافقة التاجر. رسوم الشحن منفصلة.")}</li>}
                      {features.map((text) => (
                        <li key={text} className="flex items-start gap-2.5">
                          <Check className="mt-0.5 size-4 shrink-0 text-foreground" strokeWidth={2.25} />
                          {text}
                        </li>
                      ))}
                      */}
                      {rows.map((row, n) => {
                        const on = row.values[i] === true;
                        return (
                          <li key={row.label} className={cn("price-feature flex items-center gap-2.5", !on && "price-feature-off")} style={{ ["--n" as string]: n }}>
                            <span className={cn("price-tick", on ? "price-tick-on" : "price-tick-off")} aria-hidden="true">
                              {on ? <Check className="size-3" strokeWidth={3} /> : <Minus className="size-3" strokeWidth={2.5} />}
                            </span>
                            <span className={cn(!on && "text-muted-foreground")}>{row.label}</span>
                            {on && row.soon && <span className="rounded-full border px-1.5 py-px text-[10px] text-muted-foreground">{t("Soon", "قريبًا")}</span>}
                            <span className="sr-only">{on ? t("Included", "مشمول") : t("Not included in this plan", "غير مشمول في هذه الباقة")}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Free start */}
        <ScrollReveal delay={120}>
          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-dashed p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 md:mt-5">
            <div>
              <p className="text-base font-semibold">{t("Start free", "ابدأ مجانًا")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "Connect your store, write your policy and prepare answers. No card needed until you go live.",
                  "اربط متجرك، واكتب سياستك، وجهّز إجاباتك. لا تحتاج إلى بطاقة حتى التفعيل.",
                )}
              </p>
            </div>
            <Link
              href="/auth"
              onClick={() => publicEvent("reload_signup_click", { plan: "free_setup", language: locale })}
              className="group inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border bg-background px-5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t("Set up your store", "جهّز متجرك")}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </div>
        </ScrollReveal>

        {/* Compare */}
        <ScrollReveal delay={80}>
          <div className="mt-20">
            <h3 className="text-center font-display text-2xl font-semibold tracking-tight">
              {t("Compare plans", "قارن الاشتراكات")}
            </h3>
            <table className="mt-8 w-full table-fixed text-sm">
              <caption className="sr-only">{t("Plan features", "مزايا الاشتراكات")}</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="w-[46%] py-3 text-start font-medium text-muted-foreground sm:w-1/2">
                    {t("Features", "المزايا")}
                  </th>
                  {plans.map((plan) => (
                    <th key={plan.key} scope="col" className="py-3 text-center font-semibold">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[{ label: t("Delivered messages / month", "الرسائل المسلّمة شهريًا"), values: [fmt(BILLING_PLANS.standard.messages), fmt(BILLING_PLANS.premium.messages)] as [string, string], soon: false }, ...rows].map((row) => (
                  <tr key={row.label} className="border-b transition-colors hover:bg-muted/40">
                    <th scope="row" className="py-3.5 pe-3 text-start font-normal text-foreground/85">
                      {row.label}
                    </th>
                    {row.values.map((v, j) => (
                      <td key={j} className="py-3.5 text-center">
                        {v === true ? (
                          <Check className="mx-auto size-4 text-foreground" strokeWidth={2.25} aria-label={t("Included", "مشمول")} />
                        ) : v === false ? (
                          <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label={t("Not included", "غير مشمول")} />
                        ) : (
                          <span className="font-medium tabular-nums">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-5 text-center text-xs leading-6 text-muted-foreground">
              {t(
                "Messages refresh every month, also on yearly plans. Customer messages, marketing campaigns and shipping are not counted.",
                "يتجدد الرصيد كل شهر حتى في الاشتراك السنوي. لا تُحتسب رسائل العملاء ولا الحملات التسويقية ولا الشحن.",
              )}
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
