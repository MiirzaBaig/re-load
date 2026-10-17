"use client";
import Link from "next/link";
import { useCallback, useRef, type MouseEvent } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { PUBLIC_FAQS } from "@/lib/public-content";
import { publicPath } from "@/lib/public-site";
import { ScrollReveal } from "@/components/scroll-reveal";
import { WhatsAppLogo } from "@/components/phone-frame";
import { getWhatsAppPublicUrl } from "@/lib/whatsapp";

const EASE = "cubic-bezier(0.2, 0, 0, 1)";

type ItemHandle = { el: HTMLDetailsElement; close: () => void };

export function PublicFaq({ full = false }: { full?: boolean }) {
  const { t, isArabic, locale } = useLanguage();
  const items = full ? PUBLIC_FAQS : PUBLIC_FAQS.slice(0, 5);
  // One question open at a time: opening one gently closes the others.
  const handles = useRef(new Map<number, ItemHandle>());
  const register = useCallback((index: number, handle: ItemHandle | null) => {
    if (handle) handles.current.set(index, handle);
    else handles.current.delete(index);
  }, []);
  const closeOthers = useCallback((index: number) => {
    handles.current.forEach((h, i) => {
      if (i !== index && h.el.open) h.close();
    });
  }, []);

  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:py-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:gap-16">
        <ScrollReveal className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("Before you get started", "قبل أن تبدأ")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {t("Clear answers. No surprises.", "إجابات واضحة. من البداية.")}
          </h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            {t(
              "The details that help you choose what works for your store.",
              "التفاصيل التي تساعدك على اختيار ما يناسب متجرك.",
            )}
          </p>
          <div className="mt-8 hidden border-t pt-6 lg:block">
            <p className="text-sm font-medium">{t("Still have a question?", "لديك سؤال آخر؟")}</p>
            <a
              href={getWhatsAppPublicUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <WhatsAppLogo className="size-4" />
              {t("Ask us on WhatsApp", "اسألنا على واتساب")}
              <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
            </a>
          </div>
        </ScrollReveal>

        <div>
          <div className="border-t">
            {items.map((item, index) => (
              <ScrollReveal key={index} delay={Math.min(index, 6) * 70} y={12}>
                <FaqItem
                  index={index}
                  question={item.q[isArabic ? 1 : 0]}
                  answer={item.a[isArabic ? 1 : 0]}
                  register={register}
                  onOpen={closeOthers}
                />
              </ScrollReveal>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            {!full && (
              <Link
                href={publicPath(locale, "faq")}
                className="group inline-flex items-center gap-1.5 rounded-lg py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="underline decoration-foreground/30 underline-offset-4 transition-colors group-hover:decoration-foreground">
                  {t("See all questions", "عرض جميع الأسئلة")}
                </span>
                <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 rtl:-scale-x-100" />
              </Link>
            )}
            <a
              href={getWhatsAppPublicUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <WhatsAppLogo className="size-4" />
              {t("Still have a question? Ask us", "لديك سؤال آخر؟ اسألنا")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * A native <details>, so every answer stays in the server HTML for search
 * engines, with a smooth height animation on open and close. Reduced motion
 * or a missing Web Animations API falls back to the instant native toggle.
 */
function FaqItem({
  index,
  question,
  answer,
  register,
  onOpen,
}: {
  index: number;
  question: string;
  answer: string;
  register: (index: number, handle: ItemHandle | null) => void;
  onOpen: (index: number) => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  const running = useRef<Animation | null>(null);

  const canAnimate = () =>
    typeof window !== "undefined" &&
    typeof body.current?.animate === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const close = useCallback((el: HTMLDetailsElement) => {
    const panel = body.current;
    if (!el.open || !panel) return;
    running.current?.cancel();
    if (!canAnimate()) {
      el.open = false;
      return;
    }
    el.dataset.closing = "";
    const anim = panel.animate(
      [
        { height: `${panel.offsetHeight}px`, opacity: 1 },
        { height: "0px", opacity: 0 },
      ],
      { duration: 280, easing: EASE },
    );
    running.current = anim;
    anim.onfinish = () => {
      el.open = false;
      delete el.dataset.closing;
    };
    anim.oncancel = () => delete el.dataset.closing;
  }, []);

  const open = (el: HTMLDetailsElement) => {
    const panel = body.current;
    if (!panel) return;
    running.current?.cancel();
    delete el.dataset.closing;
    el.open = true;
    onOpen(index);
    if (!canAnimate()) return;
    running.current = panel.animate(
      [
        { height: "0px", opacity: 0, filter: "blur(2px)", transform: "translateY(-6px)" },
        { height: `${panel.scrollHeight}px`, opacity: 1, filter: "blur(0)", transform: "none" },
      ],
      { duration: 380, easing: EASE },
    );
  };

  const setRef = useCallback(
    (el: HTMLDetailsElement | null) => {
      register(index, el ? { el, close: () => close(el) } : null);
    },
    [close, index, register],
  );

  function toggle(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    const el = event.currentTarget.parentElement as HTMLDetailsElement;
    if (el.open && el.dataset.closing === undefined) close(el);
    else open(el);
  }

  return (
    <details ref={setRef} className="public-faq group border-b">
      <summary
        onClick={toggle}
        className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        <span className="faq-q min-w-0 text-[15px] font-medium leading-6 sm:text-base">{question}</span>
        <span aria-hidden="true" className="faq-icon grid size-8 shrink-0 place-items-center rounded-full">
          <ChevronDown className="faq-chevron size-[18px]" strokeWidth={1.75} />
        </span>
      </summary>
      <div ref={body} className="public-faq-answer overflow-hidden">
        <p className="max-w-[62ch] pb-6 pe-12 text-[15px] leading-7 text-muted-foreground">{answer}</p>
      </div>
    </details>
  );
}
