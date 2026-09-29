"use client";

import {
  ArrowLeftRight,
  Clock3,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { ScrollReveal } from "@/components/scroll-reveal";
import { useLanguage } from "@/components/language-provider";
import { Mark, Tone } from "@/components/heading-accent";

/*
 * "Better for both sides of a return."
 *
 * Two cards, one light and one ink, bridged by a small ⇄ badge: the contrast
 * itself says "two sides". A soft spotlight follows the pointer across the
 * card it is on; it only updates two CSS variables, so it costs no layout.
 */
export function Benefits() {
  const { t } = useLanguage();

  const sides: {
    key: "customer" | "store";
    icon: LucideIcon;
    title: string;
    items: { icon: LucideIcon; title: string; body: string }[];
  }[] = [
    {
      key: "customer",
      icon: UserRound,
      title: t("For your customer", "لعميلك"),
      items: [
        {
          icon: RefreshCcw,
          title: t("Faster refunds", "استرداد أسرع"),
          body: t(
            "A clear answer in the chat they already use helps reduce hesitation at checkout.",
            "إجابة واضحة في المحادثة التي يستخدمها أصلًا تساعد على تقليل التردد عند الشراء.",
          ),
        },
        {
          icon: Sparkles,
          title: t("Better after-sales service", "خدمة ما بعد البيع أفضل"),
          body: t(
            "Quicker replies and a status they can see can help bring customers back to buy again.",
            "ردود أسرع وحالة واضحة يمكن أن تساعد على عودة العميل للشراء مرة أخرى.",
          ),
        },
      ],
    },
    {
      key: "store",
      icon: Store,
      title: t("For your store", "لمتجرك"),
      items: [
        {
          icon: Clock3,
          title: t("Less time for your team", "وقت أقل لفريقك"),
          body: t(
            "Fewer manual reviews and follow-ups. Only unclear cases reach a person.",
            "مراجعات يدوية ومتابعات أقل، ولا يصل إلى فريقك إلا ما يحتاج مراجعة.",
          ),
        },
        {
          icon: ShieldCheck,
          title: t("Clearer decisions", "قرارات أوضح"),
          body: t(
            "Every request follows the policy you approved, with the reason on record.",
            "كل طلب يتبع السياسة التي اعتمدتها، مع توثيق سبب القرار.",
          ),
        },
      ],
    },
  ];

  const track = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - box.top}px`);
  };

  return (
    <section aria-labelledby="benefits-title" className="benefits">
      <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="benefits-title"
              className="text-3xl font-semibold tracking-[-0.02em] text-balance md:text-[40px] md:leading-[1.1]"
            >
              {t("Better for ", "أفضل ")}
              <Mark>{t("both sides", "لطرفَي")}</Mark>
              <Tone>{t(" of a return.", " الإرجاع.")}</Tone>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
              {t(
                "A quicker answer for the person returning. Less work for the team handling it.",
                "إجابة أسرع لمن يُرجع المنتج، وعمل أقل للفريق الذي يتولاه.",
              )}
            </p>
          </div>
        </ScrollReveal>

        <div className="benefits-pair mt-12 md:mt-14">
          {sides.map((side, sideIndex) => (
            <ScrollReveal key={side.key} delay={sideIndex * 140} className="h-full">
              <article
                className="benefit-side"
                data-side={side.key}
                onPointerMove={track}
              >
                <span className="benefit-spotlight" aria-hidden="true" />
                <header className="benefit-side-head">
                  <span className="benefit-side-icon" aria-hidden="true">
                    <side.icon className="size-4" />
                  </span>
                  <h3 className="text-sm font-semibold">{side.title}</h3>
                </header>

                <ul className="benefit-rows">
                  {side.items.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="benefit-row">
                      <span className="benefit-row-icon" aria-hidden="true">
                        <Icon className="size-[18px]" />
                      </span>
                      <div className="min-w-0">
                        <p className="benefit-row-title">{title}</p>
                        <p className="benefit-row-body">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </ScrollReveal>
          ))}

          {/* The bridge between the two sides. */}
          <span className="benefits-bridge" aria-hidden="true">
            <ArrowLeftRight className="size-4" />
          </span>
        </div>
      </div>
    </section>
  );
}
