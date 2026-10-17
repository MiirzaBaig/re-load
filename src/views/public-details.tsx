"use client";
import Link from "next/link";
import { ArrowUpRight, Check, MessageSquare } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { PublicPricing } from "@/components/public-pricing";
import { PublicFaq } from "@/components/public-faq";
import { SeoProse } from "@/components/seo-prose";
import { PUBLIC_STEPS } from "@/lib/public-content";
import { publicPath, type PublicPage } from "@/lib/public-site";
import { BILLING_PLANS } from "../../supabase/functions/_shared/billing-contract";
import { Button } from "@/components/ui/button";
export function PublicDetails({ page }: { page: Exclude<PublicPage, ""> }) {
  const { t, isArabic, locale } = useLanguage();
  const title =
    page === "pricing"
      ? t(
          "A plan for your store. A clear price.",
          "اشتراك يناسب متجرك. وسعر واضح.",
        )
      : page === "faq"
        ? t("Your questions, answered.", "أسئلتك، وإجاباتها.")
        : t(
            "Your store. Your rules. One conversation.",
            "متجرك. سياستك. ومحادثة واحدة.",
          );
  // Search words lead the H1; the slogan stays the big visual line.
  const keywordLine =
    page === "pricing"
      ? t(
          "Reload pricing: returns management and WhatsApp customer support plans",
          "أسعار ريلود: اشتراكات إدارة المرتجعات وخدمة العملاء عبر واتساب",
        )
      : page === "faq"
        ? t(
            "Questions about returns and customer support on WhatsApp",
            "أسئلة شائعة عن إدارة المرتجعات وخدمة العملاء عبر واتساب",
          )
        : t(
            "How Reload handles return requests and customer support on WhatsApp",
            "كيف يدير ريلود طلبات الإرجاع وخدمة العملاء عبر واتساب",
          );
  return (
    <>
      <div className="mx-auto max-w-5xl px-5 pb-2 pt-14 sm:pt-20">
        <nav
          aria-label={t("Breadcrumb", "مسار التنقل")}
          className="mb-7 text-xs text-muted-foreground"
        >
          <Link
            href={publicPath(locale)}
            className="underline underline-offset-4"
          >
            {t("Home", "الرئيسية")}
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span>
            {page === "pricing"
              ? t("Pricing", "الأسعار")
              : page === "faq"
                ? t("FAQ", "الأسئلة الشائعة")
                : t("How it works", "كيف يعمل")}
          </span>
        </nav>
        <h1 className="max-w-3xl">
          <span className="mb-3 block text-sm font-medium text-muted-foreground">
            {keywordLine}
          </span>
          <span className="block font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {title}
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
          {t(
            "Returns and customer support through WhatsApp, with the information and policies you approve. Prepare your store for free; activation depends on your subscription or approved pilot access.",
            "الإرجاع وخدمة العملاء عبر واتساب، بالمعلومات والسياسات التي تعتمدها. جهّز متجرك مجانًا؛ ويتطلب التفعيل اشتراكًا أو وصولًا تجريبيًا معتمدًا.",
          )}
        </p>
      </div>
      {page === "pricing" ? (
        <>
          <PublicPricing />
          <section className="mx-auto max-w-5xl px-5 py-12">
            <h2 className="text-2xl font-semibold">
              {t(
                "Monthly or yearly. The same monthly allowance.",
                "شهري أو سنوي. بنفس الرصيد الشهري.",
              )}
            </h2>
            <div className="mt-6 overflow-x-auto rounded-2xl border">
              <table className="w-full text-start text-sm">
                <caption className="px-5 py-3 text-start text-xs text-muted-foreground">
                  {t(
                    "All prices include 15% VAT. Annual payment is collected upfront.",
                    "الأسعار تشمل ضريبة القيمة المضافة 15٪. يُدفع الاشتراك السنوي مقدمًا.",
                  )}
                </caption>
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      t("Plan", "الاشتراك"),
                      t("Monthly", "شهري"),
                      t("Annual", "سنوي"),
                      t("Messages / month", "رسائل / شهر"),
                    ].map((h) => (
                      <th key={h} className="p-3 text-start font-medium sm:p-5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.values(BILLING_PLANS).map((plan) => (
                    <tr key={plan.name} className="border-t">
                      <th className="p-3 text-start font-medium sm:p-5">
                        {plan.name}
                      </th>
                      <td className="p-3 tabular-nums sm:p-5">
                        {plan.price / 100} {t("SAR", "ريال")}
                      </td>
                      <td className="p-3 tabular-nums sm:p-5">
                        {(plan.annualPrice / 100).toLocaleString("en", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {t("SAR", "ريال")}
                      </td>
                      <td className="p-3 tabular-nums sm:p-5">
                        {plan.messages.toLocaleString("en")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                [
                  t(
                    "Only delivered outgoing messages count",
                    "تُحتسب الرسائل الصادرة المسلّمة فقط",
                  ),
                  t(
                    "Pending sends reserve capacity until confirmed. Customer messages do not use your allowance.",
                    "يحجز الإرسال قيد التأكيد رصيدًا مؤقتًا. رسائل العملاء لا تستهلك رصيدك.",
                  ),
                ],
                [
                  t(
                    "Your included allowance refreshes monthly",
                    "يتجدد الرصيد المشمول شهريًا",
                  ),
                  t(
                    "Annual billing does not release the whole year's messages upfront. Unused included messages do not roll over.",
                    "الاشتراك السنوي لا يمنح رسائل السنة كلها مقدمًا. لا ينتقل المتبقي من الرصيد المشمول.",
                  ),
                ],
                [
                  t(
                    "Upgrade when your store needs more",
                    "رقِّ الاشتراك عندما يحتاج متجرك",
                  ),
                  t(
                    "Standard can upgrade to Premium for a proportional charge. Extra bundles for Premium are not available yet.",
                    "يمكن ترقية ستاندرد إلى بريميوم بتكلفة نسبية. باقات بريميوم الإضافية غير متاحة حاليًا.",
                  ),
                ],
                [
                  t(
                    "Cancellation preserves your paid time",
                    "الإلغاء يحفظ فترتك المدفوعة",
                  ),
                  t(
                    "Stop the next renewal without losing time already paid. Refund requests follow the applicable terms separately.",
                    "أوقف التجديد القادم مع حفظ الفترة التي دفعت مقابلها. تخضع طلبات الاسترداد للشروط بشكل منفصل.",
                  ),
                ],
              ].map(([heading, body]) => (
                <div key={heading} className="rounded-2xl border bg-card p-5">
                  <Check className="size-4 text-muted-foreground" />
                  <h3 className="mt-3 font-medium">{heading}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              {t(
                "Live payment activation is being prepared. Store setup is available now. Marketing, shipping charges and automatic refund payouts are not included.",
                "يجري تجهيز تفعيل الدفع الفعلي. إعداد المتجر متاح الآن. لا تشمل الاشتراكات التسويق أو رسوم الشحن أو تحويل مبالغ الاسترداد تلقائيًا.",
              )}
            </p>
          </section>
          <PublicFaq />
        </>
      ) : page === "faq" ? (
        <PublicFaq full />
      ) : (
        <section className="mx-auto max-w-5xl px-5 py-12">
          <ol className="space-y-4">
            {PUBLIC_STEPS.map((step, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-2xl border bg-card p-5 sm:p-7"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-sm tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-lg font-semibold">
                    {step.title[isArabic ? 1 : 0]}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {step.body[isArabic ? 1 : 0]}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 rounded-2xl bg-muted/40 p-6">
            <MessageSquare className="size-5" />
            <h2 className="mt-3 font-semibold">
              {t(
                "For example: a customer wants to return shoes",
                "مثال: عميل يريد إرجاع حذاء",
              )}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {t(
                "Ahmed opens his store’s link and sends the prepared WhatsApp message. Reload identifies the merchant, checks Ahmed’s order ownership and asks which item he wants to return. He explains the reason and may add a photo. Reload checks the published policy and records the result. Unclear cases go to the merchant for review; a return decision is not a refund payout.",
                "يفتح أحمد رابط متجره ويرسل الرسالة الجاهزة عبر واتساب. يتعرف ريلود على التاجر ويتحقق من ملكية أحمد للطلب، ثم يسأله عن المنتج المطلوب إرجاعه. يوضح السبب ويمكنه إضافة صورة. يراجع ريلود السياسة المنشورة ويسجل النتيجة. تُحال الحالات غير الواضحة للتاجر؛ وقرار الإرجاع لا يعني تحويل مبلغ الاسترداد.",
              )}
            </p>
          </div>
        </section>
      )}
      <SeoProse variant={page} />
      <section className="mx-auto mb-16 flex max-w-5xl flex-wrap items-center justify-between gap-5 px-5">
        <p className="max-w-xl text-sm leading-7 text-muted-foreground">
          {t(
            "Want to see how this fits your store? Start with setup, or speak with the Reload team.",
            "تريد معرفة ما يناسب متجرك؟ ابدأ بالإعداد أو تواصل مع فريق ريلود.",
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-xl active:scale-[.98]">
            <Link href="/auth">
              {t("Prepare your store", "جهّز متجرك")}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`${publicPath(locale)}#contact`}>
              {t("Contact us", "تواصل معنا")}
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
