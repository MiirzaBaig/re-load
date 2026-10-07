"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowRight, ArrowUpRight, Check, Copy, Mail } from "lucide-react";
import { ReloadMark } from "@/components/reload-logo";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

export function CurtainReveal({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: contentRef,
    offset: ["end end", "end start"],
  });
  /* Direct scroll progress — springs kept animating after scroll and janked the
     whole page, especially right after a hard refresh. */
  const progress = scrollYProgress;
  return (
    <div className="curtain-stage">
      <div ref={contentRef} className="curtain-content">
        {children}
      </div>
      <FooterPanel progress={progress} reduceMotion={reduceMotion} />
    </div>
  );
}

function FooterPanel({
  progress,
  reduceMotion,
}: {
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
}) {
  const router = useRouter();
  const { t, isArabic } = useLanguage();
  const wordmark = t("Reload", "ريلود");
  const footerColumns = [
    {
      title: t("Product", "المنتج"),
      links: [
        { label: t("Overview", "نظرة عامة"), href: "/#product" },
        { label: t("How it works", "كيف يعمل"), href: "/#how-it-works" },
        { label: t("Returns financing", "تمويل المرتجعات"), href: "/#returns-financing" },
        { label: t("Start a return", "بدء طلب إرجاع"), href: "/return" },
      ],
    },
    {
      title: t("Company", "الشركة"),
      links: [
        { label: t("About", "عن ريلود"), href: "/#product" },
        { label: t("Contact", "تواصل معنا"), href: "/#contact" },
        { label: t("Merchant sign in", "دخول التجار"), href: "/app" },
      ],
    },
    {
      title: t("Legal", "قانوني"),
      links: [
        { label: t("Privacy", "الخصوصية"), href: "/privacy" },
        { label: t("Terms", "الشروط"), href: "/terms" },
      ],
    },
  ];
  // Columns and the heart play their entrance once, when the footer is seen.
  const revealRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = revealRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setRevealed(true); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const taglineOpacity = useTransform(progress, [0.3, 0.55], [0, 1]);
  const taglineY = useTransform(progress, [0.3, 0.55], [18, 0]);
  const ctaOpacity = useTransform(progress, [0.4, 0.65], [0, 1]);
  const ctaY = useTransform(progress, [0.4, 0.65], [18, 0]);
  const linksOpacity = useTransform(progress, [0.5, 0.8], [0, 1]);
  const linksY = useTransform(progress, [0.5, 0.8], [20, 0]);
  const glowOpacity = useTransform(progress, [0.2, 0.8], [0, 1]);

  return (
    <footer className="footer-surface">
      <div className="footer-panel">
        <motion.div
          className="footer-glow"
          style={reduceMotion ? { opacity: 1 } : { opacity: glowOpacity }}
        />
        <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1200px] flex-col items-center justify-center px-5 py-12 text-center sm:px-8 sm:py-16">
          <div className="px-2 py-4" aria-label={wordmark}>
            {/* Latin splits per letter for the stagger, forced dir="ltr" because
                the spans sit in a flex row that RTL would reverse ("beejuM").
                Arabic is cursive — splitting it would break the letter joins —
                so it animates as one unit. */}
            {isArabic ? (
              <FooterLetter
                letter={wordmark}
                index={0}
                progress={progress}
                reduceMotion={reduceMotion}
                className="footer-wordmark block text-center font-display text-[clamp(4rem,14vw,10rem)] font-semibold leading-[1.15]"
              />
            ) : (
              <div
                dir="ltr"
                aria-hidden="true"
                className="footer-wordmark flex justify-center gap-[0.025em] font-display text-[clamp(4.5rem,16vw,12rem)] font-semibold leading-[1] tracking-[-0.035em]"
              >
                {wordmark.split("").map((letter, index) => (
                  <FooterLetter
                    key={index}
                    letter={letter}
                    index={index}
                    progress={progress}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </div>
            )}
          </div>

          <motion.p
            className="mt-4 text-sm tracking-wide text-footer-muted sm:text-base"
            style={
              reduceMotion
                ? undefined
                : { opacity: taglineOpacity, y: taglineY }
            }
          >
            {t("Returns, handled.", "المرتجعات علينا.")}
          </motion.p>

          <motion.div
            className="mt-8"
            style={reduceMotion ? undefined : { opacity: ctaOpacity, y: ctaY }}
          >
            <Button
              size="lg"
              onClick={() => router.push("/app")}
              className="group bg-footer-gold text-footer-gold-foreground hover:bg-footer-gold/90"
            >
              {t("Open the workspace", "فتح مساحة العمل")}
              <ArrowRight className={cn("size-4 transition-transform group-hover:translate-x-1", isArabic && "rotate-180")} />
            </Button>
          </motion.div>

          <motion.div
            className="mt-14 w-full max-w-[1080px] text-start sm:mt-24"
            style={
              reduceMotion ? undefined : { opacity: linksOpacity, y: linksY }
            }
          >
            <div ref={revealRef} className={cn("footer-grid", revealed && "is-in")}>
              <div className="footer-brand">
                <Link href="/" className="footer-logo inline-flex items-center gap-2.5 text-footer-fg" aria-label={wordmark}>
                  <span className="footer-logo-mark"><ReloadMark className="size-7" /></span>
                  <span className="font-display text-xl font-semibold tracking-[-0.02em]">{wordmark}</span>
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
                <nav key={column.title} aria-label={column.title} className="footer-column" style={{ ["--c" as string]: index + 1 }}>
                  <h3 className="footer-heading">{column.title}</h3>
                  <ul className="mt-4 space-y-1">
                    {column.links.map((link, index) => (
                      <li key={link.label} className="footer-item" style={{ ["--n" as string]: index }}>
                        <FooterLink {...link} start />
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>

            <div className={cn("footer-bottom", revealed && "is-in")}>
              {/* Arabic leads with the words and closes with the year so bidi
                  never has to reorder a trailing "©". */}
              <span>
                {t(
                  `© ${new Date().getFullYear()} Reload. All rights reserved.`,
                  `جميع الحقوق محفوظة لريلود © ${new Date().getFullYear()}`,
                )}
              </span>
              <span className="footer-made">
                <HeartMark />
                {t("Proudly built in Saudi Arabia", "صُنع بفخر في السعودية")}
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ label, href, start }: { label: string; href: string; start?: boolean }) {
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
      {start && <ArrowUpRight aria-hidden="true" className="footer-link-arrow size-3.5" />}
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
      <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="footer-email-link">
        <Mail className="size-4" />
        {CONTACT_EMAIL}
      </a>
      <button type="button" onClick={() => void copy()} className="footer-email-copy" aria-label={t("Copy email address", "نسخ البريد الإلكتروني")}>
        <span className={cn("footer-email-icon", copied && "is-hidden")}><Copy className="size-3.5" /></span>
        <span className={cn("footer-email-icon", !copied && "is-hidden")}><Check className="size-3.5" /></span>
      </button>
      <span role="status" aria-live="polite" className={cn("footer-email-toast", copied && "is-shown")}>{t("Copied", "تم النسخ")}</span>
    </div>
  );
}

/** A green heart, in place of a flag: Saudi green. It draws itself once as
 *  the footer comes into view, then beats once on hover. */
function HeartMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="footer-heart">
      <path pathLength={1} d="M12 20.5s-7.3-4.5-9.3-9C1.3 8.3 3.2 4.6 6.8 4.6c2.1 0 3.5 1.1 5.2 3.1 1.7-2 3.1-3.1 5.2-3.1 3.6 0 5.5 3.7 4.1 6.9-2 4.5-9.3 9-9.3 9z" />
    </svg>
  );
}

function FooterLetter({
  letter,
  index,
  progress,
  reduceMotion,
  className,
}: {
  letter: string;
  index: number;
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
  className?: string;
}) {
  // The curtain covers the wordmark until late in its travel. Keep the flip
  // in that visible interval instead of completing it behind the page.
  const start = 0.62 + index * 0.025;
  const end = start + 0.24;
  const y = useTransform(progress, [start, end], [22, 0]);
  const opacity = useTransform(progress, [start, end], [0.25, 1]);
  const rotateX = useTransform(progress, [start, end], [-75, 0]);
  return (
    <motion.span
      className={className ?? "inline-block"}
      style={reduceMotion ? undefined : { y, opacity, rotateX, transformPerspective: 700, transformOrigin: "50% 65%", backfaceVisibility: "hidden" }}
    >
      {letter}
    </motion.span>
  );
}
