import type { MetadataRoute } from "next";
import { SITE_URL, PUBLIC_PAGES, publicPath } from "@/lib/public-site";
import { GUIDES } from "@/lib/public-guides";
import { POLICY_CATEGORIES } from "@/lib/policy-presets";
import { SOLUTIONS } from "@/lib/public-solutions";
import { TOOLS } from "@/lib/public-tools";
export default function sitemap(): MetadataRoute.Sitemap {
  // Do not fabricate a fresh lastModified timestamp on every request/build.
  return [
    ...(["ar", "en"] as const).flatMap((locale) =>
      PUBLIC_PAGES.map((page) => ({
        url: SITE_URL + publicPath(locale, page),
        alternates: {
          languages: {
            ar: SITE_URL + publicPath("ar", page),
            en: SITE_URL + publicPath("en", page),
            "x-default": SITE_URL + publicPath("ar", page),
          },
        },
      })),
    ),
    // Guides and the free policy tool, in both languages.
    ...[
      { path: "guides" },
      ...SOLUTIONS.map(s => ({ path: `solutions/${s.slug}` })),
      { path: "return-policy-template" },
      ...POLICY_CATEGORIES.map((c) => ({ path: `return-policy-template/${c.slug}` })),
      { path: "tools" },
      ...TOOLS.map((tool) => ({ path: `tools/${tool.slug}` })),
      ...GUIDES.map((g) => ({ path: `guides/${g.slug}`, lastModified: g.published })),
    ].flatMap(({ path, lastModified }: { path: string; lastModified?: string }) =>
      (["ar", "en"] as const).map((locale) => ({
        url: `${SITE_URL}/${locale}/${path}`,
        ...(lastModified ? { lastModified } : {}),
        alternates: {
          languages: {
            ar: `${SITE_URL}/ar/${path}`,
            en: `${SITE_URL}/en/${path}`,
            "x-default": `${SITE_URL}/ar/${path}`,
          },
        },
      })),
    ),
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
  ];
}
