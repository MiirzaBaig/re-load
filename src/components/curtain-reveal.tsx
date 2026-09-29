"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
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
  const footerLinks = [
    { label: t("Product", "المنتج"), href: "/#product" },
    { label: t("How it works", "كيف يعمل"), href: "/#how-it-works" },
    { label: t("Workspace", "مساحة العمل"), href: "/app" },
    { label: t("Start a return", "بدء طلب إرجاع"), href: "/return" },
  ];
  const companyLinks = [
    { label: t("About", "عن ريلود"), href: "/#product" },
    { label: t("Contact", "تواصل معنا"), href: "mailto:mujebteem@gmail.com" },
  ];
  const legalLinks = [
    { label: t("Privacy", "الخصوصية"), href: "/privacy" },
    { label: t("Terms", "الشروط"), href: "/terms" },
  ];
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
            {t("Return decisions, explained.", "قرارات إرجاع مفسّرة.")}
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
            className="mt-10 w-full max-w-[1030px] text-start sm:mt-20"
            style={
              reduceMotion ? undefined : { opacity: linksOpacity, y: linksY }
            }
          >
            <nav
              aria-label={t("Footer product navigation", "روابط المنتج في التذييل")}
              className="flex flex-wrap items-center justify-center gap-x-7 gap-y-1 text-center text-sm text-footer-fg sm:gap-8"
            >
              {footerLinks.map((link) => (
                <FooterLink key={link.label} {...link} />
              ))}
            </nav>

            <div className="mt-7 flex flex-col-reverse items-center justify-between gap-4 border-t border-footer-subtle pt-6 text-xs text-footer-muted sm:mt-8 sm:flex-row sm:gap-5">
              {/* Arabic leads with the words and closes with the year so bidi
                  never has to reorder a trailing "©" or full stop. */}
              <span>
                {t(
                  `© ${new Date().getFullYear()} Reload. All rights reserved.`,
                  `جميع الحقوق محفوظة لريلود © ${new Date().getFullYear()}`,
                )}
              </span>
              <nav aria-label={t("Footer company navigation", "روابط الشركة في التذييل")} className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                {/* dir="ltr" keeps the address intact: bidi would otherwise
                    reorder the dots and @ inside an RTL line. */}
                <a
                  href="mailto:mujebteem@gmail.com"
                  dir="ltr"
                  className="footer-link"
                >
                  mujebteem@gmail.com
                </a>
                {companyLinks.map((link) => (
                  <FooterLink key={link.label} {...link} />
                ))}
                {legalLinks.map((link) => (
                  <FooterLink key={link.label} {...link} />
                ))}
              </nav>
            </div>
          </motion.div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ label, href }: { label: string; href: string }) {
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className="footer-link">
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className="footer-link">
      {label}
    </Link>
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
