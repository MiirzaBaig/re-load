"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { PUBLIC_FAQS } from "@/lib/public-content";
import { publicPath } from "@/lib/public-site";
import { ScrollReveal } from "@/components/scroll-reveal";
export function PublicFaq({ full = false }: { full?: boolean }) {
  const { t, isArabic, locale } = useLanguage();
  const items = full ? PUBLIC_FAQS : PUBLIC_FAQS.slice(0, 5);
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <ScrollReveal>
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-medium text-muted-foreground">
              {t("Before you get started", "قبل أن تبدأ")}
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
              {t("Clear answers. No surprises.", "إجابات واضحة. من البداية.")}
            </h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              {t(
                "The details that help you choose what works for your store.",
                "التفاصيل التي تساعدك على اختيار ما يناسب متجرك.",
              )}
            </p>
          </div>
        </ScrollReveal>
        <div className="divide-y rounded-2xl border bg-card px-5 sm:px-7">
          {items.map((item, index) => (
            <details key={index} className="public-faq group py-1">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-5 rounded-xl py-5 text-start font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span>{item.q[isArabic ? 1 : 0]}</span>
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
              </summary>
              <div className="public-faq-answer pb-5 text-sm leading-7 text-muted-foreground">
                {item.a[isArabic ? 1 : 0]}
              </div>
            </details>
          ))}
        </div>
        {!full && (
          <Link
            href={publicPath(locale, "faq")}
            className="mt-5 inline-block rounded-lg px-1 py-2 text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("See all questions", "عرض جميع الأسئلة")}
          </Link>
        )}
      </div>
    </section>
  );
}
