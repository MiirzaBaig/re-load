"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Mail } from "lucide-react";
import { ReloadMark } from "@/components/reload-logo";
import { useLanguage } from "@/components/language-provider";
import { publicPath } from "@/lib/public-site";
import { cn } from "@/lib/utils";

/*
 * The site footer: brand + link columns, a quiet bottom bar, and the name set
 * very large and faint along the bottom edge, fading into the page.
 *
 * It scrolls with the page like any other section. It replaced the "curtain"
 * footer (components/curtain-reveal.tsx, kept for reference), which pinned a
 * full-screen panel behind the page and animated it on every scroll frame;
 * that lagged on slower devices. Nothing here runs on scroll: each entrance
 * plays once when it comes into view.
 */
export function SiteFooter() {
  const { t, locale } = useLanguage();
  const home = publicPath(locale);
  // A plain crawlable link to the same page in the other language.
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";
  const localized = /^\/(ar|en)(\/|$)/.test(pathname);
  const otherHref = localized
    ? pathname.replace(/^\/(ar|en)/, `/${other}`)
    : publicPath(other);
  const wordmark = t("Reload", "ريلود");
  const footerColumns = [
    {
      title: t("Product", "المنتج"),
      links: [
        { label: t("Overview", "نظرة عامة"), href: `${home}#demo` }, // was #product (outcome phones, hidden 2026-10-20)
        {
          label: t("How it works", "كيف يعمل"),
          href: publicPath(locale, "how-it-works"),
        },
        {
          label: t("Returns financing", "تمويل المرتجعات"),
          // Was `${home}#returns-financing`; the calculator left the homepage (2026-10-20).
          href: `/${locale}/tools/returns-cost-calculator`,
        },
        { label: t("Pricing", "الأسعار"), href: publicPath(locale, "pricing") },
        { label: t("FAQ", "الأسئلة الشائعة"), href: publicPath(locale, "faq") },
        { label: t("Start a return", "بدء طلب إرجاع"), href: "/return" },
      ],
    },
    {
      title: t("Company", "الشركة"),
      links: [
        { label: t("About", "عن ريلود"), href: `${home}#integrations` }, // was #product (outcome phones, hidden 2026-10-20)
        { label: t("Contact", "تواصل معنا"), href: `${home}#contact` },
        { label: t("Merchant sign in", "دخول التجار"), href: "/app" },
      ],
    },
    {
      title: t("Resources", "المصادر"),
      links: [
        { label: t("Merchant guides", "أدلة التاجر"), href: `/${locale}/guides` },
        {
          label: t("Return policy template", "نموذج سياسة الاسترجاع"),
          href: `/${locale}/return-policy-template`,
        },
        { label: t("Free tools", "أدوات مجانية"), href: `/${locale}/tools` },
        { label: t("Privacy", "الخصوصية"), href: "/privacy" },
        { label: t("Terms", "الشروط"), href: "/terms" },
      ],
    },
  ];

  const [gridRef, gridIn] = useSeen<HTMLDivElement>(0.2);
  const [giantRef, giantIn] = useSeen<HTMLDivElement>(0.35);

  return (
    <footer className="site-footer">
      <div className="mx-auto w-full max-w-[1200px] px-5 pt-16 sm:px-8 sm:pt-24">
        <div ref={gridRef} className={cn("footer-grid", gridIn && "is-in")}>
          <div className="footer-brand">
            <Link
              href={home}
              className="footer-logo inline-flex items-center gap-2.5 text-footer-fg"
              aria-label={wordmark}
            >
              <span className="footer-logo-mark">
                <ReloadMark className="size-7" />
              </span>
              <span className="font-display text-xl font-semibold tracking-[-0.02em]">
                {wordmark}
              </span>
            </Link>
            <p className="mt-4 max-w-[280px] text-sm leading-6 text-footer-muted">
              {t(
                "Return decisions in minutes, from your own policy. Built for online stores in Saudi Arabia.",
                "قرارات الإرجاع في دقائق، من سياستك أنت. صُمم للمتاجر الإلكترونية في السعودية.",
              )}
            </p>
            <EmailChip t={t} />
          </div>
          {footerColumns.map((column, index) => (
            <nav
              key={column.title}
              aria-label={column.title}
              className="footer-column"
              style={{ ["--c" as string]: index + 1 }}
            >
              <h3 className="footer-heading">{column.title}</h3>
              <ul className="mt-4 space-y-1">
                {column.links.map((link, linkIndex) => (
                  <li
                    key={link.label}
                    className="footer-item"
                    style={{ ["--n" as string]: linkIndex }}
                  >
                    <FooterLink {...link} start />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className={cn("footer-bottom", gridIn && "is-in")}>
          {/* Arabic leads with the words and closes with the year so bidi
              never has to reorder a trailing "©". */}
          <span>
            {t(
              `© ${new Date().getFullYear()} Reload. All rights reserved.`,
              `جميع الحقوق محفوظة لريلود © ${new Date().getFullYear()}`,
            )}
          </span>
          <span className="footer-bottom-end">
            <a
              href={otherHref}
              hrefLang={other}
              lang={other}
              className="footer-lang"
            >
              {other === "en" ? "English" : "العربية"}
            </a>
            <span className="footer-made">
              <HeartMark />
              {t("Proudly built in Saudi Arabia", "صُنع بفخر في السعودية")}
            </span>
          </span>
        </div>
      </div>

      {/* Decorative: the name, huge and faint, cut off by the page's edge. */}
      <div
        ref={giantRef}
        className={cn("footer-giant", giantIn && "is-in")}
        aria-hidden="true"
      >
        <span>{wordmark}</span>
      </div>
    </footer>
  );
}

/** True once the element has been scrolled into view (never back to false). */
function useSeen<T extends Element>(threshold: number) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

function FooterLink({
  label,
  href,
  start,
}: {
  label: string;
  href: string;
  start?: boolean;
}) {
  const className = cn("footer-link", start && "footer-link-start");
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      <span className="footer-link-text">{label}</span>
      {start && (
        <ArrowUpRight
          aria-hidden="true"
          className="footer-link-arrow size-3.5"
        />
      )}
    </Link>
  );
}

const CONTACT_EMAIL = "info@reload.sa";

/** The contact address, with a copy button that confirms in place. */
function EmailChip({ t }: { t: (en: string, ar: string) => string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${CONTACT_EMAIL}`;
    }
  };
  return (
    <div className="footer-email">
      {/* dir="ltr" keeps the address intact inside RTL text. */}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        dir="ltr"
        className="footer-email-link"
      >
        <Mail className="size-4" />
        {CONTACT_EMAIL}
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        className="footer-email-copy"
        aria-label={t("Copy email address", "نسخ البريد الإلكتروني")}
      >
        <span className={cn("footer-email-icon", copied && "is-hidden")}>
          <Copy className="size-3.5" />
        </span>
        <span className={cn("footer-email-icon", !copied && "is-hidden")}>
          <Check className="size-3.5" />
        </span>
      </button>
      <span
        role="status"
        aria-live="polite"
        className={cn("footer-email-toast", copied && "is-shown")}
      >
        {t("Copied", "تم النسخ")}
      </span>
    </div>
  );
}

/** A green heart, in place of a flag: Saudi green. It draws itself once as
 *  the footer comes into view, then beats once on hover. */
function HeartMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="footer-heart">
      <path
        pathLength={1}
        d="M12 20.5s-7.3-4.5-9.3-9C1.3 8.3 3.2 4.6 6.8 4.6c2.1 0 3.5 1.1 5.2 3.1 1.7-2 3.1-3.1 5.2-3.1 3.6 0 5.5 3.7 4.1 6.9-2 4.5-9.3 9-9.3 9z"
      />
    </svg>
  );
}
