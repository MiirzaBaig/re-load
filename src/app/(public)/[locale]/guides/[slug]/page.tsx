import { notFound } from "next/navigation";
import { SITE_URL, pageMetadata } from "@/lib/public-site";
import { GUIDES, guideBySlug } from "@/lib/public-guides";
import { SchemaGraph, baseGraph, breadcrumb } from "@/components/public-schema";
import { GuideArticle } from "@/views/public-guides";

type Params = Promise<{ locale: string; slug: string }>;
export function generateStaticParams() {
  return (["ar", "en"] as const).flatMap((locale) => GUIDES.map((g) => ({ locale, slug: g.slug })));
}
async function resolve(params: Params) {
  const { locale, slug } = await params;
  const guide = guideBySlug(slug);
  if ((locale !== "ar" && locale !== "en") || !guide) notFound();
  return { locale: locale as "ar" | "en", guide };
}
export async function generateMetadata({ params }: { params: Params }) {
  const { locale, guide } = await resolve(params);
  const i = locale === "ar" ? 1 : 0;
  return pageMetadata(
    locale,
    (x) => `/${x}/guides/${guide.slug}`,
    { title: `${guide.title[i]} | ${i ? "ريلود" : "Reload"}`, description: guide.description[i] },
    "article",
  );
}
export default async function Page({ params }: { params: Params }) {
  const { locale, guide } = await resolve(params);
  const i = locale === "ar" ? 1 : 0;
  const path = `/${locale}/guides/${guide.slug}`;
  return (
    <>
      <SchemaGraph
        graph={[
          ...baseGraph(locale, path, guide.title[i], guide.description[i]),
          breadcrumb([
            [i ? "الرئيسية" : "Home", `/${locale}`],
            [i ? "الأدلة" : "Guides", `/${locale}/guides`],
            [guide.title[i], path],
          ]),
          {
            "@type": "Article",
            "@id": `${SITE_URL}${path}#article`,
            headline: guide.title[i],
            description: guide.description[i],
            inLanguage: locale,
            datePublished: guide.published,
            dateModified: guide.published,
            keywords: guide.keyword[i],
            author: { "@id": `${SITE_URL}/#organization` },
            publisher: { "@id": `${SITE_URL}/#organization` },
            image: `${SITE_URL}/brand/reload-share-${locale}.png`,
            mainEntityOfPage: { "@id": `${SITE_URL}${path}#page` },
          },
        ]}
      />
      <GuideArticle locale={locale} guide={guide} />
    </>
  );
}
