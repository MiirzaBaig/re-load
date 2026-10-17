import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/public-site";
import { TOOLS, toolBySlug } from "@/lib/public-tools";
import { ToolPage } from "@/views/public-tools";

type Params = Promise<{ locale: string; tool: string }>;
export function generateStaticParams() {
  return (["ar", "en"] as const).flatMap((locale) => TOOLS.map((t) => ({ locale, tool: t.slug })));
}
async function resolve(params: Params) {
  const { locale, tool } = await params;
  const found = toolBySlug(tool);
  if ((locale !== "ar" && locale !== "en") || !found) notFound();
  return { locale: locale as "ar" | "en", tool: found };
}
export async function generateMetadata({ params }: { params: Params }) {
  const { locale, tool } = await resolve(params);
  const i = locale === "ar" ? 1 : 0;
  return pageMetadata(locale, (x) => `/${x}/tools/${tool.slug}`, { title: tool.title[i], description: tool.description[i] });
}
export default async function Page({ params }: { params: Params }) {
  const { locale, tool } = await resolve(params);
  return <ToolPage locale={locale} slug={tool.slug} />;
}
