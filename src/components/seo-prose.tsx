"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLanguage } from "@/components/language-provider";
import { publicPath } from "@/lib/public-site";
import { BILLING_PLANS } from "../../supabase/functions/_shared/billing-contract";

/*
 * A short, plain-language section per page: says what the page is about in
 * the words merchants search for, and links to the related pages. Track the
 * target keywords in SEO.md. Do not name platform integrations here (see the
 * Salla note in SEO.md).
 */

type Variant = "home" | "pricing" | "faq" | "how-it-works";

export function SeoProse({ variant }: { variant: Variant }) {
  const { t, locale } = useLanguage();
  const L = ({ href, children }: { href: string; children: ReactNode }) => (
    <Link href={href} className="text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground">
      {children}
    </Link>
  );
  const to = {
    home: publicPath(locale),
    pricing: publicPath(locale, "pricing"),
    faq: publicPath(locale, "faq"),
    how: publicPath(locale, "how-it-works"),
    guides: `/${locale}/guides`,
    policy: `/${locale}/guides/return-policy`,
    whatsapp: `/${locale}/guides/whatsapp-returns`,
    reduce: `/${locale}/guides/reduce-returns`,
    tool: `/${locale}/return-policy-template`,
  };
  const { standard, premium } = BILLING_PLANS;

  const content: Record<Variant, { h: string; p: ReactNode[] }> = {
    home: {
      h: t(
        "Reload in short: returns management and customer support on WhatsApp",
        "ريلود باختصار: إدارة المرتجعات وخدمة العملاء عبر واتساب",
      ),
      p: [
        t(
          "Reload helps Saudi online stores handle return and exchange requests and customer support on WhatsApp. The customer writes to your store; Reload verifies the order, applies the return policy you approved, answers product and order questions with the information you published, and records every case in one workspace. Unclear requests come to you, and refunds stay in your hands.",
          "يساعد ريلود المتاجر الإلكترونية في السعودية على إدارة طلبات الإرجاع والاستبدال وخدمة العملاء عبر واتساب. يكتب العميل لمتجرك، فيتحقق ريلود من الطلب، ويطبّق سياسة الاسترجاع التي اعتمدتها، ويجيب عن أسئلة المنتجات والطلبات بالمعلومات التي نشرتها، ويسجّل كل حالة في مساحة عمل واحدة. تصلك الطلبات غير الواضحة، ويبقى الاسترداد بيدك.",
        ),
        <>
          {t("Start with ", "ابدأ بـ")}
          <L href={to.how}>{t("how Reload works", "كيف يعمل ريلود")}</L>
          {t(", compare ", "، أو قارن ")}
          <L href={to.pricing}>{t("Standard and Premium pricing", "أسعار ستاندرد وبريميوم")}</L>
          {t(", or read the ", "، أو اقرأ ")}
          <L href={to.faq}>{t("frequently asked questions", "الأسئلة الشائعة")}</L>
          {t(". No return policy yet? Use the free ", ". لم تكتب سياسة الاسترجاع بعد؟ استخدم ")}
          <L href={to.tool}>{t("return and exchange policy template", "نموذج سياسة الاسترجاع والاستبدال المجاني")}</L>
          {t(" or browse our ", " أو تصفّح ")}
          <L href={to.guides}>{t("merchant guides", "أدلة التاجر")}</L>
          {t(" and ", " و")}
          <L href={`/${locale}/tools`}>{t("free tools", "الأدوات المجانية")}</L>.
        </>,
      ],
    },
    pricing: {
      h: t(
        "How much does returns management and WhatsApp support cost?",
        "كم تكلفة إدارة المرتجعات وخدمة العملاء عبر واتساب؟",
      ),
      p: [
        t(
          `Standard is SAR ${standard.price / 100} a month for returns and policy checks, with ${standard.messages.toLocaleString("en")} delivered messages. Premium is SAR ${premium.price / 100} a month and adds AI customer support in Arabic and English, with ${premium.messages.toLocaleString("en")} messages. Paying yearly saves 20%, prices include VAT, and you can prepare your store for free before choosing.`,
          `ستاندرد بسعر ${standard.price / 100} ريال شهريًا لطلبات الإرجاع والتحقق من السياسة، مع ${standard.messages.toLocaleString("en")} رسالة مسلّمة. وبريميوم بسعر ${premium.price / 100} ريال شهريًا ويضيف خدمة العملاء بالذكاء الاصطناعي بالعربية والإنجليزية، مع ${premium.messages.toLocaleString("en")} رسالة. الدفع السنوي يوفر 20٪، والأسعار شاملة الضريبة، ويمكنك تجهيز متجرك مجانًا قبل الاختيار.`,
        ),
        <>
          {t("See ", "اطّلع على ")}
          <L href={to.how}>{t("how a return request works step by step", "كيف يعمل طلب الإرجاع خطوة بخطوة")}</L>
          {t(", or read ", "، أو اقرأ ")}
          <L href={to.reduce}>{t("7 practical ways to reduce returns", "7 طرق عملية لتقليل المرتجعات")}</L>.
        </>,
      ],
    },
    faq: {
      h: t("Didn’t find your answer?", "لم تجد إجابتك؟"),
      p: [
        <>
          <L href={to.how}>{t("How Reload works", "كيف يعمل ريلود")}</L>
          {t(" walks through a full return on WhatsApp, and ", " يشرح طلب إرجاع كاملًا عبر واتساب، و")}
          <L href={to.pricing}>{t("pricing", "صفحة الأسعار")}</L>
          {t(" explains plans and message allowances. Our ", " توضّح الاشتراكات ورصيد الرسائل. وتغطي ")}
          <L href={to.guides}>{t("merchant guides", "أدلة التاجر")}</L>
          {t(" cover return policies and handling returns on WhatsApp. Or ", " سياسات الاسترجاع وإدارة الإرجاع عبر واتساب. أو ")}
          <L href={`${to.home}#contact`}>{t("contact the Reload team", "تواصل مع فريق ريلود")}</L>.
        </>,
      ],
    },
    "how-it-works": {
      h: t("Why handle returns on WhatsApp?", "لماذا تدير طلبات الإرجاع عبر واتساب؟"),
      p: [
        t(
          "Customers in Saudi Arabia already use WhatsApp every day, so a return request there feels natural and gets answered faster. The difficulty is consistency once orders grow: Reload gives every customer the same policy-based answer, day or night, and keeps every case in one place.",
          "يستخدم العملاء في السعودية واتساب يوميًا، فيبدو طلب الإرجاع عبره طبيعيًا وتصل الإجابة أسرع. التحدي هو الاتساق عندما تكبر الطلبات: يعطي ريلود كل عميل الإجابة نفسها وفق سياستك، ليلًا أو نهارًا، ويحفظ كل حالة في مكان واحد.",
        ),
        <>
          {t("Read ", "اقرأ ")}
          <L href={to.whatsapp}>{t("how to handle returns on WhatsApp without the chaos", "كيف تدير طلبات الإرجاع عبر واتساب بدون فوضى")}</L>
          {t(", write your policy with the ", "، واكتب سياستك باستخدام ")}
          <L href={to.tool}>{t("free policy template", "نموذج السياسة المجاني")}</L>
          {t(", then ", "، ثم ")}
          <L href={to.pricing}>{t("choose a plan", "اختر اشتراكك")}</L>.
        </>,
      ],
    },
  };

  const { h, p } = content[variant];
  return (
    <section className="mx-auto max-w-3xl px-5 py-14 md:py-20">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-balance md:text-[28px]">{h}</h2>
      {p.map((para, i) => (
        <p key={i} className="mt-4 text-base leading-8 text-muted-foreground text-pretty">
          {para}
        </p>
      ))}
    </section>
  );
}
