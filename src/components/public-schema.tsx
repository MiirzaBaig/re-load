import {
  SITE_URL,
  publicPath,
  type PublicPage,
  PUBLIC_COPY,
} from "@/lib/public-site";
import type { Locale } from "@/lib/locale-server";
import { PUBLIC_FAQS } from "@/lib/public-content";
import { BILLING_PLANS } from "../../supabase/functions/_shared/billing-contract";
export function PublicSchema({
  locale,
  page = "",
}: {
  locale: Locale;
  page?: PublicPage;
}) {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Reload",
      alternateName: "ريلود",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/brand/reload-icon-512.png`,
        width: 512,
        height: 512,
      },
      email: "info@reload.sa",
      areaServed: ["SA", "AE", "KW", "QA", "BH", "OM"],
      knowsLanguage: ["ar", "en"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Reload | ريلود",
      url: SITE_URL,
      inLanguage: ["ar", "en"],
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}${publicPath(locale, page)}#page`,
      url: `${SITE_URL}${publicPath(locale, page)}`,
      name: PUBLIC_COPY[page][locale].title,
      description: PUBLIC_COPY[page][locale].description,
      inLanguage: locale,
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
  ];
  if (page)
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: locale === "ar" ? "الرئيسية" : "Home",
          item: SITE_URL + publicPath(locale),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: PUBLIC_COPY[page][locale].title,
          item: SITE_URL + publicPath(locale, page),
        },
      ],
    });
  // Visible FAQ only. Google no longer shows FAQ results for most sites, but
  // Bing and AI assistants still read this to understand the answers.
  if (page === "faq")
    graph.push({
      "@type": "FAQPage",
      "@id": `${SITE_URL}${publicPath(locale, page)}#faq`,
      inLanguage: locale,
      mainEntity: PUBLIC_FAQS.map((f) => ({
        "@type": "Question",
        name: f.q[locale === "ar" ? 1 : 0],
        acceptedAnswer: { "@type": "Answer", text: f.a[locale === "ar" ? 1 : 0] },
      })),
    });
  if (page === "pricing")
    graph.push({
      "@type": "SoftwareApplication",
      name: "Reload",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: PUBLIC_COPY[""][locale].description,
      url: SITE_URL + publicPath(locale, "pricing"),
      offers: Object.values(BILLING_PLANS).flatMap((plan) => [
        {
          "@type": "Offer",
          name: `${plan.name} monthly`,
          price: (plan.price / 100).toFixed(2),
          priceCurrency: "SAR",
          description: `${plan.messages} delivered outgoing messages per month. VAT included.`,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: (plan.price / 100).toFixed(2),
            priceCurrency: "SAR",
            valueAddedTaxIncluded: true,
            billingDuration: "P1M",
          },
        },
        {
          "@type": "Offer",
          name: `${plan.name} annual`,
          price: (plan.annualPrice / 100).toFixed(2),
          priceCurrency: "SAR",
          description: `Paid upfront; ${plan.messages} delivered outgoing messages refresh monthly. VAT included.`,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: (plan.annualPrice / 100).toFixed(2),
            priceCurrency: "SAR",
            valueAddedTaxIncluded: true,
            billingDuration: "P1Y",
          },
        },
      ]),
    });
  return <SchemaGraph graph={graph} />;
}

/** Shared organisation and site nodes, so every page describes Reload the same way. */
export function baseGraph(locale: Locale, path: string, name: string, description: string) {
  return [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Reload", alternateName: "ريلود", url: SITE_URL },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "Reload | ريلود", url: SITE_URL, inLanguage: ["ar", "en"], publisher: { "@id": `${SITE_URL}/#organization` } },
    { "@type": "WebPage", "@id": `${SITE_URL}${path}#page`, url: SITE_URL + path, name, description, inLanguage: locale, isPartOf: { "@id": `${SITE_URL}/#website` } },
  ];
}

export function breadcrumb(items: Array<[string, string]>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE_URL + path })),
  };
}

export function SchemaGraph({ graph }: { graph: Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }).replace(/</g, "\\u003c"),
      }}
    />
  );
}
