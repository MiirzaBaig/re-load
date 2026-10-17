import { notFound } from "next/navigation";
import { publicMetadata } from "@/lib/public-site";
import { PublicSchema } from "@/components/public-schema";
import { LandingPage } from "@/views/landing";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "ar" && locale !== "en") notFound();
  return publicMetadata(locale);
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "ar" && locale !== "en") notFound();
  return (
    <>
      <PublicSchema locale={locale} />
      <LandingPage />
    </>
  );
}
