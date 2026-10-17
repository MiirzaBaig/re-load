"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useSsrReducedMotion } from "@/hooks/use-ssr-reduced-motion";
import { BILLING_PLANS } from "../../supabase/functions/_shared/billing-contract";
import { useState } from "react";
import { Segmented } from "@/components/desk/primitives";
import { publicEvent } from "@/components/public-analytics";
import Link from "next/link";
import { Check } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Button } from "@/components/ui/button";
export function PublicPricing() {
  const [interval, setIntervalChoice] = useState<"monthly" | "annual">(
    "monthly",
  );
  const { t, locale } = useLanguage();
  const reduce = useSsrReducedMotion();
  return (
    <section id="pricing" className="scroll-mt-24 border-y bg-muted/20">
      <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
        <ScrollReveal>
          <div className="mx-auto mb-9 max-w-xl text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {t("Simple plans", "اشتراكات واضحة")}
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {t("Start with what your store needs.", "ابدأ بما يحتاجه متجرك.")}
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              {t(
                "Prepare your store for free. Subscribe when you’re ready to activate your assistant. All prices include VAT.",
                "جهّز متجرك مجانًا، واشترك عندما تكون جاهزًا لتفعيل المساعد. جميع الأسعار شاملة الضريبة.",
              )}
            </p>
          </div>
        </ScrollReveal>
        <div className="mb-7 flex justify-center">
          <Segmented
            label={t("Billing frequency", "مدة الاشتراك")}
            value={interval}
            onChange={(value) => {
              setIntervalChoice(value);
              publicEvent("reload_pricing_interval_selected", {
                billing_interval: value,
                language: locale,
              });
            }}
            options={[
              { value: "monthly", label: t("Monthly", "شهري") },
              {
                value: "annual",
                label: t("Yearly · save 20%", "سنوي · وفر 20٪"),
              },
            ]}
          />
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
          {[
            {
              ...BILLING_PLANS.standard,
              price: BILLING_PLANS.standard.price / 100,
              premium: false,
            },
            {
              ...BILLING_PLANS.premium,
              price: BILLING_PLANS.premium.price / 100,
              premium: true,
            },
          ].map((plan, i) => (
            <ScrollReveal key={plan.name} delay={i * 70}>
              <div className="flex h-full min-w-0 flex-col rounded-2xl border bg-card p-6 sm:p-8">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.premium
                    ? t(
                        "Customer support and returns on WhatsApp.",
                        "خدمة العملاء والإرجاع على واتساب.",
                      )
                    : t(
                        "Return requests and policy checks on WhatsApp.",
                        "طلبات الإرجاع والتحقق من السياسة على واتساب.",
                      )}
                </p>
                <div
                  className="mt-6 min-h-28"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={interval}
                      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduce ? 0 : -4 }}
                      transition={{
                        duration: reduce ? 0 : 0.2,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-4xl font-semibold tracking-tight tabular-nums">
                        <span dir="ltr">
                          {interval === "annual"
                            ? (plan.annualPrice / 100).toLocaleString("en", {
                                minimumFractionDigits: 2,
                              })
                            : plan.price}
                        </span>
                        <span className="text-sm font-normal text-muted-foreground">
                          {interval === "annual"
                            ? t("SAR / year", "ريال / سنة")
                            : t("SAR / month", "ريال / شهر")}
                        </span>
                      </p>
                      <p className="mt-3 text-xs leading-6 text-muted-foreground">
                        {interval === "annual"
                          ? t(
                              "Paid upfront. Save 20%. Messages refresh monthly.",
                              "دفع مقدم. وفر 20٪. الرصيد يتجدد شهريًا.",
                            )
                          : t(
                              "Billed monthly. Messages refresh each billing month.",
                              "دفع شهري. يتجدد الرصيد كل شهر فوترة.",
                            )}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <ul className="my-6 space-y-3 text-sm">
                  {[
                    t(
                      `${plan.messages.toLocaleString()} outgoing messages each month`,
                      `${plan.messages.toLocaleString()} رسالة صادرة شهريًا`,
                    ),
                    t("One store · guided setup", "متجر واحد · إعداد موجّه"),
                    t(
                      "Verified return requests and merchant dashboard",
                      "طلبات إرجاع موثّقة ولوحة تحكم للمتجر",
                    ),
                    ...(plan.premium
                      ? [
                          t(
                            "Product questions, order tracking and support tickets",
                            "أسئلة المنتجات، متابعة الطلبات وتذاكر الدعم",
                          ),
                        ]
                      : []),
                  ].map((text) => (
                    <li className="flex items-start gap-2" key={text}>
                      <Check className="mt-0.5 size-4 shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.premium ? "default" : "outline"}
                  className="mt-auto w-full rounded-xl active:scale-[.98]"
                >
                  <Link href="/auth">
                    {t("Set up your store", "جهّز متجرك")}
                  </Link>
                </Button>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-6 text-muted-foreground">
          {t(
            "Allowances count delivered outgoing messages, not customers or conversations. Marketing and shipping fees are excluded. Purchased extra messages, when available, carry over.",
            "الرصيد يُحسب بالرسائل الصادرة المسلّمة، وليس بعدد العملاء أو المحادثات. التسويق والشحن غير مشمولين. الرسائل الإضافية المشتراة، عند إتاحتها، تنتقل للشهر التالي.",
          )}
        </p>
      </div>
    </section>
  );
}
