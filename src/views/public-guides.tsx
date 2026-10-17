import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/lib/locale-server";
import { GUIDES, GUIDES_COPY, type Guide } from "@/lib/public-guides";
import { publicPath } from "@/lib/public-site";
import { TOOL_COPY } from "@/lib/public-guides";

// Server-rendered on purpose: every word is in the HTML crawlers receive.

const RELATED_LABEL: Record<Guide["related"][number], readonly [string, string]> = {
  pricing: ["Reload pricing: Standard and Premium", "أسعار ريلود: ستاندرد وبريميوم"],
  faq: ["Frequently asked questions", "الأسئلة الشائعة"],
  "how-it-works": ["How Reload handles returns on WhatsApp", "كيف يدير ريلود الإرجاع عبر واتساب"],
  "return-policy-template": ["Free return policy template", "نموذج سياسة الاسترجاع المجاني"],
};

export function relatedHref(locale: Locale, key: Guide["related"][number]) {
  return key === "return-policy-template"
    ? `/${locale}/return-policy-template`
    : publicPath(locale, key);
}

export function Crumbs({ locale, items }: { locale: Locale; items: Array<[string, string?]> }) {
  const ar = locale === "ar";
  return (
    <nav aria-label={ar ? "مسار التنقل" : "Breadcrumb"} className="mb-7 flex flex-wrap gap-2 text-xs text-muted-foreground">
      <Link href={publicPath(locale)} className="underline underline-offset-4">
        {ar ? "الرئيسية" : "Home"}
      </Link>
      {items.map(([label, href]) => (
        <span key={label} className="flex gap-2">
          <span aria-hidden="true">/</span>
          {href ? (
            <Link href={href} className="underline underline-offset-4">
              {label}
            </Link>
          ) : (
            <span>{label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function Cta({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  return (
    <section className="mt-16 border-t pt-10">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        {ar ? "دع ريلود يتولى طلبات الإرجاع عبر واتساب" : "Let Reload handle return requests on WhatsApp"}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        {ar
          ? "يتحقق ريلود من الطلب، ويطبّق سياستك المعتمدة، ويسجّل كل حالة، ويحيل الحالات غير الواضحة إليك. جهّز متجرك مجانًا."
          : "Reload verifies the order, applies your approved policy, records every case and hands unclear requests to you. Prepare your store for free."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/auth"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform active:scale-[.98]"
        >
          {ar ? "جهّز متجرك مجانًا" : "Prepare your store free"}
          <ArrowUpRight className="size-4 rtl:-scale-x-100" />
        </Link>
        <Link
          href={publicPath(locale, "pricing")}
          className="inline-flex h-10 items-center rounded-xl border px-5 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          {ar ? "شاهد الأسعار" : "See pricing"}
        </Link>
      </div>
    </section>
  );
}

export function GuidesIndex({ locale }: { locale: Locale }) {
  const i = locale === "ar" ? 1 : 0;
  const copy = GUIDES_COPY[locale];
  return (
    <article className="mx-auto max-w-3xl px-5 pb-20 pt-14 sm:pt-20">
      <Crumbs locale={locale} items={[[i ? "الأدلة" : "Guides"]]} />
      <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{copy.heading}</h1>
      <p className="mt-5 text-base leading-8 text-muted-foreground">{copy.description}</p>
      <ul className="mt-12 divide-y border-y">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/${locale}/guides/${g.slug}`} className="group block py-7">
              <h2 className="text-lg font-semibold leading-snug transition-colors group-hover:text-foreground/80">
                {g.title[i]}
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{g.description[i]}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
                {i ? "اقرأ الدليل" : "Read the guide"}
                <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 rtl:-scale-x-100" />
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link href={`/${locale}/return-policy-template`} className="group block py-7">
            <h2 className="text-lg font-semibold leading-snug">{TOOL_COPY[locale].heading}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{TOOL_COPY[locale].description}</p>
          </Link>
        </li>
      </ul>
      <Cta locale={locale} />
    </article>
  );
}

export function GuideArticle({ locale, guide }: { locale: Locale; guide: Guide }) {
  const i = locale === "ar" ? 1 : 0;
  const date = new Intl.DateTimeFormat(i ? "ar-SA-u-nu-latn" : "en-GB", { dateStyle: "long" }).format(new Date(guide.published));
  return (
    <article className="mx-auto max-w-3xl px-5 pb-20 pt-14 sm:pt-20">
      <Crumbs locale={locale} items={[[i ? "الأدلة" : "Guides", `/${locale}/guides`], [guide.title[i]]]} />
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[44px]">{guide.title[i]}</h1>
      <p className="mt-4 text-xs text-muted-foreground">
        {i ? "فريق ريلود" : "Reload team"} · <time dateTime={guide.published}>{date}</time>
      </p>
      <p className="mt-8 text-lg leading-9 text-foreground/90">{guide.intro[i]}</p>
      {guide.sections.map((section) => (
        <section key={section.heading[0]} className="mt-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{section.heading[i]}</h2>
          {section.body.map((p) => (
            <p key={p[0]} className="mt-4 text-base leading-8 text-muted-foreground">
              {p[i]}
            </p>
          ))}
          {section.list && (
            <ul className="mt-5 space-y-3">
              {section.list.map((item) => (
                <li key={item[0]} className="flex gap-3 text-base leading-7 text-muted-foreground">
                  <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                  {item[i]}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <nav aria-label={i ? "روابط ذات صلة" : "Related"} className="mt-14 border-t pt-8">
        <h2 className="text-sm font-semibold">{i ? "اقرأ أيضًا" : "Read next"}</h2>
        <ul className="mt-4 space-y-3">
          {guide.related.map((key) => (
            <li key={key}>
              <Link href={relatedHref(locale, key)} className="text-sm underline underline-offset-4 transition-colors hover:text-foreground/70">
                {RELATED_LABEL[key][i]}
              </Link>
            </li>
          ))}
          {GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
            <li key={g.slug}>
              <Link href={`/${locale}/guides/${g.slug}`} className="text-sm underline underline-offset-4 transition-colors hover:text-foreground/70">
                {g.title[i]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Cta locale={locale} />
    </article>
  );
}

