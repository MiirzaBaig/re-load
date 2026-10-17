import { notFound } from "next/navigation";
import {
  publicMetadata,
  PUBLIC_PAGES,
  type PublicPage,
} from "@/lib/public-site";
import { PublicSchema } from "@/components/public-schema";
import { PublicDetails } from "@/views/public-details";
async function checked(params: Promise<{ locale: string; page: string }>) {
  const value = await params;
  if (
    (value.locale !== "ar" && value.locale !== "en") ||
    !PUBLIC_PAGES.includes(value.page as PublicPage) ||
    !value.page
  )
    notFound();
  return {
    locale: value.locale as "ar" | "en",
    page: value.page as Exclude<PublicPage, "">,
  };
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
}) {
  const { locale, page } = await checked(params);
  return publicMetadata(locale, page);
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
}) {
  const { locale, page } = await checked(params);
  return (
    <>
      <PublicSchema locale={locale} page={page} />
      <PublicDetails page={page} />
    </>
  );
}
