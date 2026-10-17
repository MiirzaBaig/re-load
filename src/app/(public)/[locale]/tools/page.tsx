import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/public-site";
import { TOOLS_INDEX_COPY } from "@/lib/public-tools";
import { ToolsIndex } from "@/views/public-tools";

type Params = Promise<{ locale: string }>;
async function locale(params: Params) {
  const { locale } = await params;
  if (locale !== "ar" && locale !== "en") notFound();
  return locale;
}
export async function generateMetadata({ params }: { params: Params }) {
  const l = await locale(params);
  return pageMetadata(l, (x) => `/${x}/tools`, TOOLS_INDEX_COPY[l]);
}
export default async function Page({ params }: { params: Params }) {
  return <ToolsIndex locale={await locale(params)} />;
}
