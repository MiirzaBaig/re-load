import Link from "next/link";
import type { Locale } from "@/lib/locale-server";
import { SITE_URL, publicPath } from "@/lib/public-site";
import { TOOL_COPY } from "@/lib/public-guides";
import { POLICY_CATEGORIES, type PolicyCategory } from "@/lib/policy-presets";
import { SchemaGraph, baseGraph, breadcrumb } from "@/components/public-schema";
import { ReturnPolicyGenerator } from "@/components/return-policy-generator";
import { Crumbs } from "@/views/public-guides";

// The general template and each store-type template share this page.
export function policyPath(locale: Locale, category?: PolicyCategory) {
  return `/${locale}/return-policy-template${category ? `/${category.slug}` : ""}`;
}

export function PolicyTemplatePage({ locale, category }: { locale: Locale; category?: PolicyCategory }) {
  const ar = locale === "ar";
  const i = ar ? 1 : 0;
  const path = policyPath(locale, category);
  const heading = category ? category.title[i] : TOOL_COPY[locale].heading;
  const description = category ? category.description[i] : TOOL_COPY[locale].description;
  const root: [string, string] = [TOOL_COPY[locale].heading, policyPath(locale)];
  return (
    <>
      <SchemaGraph
        graph={[
          ...baseGraph(locale, path, heading, description),
          breadcrumb([[ar ? "الرئيسية" : "Home", `/${locale}`], root, ...(category ? [[category.name[i], path] as [string, string]] : [])]),
          {
            "@type": "WebApplication",
            name: heading,
            url: SITE_URL + path,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            inLanguage: locale,
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "SAR" },
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
        ]}
      />
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:pt-20">
        <Crumbs locale={locale} items={category ? [[root[0], root[1]], [category.name[i]]] : [[root[0]]]} />
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{heading}</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
          {category
            ? category.intro[i]
            : ar
              ? "اختر مدة الإرجاع، وحالة المنتج المقبولة، والاستثناءات، وطريقة الاسترداد، ومن يتحمل تكلفة الشحن. تظهر سياسة الاسترجاع والاستبدال جاهزة بالعربية أو الإنجليزية لتنسخها إلى متجرك على أي منصة. مجانًا وبدون تسجيل."
              : "Choose your return window, accepted condition, exclusions, refund method and who pays shipping. Your return and exchange policy appears ready in Arabic or English to copy into your store on any platform. Free, no sign-up."}
        </p>
        {category && (
          <ul className="mt-8 max-w-2xl space-y-3">
            {category.tips.map((tip) => (
              <li key={tip[0]} className="flex gap-3 text-sm leading-7 text-muted-foreground">
                <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[var(--foreground)]" />
                {tip[i]}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-14">
          <ReturnPolicyGenerator locale={locale} preset={category?.preset} creditUrl={SITE_URL + path} />
        </div>

        <nav aria-label={ar ? "نماذج حسب نوع المتجر" : "Templates by store type"} className="mt-20 border-t pt-10">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {ar ? "نماذج جاهزة حسب نوع متجرك" : "Ready templates for your type of store"}
          </h2>
          <ul className="mt-6 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {POLICY_CATEGORIES.filter((c) => c.slug !== category?.slug).map((c) => (
              <li key={c.slug} className="border-b">
                <Link href={policyPath(locale, c)} className="block py-4 text-sm transition-colors hover:text-foreground/70">
                  {c.title[i]}
                </Link>
              </li>
            ))}
            {category && (
              <li className="border-b">
                <Link href={policyPath(locale)} className="block py-4 text-sm transition-colors hover:text-foreground/70">
                  {TOOL_COPY[locale].heading}
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <section className="mt-16 max-w-3xl">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {ar ? "بعد نشر السياسة: طبّقها بنفس الطريقة لكل عميل" : "After you publish it: apply it the same way for every customer"}
          </h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            {ar ? "السياسة الواضحة نصف الطريق. النصف الآخر أن يحصل كل عميل على الإجابة نفسها. مع " : "A clear policy is half the job. The other half is giving every customer the same answer. With "}
            <Link href={publicPath(locale, "how-it-works")} className="text-foreground underline underline-offset-4">
              {ar ? "ريلود" : "Reload"}
            </Link>
            {ar
              ? "، يبدأ العميل طلب الإرجاع عبر واتساب، فيتحقق المساعد من الطلب ويقارنه بسياستك المنشورة ويسجّل الحالة، ويحيل الحالات غير الواضحة إليك."
              : ", customers start a return on WhatsApp; the assistant verifies the order, checks it against your published policy, records the case and hands unclear requests to you."}
          </p>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            {ar ? "لمزيد من التفاصيل اقرأ " : "For more detail, read "}
            <Link href={`/${locale}/guides/return-policy`} className="text-foreground underline underline-offset-4">
              {ar ? "كيف تكتب سياسة استرجاع واستبدال واضحة" : "how to write a clear return and exchange policy"}
            </Link>
            {ar ? "، أو جرّب " : ", try the "}
            <Link href={`/${locale}/tools/policy-checker`} className="text-foreground underline underline-offset-4">
              {ar ? "فاحص سياسة الاسترجاع" : "return policy checker"}
            </Link>
            {ar ? "، أو قارن " : ", or compare "}
            <Link href={publicPath(locale, "pricing")} className="text-foreground underline underline-offset-4">
              {ar ? "اشتراكات ريلود" : "Reload's plans"}
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
