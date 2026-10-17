import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/public-site";
import { TOOL_COPY } from "@/lib/public-guides";
import { PolicyTemplatePage, policyPath } from "@/views/policy-template";

type Params = Promise<{ locale: string }>;
async function locale(params: Params) {
  const { locale } = await params;
  if (locale !== "ar" && locale !== "en") notFound();
  return locale;
}
export async function generateMetadata({ params }: { params: Params }) {
  const l = await locale(params);
  return pageMetadata(l, (x) => policyPath(x), TOOL_COPY[l]);
}
export default async function Page({ params }: { params: Params }) {
  return <PolicyTemplatePage locale={await locale(params)} />;
}
