"use client";
import { useState } from "react";
import { Segmented } from "@/components/desk/primitives";
import Link from "next/link";
import { Check } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Button } from "@/components/ui/button";
export function PublicPricing() {
  const [interval, setIntervalChoice] = useState<"monthly" | "annual">(
    "monthly",
  );
  const { t } = useLanguage();
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
            onChange={setIntervalChoice}
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
            { name: "Standard", price: 149, messages: 500, premium: false },
            { name: "Premium", price: 299, messages: 2000, premium: true },
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
                <p className="mt-6 text-4xl font-semibold tracking-tight">
                  {interval === "annual"
                    ? plan.premium
                      ? "2,870.40"
                      : "1,430.40"
                    : plan.price}
                  <span className="ms-2 text-sm font-normal text-muted-foreground">
                    {interval === "annual"
                      ? t("SAR / year", "ريال / سنة")
                      : t("SAR / month", "ريال / شهر")}
                  </span>
                </p>
                {interval === "annual" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t(
                      "Paid upfront. Messages refresh monthly.",
                      "دفع مقدم. الرصيد يتجدد شهريًا.",
                    )}
                  </p>
                )}
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
