"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { PUBLIC_FAQS } from "@/lib/public-content";
import { publicPath } from "@/lib/public-site";
import { ScrollReveal } from "@/components/scroll-reveal";
import { useRef, type MouseEvent } from "react";
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
            <ScrollReveal key={index} delay={Math.min(index, 6) * 60} y={10}>
              <FaqItem question={item.q[isArabic ? 1 : 0]} answer={item.a[isArabic ? 1 : 0]} />
            </ScrollReveal>
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

/*
 * A native <details>, so every answer stays in the server HTML for search
 * engines, with a smooth height animation on open and close. Reduced motion
 * or a missing Web Animations API falls back to the instant native toggle.
 */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const running = useRef<Animation | null>(null);

  function toggle(event: MouseEvent) {
    const el = ref.current;
    const panel = body.current;
    if (!el || !panel || typeof panel.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    running.current?.cancel();
    const ease = "cubic-bezier(0.2, 0, 0, 1)";
    if (!el.open) {
      el.open = true;
      const h = panel.scrollHeight;
      running.current = panel.animate(
        [
          { height: "0px", opacity: 0, transform: "translateY(-4px)" },
          { height: `${h}px`, opacity: 1, transform: "none" },
        ],
        { duration: 320, easing: ease },
      );
    } else {
      const h = panel.offsetHeight;
      el.dataset.closing = "";
      const anim = panel.animate(
        [
          { height: `${h}px`, opacity: 1 },
          { height: "0px", opacity: 0 },
        ],
        { duration: 240, easing: ease },
      );
      running.current = anim;
      anim.onfinish = () => {
        el.open = false;
        delete el.dataset.closing;
      };
      anim.oncancel = () => delete el.dataset.closing;
    }
  }

  return (
    <details ref={ref} className="public-faq group py-1">
      <summary
        onClick={toggle}
        className="flex cursor-pointer list-none items-start justify-between gap-5 rounded-xl py-5 text-start font-medium transition-colors duration-200 hover:text-foreground/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        <span>{question}</span>
        <span aria-hidden="true" className="faq-icon mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border">
          <span className="faq-icon-bar" />
          <span className="faq-icon-bar faq-icon-bar-v" />
        </span>
      </summary>
      <div ref={body} className="public-faq-answer overflow-hidden">
        <p className="pb-5 text-sm leading-7 text-muted-foreground">{answer}</p>
      </div>
    </details>
  );
}
