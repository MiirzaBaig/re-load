"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import { ReloadMark } from "./reload-logo";

import {
  PhoneFrame,
  WhatsAppConversation,
  type ConversationStep,
} from "./phone-frame";
import { Tone } from "@/components/heading-accent";
import { useLanguage } from "./language-provider";

/**
 * The timeline figures behind the comparison.
 *
 * These are illustrative, not measured: they describe a typical manual returns
 * timeline versus the path Reload is built for. Swap in real pilot medians here
 * — one edit, both cards and the dot track follow — and drop `illustrative`
 * to false once the numbers come from actual merchant data.
 */
export const SPEED_BENCHMARK = {
  currentDays: 14,
  relodDays: 1.5,
  illustrative: true,
} as const;

/**
 * Where a manual return actually loses its days. Each stage is a queue someone
 * has to get to, which is the point: none of it is work, it is waiting.
 */
const MANUAL_STAGES = [
  {
    en: "Customer emails support",
    ar: "العميل يراسل خدمة العملاء",
    waitEn: "Day 1",
    waitAr: "اليوم 1",
  },
  {
    en: "Agent looks up the order",
    ar: "الموظف يبحث عن الطلب",
    waitEn: "Day 2-3",
    waitAr: "اليوم 2-3",
  },
  {
    en: "Someone reads the return policy",
    ar: "أحدهم يقرأ سياسة الإرجاع",
    waitEn: "Day 4-6",
    waitAr: "اليوم 4-6",
  },
  {
    en: "Back and forth on photos",
    ar: "مراسلات متبادلة حول الصور",
    waitEn: "Day 7-10",
    waitAr: "اليوم 7-10",
  },
  {
    en: "Decision reaches the customer",
    ar: "القرار يصل إلى العميل",
    waitEn: "Day 11-14",
    waitAr: "اليوم 11-14",
  },
] as const;

