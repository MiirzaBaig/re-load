import { PUBLIC_FAQS, PUBLIC_STEPS } from "@/lib/public-content";
import { PUBLIC_COPY, SITE_URL, publicPath } from "@/lib/public-site";
import { GUIDES, TOOL_COPY } from "@/lib/public-guides";
import { POLICY_CATEGORIES } from "@/lib/policy-presets";
import { TOOLS } from "@/lib/public-tools";
import { BILLING_PLANS } from "../../../supabase/functions/_shared/billing-contract";

// A plain-text summary for AI assistants (llmstxt.org). Built from the same
// facts as the public pages and schema, so prices and answers never drift.
// Google ignores this file for search; it is a convenience for tools that read it.
export const dynamic = "force-static";

const sar = (halalas: number) =>
  (halalas / 100).toLocaleString("en-US", { minimumFractionDigits: halalas % 100 ? 2 : 0 });

function section(locale: "ar" | "en") {
  const i = locale === "en" ? 0 : 1;
  const page = (p: "" | "pricing" | "faq" | "how-it-works") => SITE_URL + publicPath(locale, p);
  const { standard, premium } = BILLING_PLANS;
  const lines =
    locale === "ar"
      ? [
          "## بالعربية",
          "",
          `- [الصفحة الرئيسية](${page("")}): ${PUBLIC_COPY[""].ar.description}`,
          `- [الأسعار](${page("pricing")}): ${PUBLIC_COPY.pricing.ar.description}`,
          `- [الأسئلة الشائعة](${page("faq")}): ${PUBLIC_COPY.faq.ar.description}`,
          `- [كيف يعمل](${page("how-it-works")}): ${PUBLIC_COPY["how-it-works"].ar.description}`,
          "",
          "### الاشتراكات (بالريال السعودي، شاملة الضريبة)",
          "",
          `- ستاندرد: ${sar(standard.price)} ريال شهريًا أو ${sar(standard.annualPrice)} ريال سنويًا. ${standard.messages.toLocaleString("en-US")} رسالة صادرة مسلّمة شهريًا.`,
          `- بريميوم: ${sar(premium.price)} ريال شهريًا أو ${sar(premium.annualPrice)} ريال سنويًا. ${premium.messages.toLocaleString("en-US")} رسالة صادرة مسلّمة شهريًا.`,
          "- الدفع السنوي يوفر 20٪، والرصيد يتجدد كل شهر.",
        ]
      : [
          "## In English",
          "",
          `- [Home](${page("")}): ${PUBLIC_COPY[""].en.description}`,
          `- [Pricing](${page("pricing")}): ${PUBLIC_COPY.pricing.en.description}`,
          `- [FAQ](${page("faq")}): ${PUBLIC_COPY.faq.en.description}`,
          `- [How it works](${page("how-it-works")}): ${PUBLIC_COPY["how-it-works"].en.description}`,
          "",
          "### Plans (SAR, VAT included)",
          "",
          `- Standard: SAR ${sar(standard.price)}/month or SAR ${sar(standard.annualPrice)}/year. ${standard.messages.toLocaleString("en-US")} delivered outgoing messages a month.`,
          `- Premium: SAR ${sar(premium.price)}/month or SAR ${sar(premium.annualPrice)}/year. ${premium.messages.toLocaleString("en-US")} delivered outgoing messages a month.`,
          "- Paying yearly saves 20%. The message allowance refreshes every month.",
        ];
  const guides = [
    "",
    locale === "ar" ? "### أدلة وأدوات مجانية" : "### Guides and free tools",
    "",
    ...GUIDES.map((g) => `- [${g.title[i]}](${SITE_URL}/${locale}/guides/${g.slug}): ${g.description[i]}`),
    `- [${TOOL_COPY[locale].heading}](${SITE_URL}/${locale}/return-policy-template): ${TOOL_COPY[locale].description}`,
    ...POLICY_CATEGORIES.map((c) => `- [${c.title[i]}](${SITE_URL}/${locale}/return-policy-template/${c.slug}): ${c.description[i]}`),
    ...TOOLS.map((tool) => `- [${tool.heading[i]}](${SITE_URL}/${locale}/tools/${tool.slug}): ${tool.description[i]}`),
  ];
  return [
    ...lines,
    ...guides,
    "",
    locale === "ar" ? "### كيف يعمل" : "### How it works",
    "",
    ...PUBLIC_STEPS.map((s, n) => `${n + 1}. ${s.title[i]}: ${s.body[i]}`),
    "",
    locale === "ar" ? "### أسئلة شائعة" : "### Frequently asked questions",
    "",
    ...PUBLIC_FAQS.flatMap((f) => [`**${f.q[i]}**`, f.a[i], ""]),
  ];
}

export function GET() {
  const body = [
    "# Reload | ريلود",
    "",
    "> Reload (ريلود) helps Saudi and GCC online stores handle return requests and customer support on WhatsApp, using store information and policies the merchant approves. Arabic first, English available.",
    "",
    `Website: ${SITE_URL}/ar (Arabic, default) and ${SITE_URL}/en (English). Contact: info@reload.sa`,
    "",
    ...section("ar"),
    ...section("en"),
    "## Optional",
    "",
    `- [Privacy policy](${SITE_URL}/privacy)`,
    `- [Terms](${SITE_URL}/terms)`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
