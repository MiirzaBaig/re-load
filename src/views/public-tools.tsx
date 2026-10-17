import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/lib/locale-server";
import { SITE_URL, publicPath } from "@/lib/public-site";
import { TOOL_COPY } from "@/lib/public-guides";
import { POLICY_CATEGORIES } from "@/lib/policy-presets";
import { TOOLS, TOOLS_INDEX_COPY, type ToolSlug } from "@/lib/public-tools";
import { SchemaGraph, baseGraph, breadcrumb } from "@/components/public-schema";
import { Crumbs } from "@/views/public-guides";
import { PolicyChecker } from "@/components/policy-checker";
import { WhatsAppLinkTool } from "@/components/whatsapp-link-tool";
import { ReturnsCostCalculator } from "@/components/returns-cost-calculator";

export function ToolsIndex({ locale }: { locale: Locale }) {
  const i = locale === "ar" ? 1 : 0;
  const copy = TOOLS_INDEX_COPY[locale];
  const items = [
    { href: `/${locale}/return-policy-template`, title: TOOL_COPY[locale].heading, text: TOOL_COPY[locale].description },
    ...TOOLS.map((tool) => ({ href: `/${locale}/tools/${tool.slug}`, title: tool.heading[i], text: tool.description[i] })),
  ];
  return (
    <>
      <SchemaGraph
        graph={[
          ...baseGraph(locale, `/${locale}/tools`, copy.title, copy.description),
          breadcrumb([[i ? "الرئيسية" : "Home", `/${locale}`], [copy.heading, `/${locale}/tools`]]),
          { "@type": "ItemList", itemListElement: items.map((it, n) => ({ "@type": "ListItem", position: n + 1, url: SITE_URL + it.href, name: it.title })) },
        ]}
      />
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-14 sm:pt-20">
        <Crumbs locale={locale} items={[[copy.heading]]} />
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{copy.heading}</h1>
        <p className="mt-5 text-base leading-8 text-muted-foreground">{copy.description}</p>
        <ul className="mt-12 divide-y border-y">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className="group block py-7">
                <h2 className="text-lg font-semibold">{it.title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{it.text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
                  {i ? "افتح الأداة" : "Open the tool"}
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 rtl:-scale-x-100" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <h2 className="mt-14 text-sm font-semibold">{i ? "نماذج سياسة الاسترجاع حسب نوع المتجر" : "Return policy templates by store type"}</h2>
        <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
          {POLICY_CATEGORIES.map((c) => (
            <li key={c.slug} className="border-b">
              <Link href={`/${locale}/return-policy-template/${c.slug}`} className="block py-3 text-sm transition-colors hover:text-foreground/70">
                {c.name[i]}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function ToolPage({ locale, slug }: { locale: Locale; slug: ToolSlug }) {
  const i = locale === "ar" ? 1 : 0;
  const tool = TOOLS.find((x) => x.slug === slug)!;
  const path = `/${locale}/tools/${slug}`;
  return (
    <>
      <SchemaGraph
        graph={[
          ...baseGraph(locale, path, tool.title[i], tool.description[i]),
          breadcrumb([
            [i ? "الرئيسية" : "Home", `/${locale}`],
            [TOOLS_INDEX_COPY[locale].heading, `/${locale}/tools`],
            [tool.heading[i], path],
          ]),
          {
            "@type": "WebApplication",
            name: tool.heading[i],
            url: SITE_URL + path,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            inLanguage: locale,
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "SAR" },
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
        ]}
      />
      <div className="mx-auto max-w-6xl px-5 pt-14 sm:pt-20">
        <Crumbs locale={locale} items={[[TOOLS_INDEX_COPY[locale].heading, `/${locale}/tools`], [tool.heading[i]]]} />
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{tool.heading[i]}</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">{tool.intro[i]}</p>
      </div>
      <div className={slug === "returns-cost-calculator" ? "mt-10" : "mx-auto mt-14 max-w-6xl px-5"}>
        {slug === "policy-checker" ? (
          <PolicyChecker locale={locale} />
        ) : slug === "whatsapp-link" ? (
          <WhatsAppLinkTool locale={locale} />
        ) : (
          <ReturnsCostCalculator />
        )}
      </div>
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {i ? "أدوات مجانية أخرى" : "More free tools"}
        </h2>
        <ul className="mt-5 space-y-3 text-sm">
          {[
            [`/${locale}/return-policy-template`, TOOL_COPY[locale].heading] as const,
            ...TOOLS.filter((x) => x.slug !== slug).map((x) => [`/${locale}/tools/${x.slug}`, x.heading[i]] as const),
            [publicPath(locale, "how-it-works"), i ? "كيف يدير ريلود الإرجاع عبر واتساب" : "How Reload handles returns on WhatsApp"] as const,
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="underline underline-offset-4 transition-colors hover:text-foreground/70">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