export function SpeedComparison() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });

  // Dots fill one by one so the manual path visibly *takes* time. The Reload
  // card resolves in a single beat next to it — the contrast plays out in
  // motion, not just in the two numbers.
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setFilled(MANUAL_STAGES.length);
      return;
    }
    const id = setInterval(() => {
      setFilled((n) => {
        if (n >= MANUAL_STAGES.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 420);
    return () => clearInterval(id);
  }, [inView, reduceMotion]);

  // Yazeed's script: the whole return, not just the eligibility answer.
  // Timestamps advance minute by minute so it reads as a live conversation.
  const steps = useMemo<ConversationStep[]>(() => [
    {
      id: "request",
      direction: "outgoing",
      time: "10:01",
      text: t("Return request", "طلب إرجاع"),
    },
    {
      id: "ask-photo",
      direction: "incoming",
      time: "10:02",
      text: t(
        "Please send a photo of the product.",
        "يرجى إرسال صورة للمنتج.",
      ),
    },
    { id: "photo", direction: "outgoing", time: "10:02", photo: true },
    {
      id: "reviewing",
      direction: "incoming",
      time: "10:03",
      text: t(
        "I’ll review the store’s policies.",
        "سأراجع سياسة المتجر.",
      ),
    },
    {
      id: "approved",
      direction: "incoming",
      time: "10:04",
      text: t(
        "The request is approved according to the store policies.",
        "تمت الموافقة على الطلب وفقًا لسياسات المتجر.",
      ),
    },
  ], [t]);

  // Illustrative product journey; this does not confirm a real transfer.
  const refundLabel = t("Refund completed", "تم استرداد المبلغ");

  const fadeUp = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.4 },
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <section className="speed-section" aria-labelledby="speed-heading">
      <div className="speed-inner">
        <motion.div {...fadeUp} className="speed-head">
          <h2 id="speed-heading" className="speed-title">
            {t("From return request ", "من طلب الإرجاع ")}
            <Tone>{t("to refund in the customer's hands.", "حتى وصول المبلغ إلى العميل.")}</Tone>
          </h2>
          <p className="speed-sub">
            {t(
              "Most of that time is waiting for someone to read the policy and reply.",
              "معظم هذا الوقت انتظار لقراءة السياسة والرد على العميل.",
            )}
          </p>
        </motion.div>

        <div className="speed-grid">
          {/* Manual path — muted surface, a counted track, no phone. Nobody
              answered, and that absence is the argument. */}
          <motion.article
            {...fadeUp}
            className="speed-card speed-card-current"
            aria-label={t("Current process", "الإجراء الحالي")}
          >
            <header className="speed-card-head">
              <span className="speed-icon" aria-hidden="true">
                <Clock className="size-6" />
              </span>
              <div>
                <p className="speed-eyebrow">
                  {t("Without Reload", "بدون ريلود")}
                </p>
                <h3 className="speed-card-title">
                  {t("Current process", "الإجراء الحالي")}
                </h3>
              </div>
            </header>

            <ol className="speed-stages" ref={ref}>
              {MANUAL_STAGES.map((stage, i) => (
                <li
                  key={stage.en}
                  className="speed-stage"
                  data-filled={reduceMotion || i < filled || undefined}
                >
                  <span className="speed-stage-marker" aria-hidden="true" />
                  <span className="speed-stage-label">
                    {t(stage.en, stage.ar)}
                  </span>
                  <span className="speed-stage-wait">
                    {t(stage.waitEn, stage.waitAr)}
                  </span>
                </li>
              ))}
            </ol>

            <p className="speed-figure speed-figure-muted">
              <span className="speed-figure-num">
                {SPEED_BENCHMARK.currentDays}
              </span>
              <span className="speed-figure-unit">{t("days", "يومًا")}</span>
            </p>
          </motion.article>

          {/* Reload path — the phone *is* the reason it collapses to a day and
              a half: the customer was answered in seconds. */}
          <motion.article
            {...fadeUp}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }
            }
            className="speed-card speed-card-relod"
            aria-label={t("With Reload", "مع ريلود")}
          >
            <header className="speed-card-head">
              <ReloadMark className="speed-brand-mark size-[3.25rem]" />
              <div>
                <p className="speed-eyebrow speed-eyebrow-accent">
                  {t("Automated", "آلي")}
                </p>
                <h3 className="speed-card-title">
                  {t("With ", "مع ")}
                  <span className="speed-brand-name">
                    {t("Reload", "ريلود")}
                  </span>
                </h3>
              </div>
            </header>

            <div className="speed-phone">
              {/* Depth behind the device: a soft brand-tinted bloom, so the
                  phone reads as sitting in space rather than pasted on. */}
              <span className="speed-phone-glow" aria-hidden="true" />
              <PhoneFrame scale="compact" className="speed-phone-device">
                <WhatsAppConversation
                  steps={steps}
                  refundLabel={refundLabel}
                  refundAmount={t("SAR 500", "٥٠٠ ر.س")}
                  caption={t("Illustrative journey", "رحلة توضيحية")}
                />
              </PhoneFrame>
            </div>

            <p className="speed-figure">
              <span className="speed-figure-ring">
                <span className="speed-figure-num">
                  {SPEED_BENCHMARK.relodDays}
                </span>
                <span className="speed-figure-unit">{t("days", "يوم")}</span>
                <PencilCircle />
              </span>
              <span className="speed-figure-delta">
                {t("~9x faster", "أسرع بـ 9 أضعاف")}
              </span>
            </p>
          </motion.article>
        </div>

        {SPEED_BENCHMARK.illustrative && (
          <p className="speed-note">
            {t(
              "Illustrative journey, including the refund confirmation. Photo review and instant refunds are preview features. Actual handling and payment timing depend on the store’s process; chat timestamps do not promise a fixed timeframe.",
              "رحلة توضيحية تشمل تأكيد الاسترداد. مراجعة الصور والاسترداد الفوري ميزتان ضمن المعاينة. تعتمد مدة المعالجة والدفع الفعلية على إجراءات المتجر، ولا تضمن أوقات الرسائل مدة محددة.",
            )}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Hand-drawn circle scribbled around the headline figure.
 *
 * Two overlapping ellipse paths rather than one, drawn with `stroke-dasharray`
 * so the pen travels: a single clean ellipse reads as a border, while the
 * doubled-back second pass is what makes it look drawn by hand.
 */
function PencilCircle() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const active = useInView(ref, { amount: 0.8, once: true });
  return (
    <svg
      ref={ref}
      className="speed-pencil"
      data-active={active || undefined}
      data-instant={reduceMotion || undefined}
      viewBox="0 0 240 110"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        className="speed-pencil-path"
        d="M218 32C196 13 155 8 114 9C56 10 12 27 11 54C10 81 57 101 119 101C177 101 227 82 229 56C230 43 220 31 203 24"
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        className="speed-pencil-path speed-pencil-path-2"
        d="M204 20C171 7 117 6 77 16C40 24 19 38 17 54"
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
