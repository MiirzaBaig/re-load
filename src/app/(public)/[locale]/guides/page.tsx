import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/public-site";
import { GUIDES, GUIDES_COPY } from "@/lib/public-guides";
import { SITE_URL } from "@/lib/public-site";
import { SchemaGraph, baseGraph, breadcrumb } from "@/components/public-schema";
import { GuidesIndex } from "@/views/public-guides";

type Params = Promise<{ locale: string }>;
async function locale(params: Params) {
  const { locale } = await params;
  if (locale !== "ar" && locale !== "en") notFound();
  return locale;
}
export async function generateMetadata({ params }: { params: Params }) {
  const l = await locale(params);
  return pageMetadata(l, (x) => `/${x}/guides`, GUIDES_COPY[l]);
}
export default async function Page({ params }: { params: Params }) {
  const l = await locale(params);
  const i = l === "ar" ? 1 : 0;
  const path = `/${l}/guides`;
  return (
    <>
      <SchemaGraph
        graph={[
          ...baseGraph(l, path, GUIDES_COPY[l].title, GUIDES_COPY[l].description),
          breadcrumb([[i ? "الرئيسية" : "Home", `/${l}`], [i ? "الأدلة" : "Guides", path]]),
          {
            "@type": "ItemList",
            itemListElement: GUIDES.map((g, n) => ({ "@type": "ListItem", position: n + 1, url: `${SITE_URL}/${l}/guides/${g.slug}`, name: g.title[i] })),
          },
        ]}
      />
      <GuidesIndex locale={l} />
    </>
  );
}
