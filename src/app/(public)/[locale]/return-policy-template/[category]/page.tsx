import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/public-site";
import { POLICY_CATEGORIES, policyCategory } from "@/lib/policy-presets";
import { PolicyTemplatePage, policyPath } from "@/views/policy-template";

type Params = Promise<{ locale: string; category: string }>;
export function generateStaticParams() {
  return (["ar", "en"] as const).flatMap((locale) => POLICY_CATEGORIES.map((c) => ({ locale, category: c.slug })));
}
async function resolve(params: Params) {
  const { locale, category } = await params;
  const found = policyCategory(category);
  if ((locale !== "ar" && locale !== "en") || !found) notFound();
  return { locale: locale as "ar" | "en", category: found };
}
export async function generateMetadata({ params }: { params: Params }) {
  const { locale, category } = await resolve(params);
  const i = locale === "ar" ? 1 : 0;
  return pageMetadata(locale, (x) => policyPath(x, category), {
    title: `${category.title[i]} | ${i ? "ريلود" : "Reload"}`,
    description: category.description[i],
  });
}
export default async function Page({ params }: { params: Params }) {
  const { locale, category } = await resolve(params);
  return <PolicyTemplatePage locale={locale} category={category} />;
}
