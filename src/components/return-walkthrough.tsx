"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  Loader2,
  Mic,
  Plus,
  Smile,
  Phone,
  RotateCcw,
  Sparkles,
  Video,
  Smartphone,
  LayoutPanelLeft,
} from "lucide-react";

import {
  BRAND,
  PhoneFrame,
  TypingIndicator,
} from "@/components/phone-frame";
import { StoreMark } from "@/components/store-identity";
import { useLanguage } from "@/components/language-provider";
import { Tone } from "@/components/heading-accent";
import { cn } from "@/lib/utils";

/*
 * "What happens behind a return request?"
 *
 * One timeline drives both halves: the customer's WhatsApp chat on the left
 * and the merchant's workspace on the right. Every chat beat changes something
 * in the workspace, so a merchant sees their side of the same return — the
 * evidence collected, checked against their policy, decided, and actioned.
 *
 * It plays once when scrolled into view (Brand 3.0: resolve once, then remain
 * still). The stepper jumps to any stage; Replay runs it again.
 */

/** Final step index. Steps: 1 request · 2 ask · 3 order no. · 4 photo ·
 *  5 reviewing · 6 approved · 7 refund initiated. */
const LAST = 7;

/** Delay before each step lands, in ms. Incoming replies show a typing
 *  indicator for the second half of their delay. */
const STEP_DELAYS = [0, 700, 1500, 1300, 1300, 1700, 2000, 1500];
const INCOMING = new Set([2, 5, 6, 7]);

const STAGES = [
  { from: 1, to: 4, en: "Return request", ar: "طلب الإرجاع" },
  { from: 5, to: 5, en: "AI review", ar: "مراجعة ذكية" },
  { from: 6, to: 6, en: "Decision", ar: "القرار" },
  { from: 7, to: 7, en: "Refund", ar: "الاسترداد" },
];

export function ReturnWalkthrough() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  // Starts early: on a phone the section is taller than the screen, so waiting
  // for 35% of it meant visitors met an empty chat.
  const inView = useInView(sectionRef, { amount: 0.15, once: true });
  // Opens on the customer's first message, never a blank chat.
  const [step, setStep] = useState(1);
  const [typing, setTyping] = useState(false);
  // Mobile only: one side of the demo at a time instead of a long stack.
  const [view, setView] = useState<"customer" | "store">("customer");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const play = useCallback(() => {
    clearTimers();
    setStep(1);
    setTyping(false);
    let at = 300;
    for (let next = 2; next <= LAST; next++) {
      const delay = STEP_DELAYS[next];
      if (INCOMING.has(next)) {
        timers.current.push(setTimeout(() => setTyping(true), at + delay * 0.4));
      }
      at += delay;
      timers.current.push(
        setTimeout(() => {
          setTyping(false);
          setStep(next);
        }, at),
      );
    }
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setStep(LAST);
      return;
    }
    play();
    return clearTimers;
  }, [inView, reduceMotion, play]);

  const jumpTo = (target: number) => {
    clearTimers();
    setTyping(false);
    setStep(target);
  };

  const stageIndex = STAGES.findIndex((s) => step >= s.from && step <= s.to);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      aria-labelledby="walkthrough-title"
      className="walkthrough scroll-mt-20"
    >
      <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold text-foreground/70">
            {t("How it works", "كيف يشتغل")}
          </span>
          <h2
            id="walkthrough-title"
            className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-balance md:text-[40px] md:leading-[1.1]"
          >
            {t("What happens when ", "وش يصير لما ")}
            <Tone>{t("a customer asks?", "العميل يطلب إرجاع؟")}</Tone>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
            {t("Reload collects the order, the photo and the reason, checks your policy, and replies.", "ريلود يجمع الطلب والصورة والسبب، ويراجع سياستك، ويرد على العميل.")}
          </p>
        </div>

        {/* Stepper: shows where the return is, and jumps there on click. */}
        <div className="walkthrough-stepper mt-10" role="tablist" aria-label={t("Return stages", "مراحل الإرجاع")}>
          {STAGES.map((stage, index) => {
            const state =
              index < stageIndex || step === LAST && index <= stageIndex
                ? "done"
                : index === stageIndex
                  ? "active"
                  : "idle";
            return (
              <button
                key={stage.en}
                type="button"
                role="tab"
                aria-selected={index === stageIndex}
                data-state={state}
                className="walkthrough-stage"
                onClick={() => jumpTo(stage.to)}
              >
                <span className="walkthrough-stage-dot" aria-hidden="true">
                  <Check className="walkthrough-stage-check size-3" strokeWidth={3} />
                  <span className="walkthrough-stage-num">{index + 1}</span>
                </span>
                {t(stage.en, stage.ar)}
              </button>
            );
          })}
          <button
            type="button"
            className="walkthrough-replay"
            onClick={() => (reduceMotion ? jumpTo(LAST) : play())}
          >
            <RotateCcw className="size-3.5" />
            <span className="walkthrough-replay-label">{t("Replay", "إعادة")}</span>
          </button>
        </div>

        {/* Mobile: switch between the two sides. Hidden on desktop, where both
            sit side by side. */}
        <div className="walkthrough-switch mt-6" role="group" aria-label={t("Choose a side", "اختر الجهة")} data-view={view}>
          <span className="walkthrough-switch-pill" aria-hidden="true" />
          <button type="button" aria-pressed={view === "customer"} onClick={() => setView("customer")}>
            <Smartphone className="size-3.5" />
            <span>{t("Customer", "العميل")}</span>
          </button>
          <button type="button" aria-pressed={view === "store"} onClick={() => setView("store")}>
            <LayoutPanelLeft className="size-3.5" />
            <span>{t("Your store", "متجرك")}</span>
          </button>
        </div>

        <div className="walkthrough-grid mt-6" translate="no" data-view={view}>
          <div className="walkthrough-phone">
            <PhoneFrame scale="compact">
              <Chat step={step} typing={typing} t={t} />
            </PhoneFrame>
            <MiniSync step={step} t={t} onOpen={() => setView("store")} />
          </div>
          <Workspace step={step} t={t} />
        </div>
      </div>
    </section>
  );
}

type T = (en: string, ar: string) => string;

/** One source for the store side, shared by the full panel and the mobile
 *  sync strip so the two can never disagree. */
function deriveWorkspace(step: number, t: T) {
  const status =
    step === 0
      ? { label: t("Waiting", "بانتظار الطلبات"), tone: "idle" }
      : step <= 2
        ? { label: t("New", "جديد"), tone: "new" }
        : step <= 4
          ? { label: t("Collecting", "جمع البيانات"), tone: "new" }
          : step === 5
            ? { label: t("Reviewing", "قيد المراجعة"), tone: "busy" }
            : step === 6
              ? { label: t("Approved", "مقبول"), tone: "ok" }
              : { label: t("Refund initiated", "بدأ الاسترداد"), tone: "ok" };

  const checks = [
    { label: t("Order number", "رقم الطلب"), done: step >= 3, value: t("Verified", "تم التحقق") },
    { label: t("Product photo", "صورة المنتج"), done: step >= 4, value: t("Reviewed", "تمت المراجعة") },
    { label: t("Return reason", "سبب الإرجاع"), done: step >= 1, value: t("Wrong size", "مقاس غير مناسب") },
    {
      label: t("Store policy", "سياسة المتجر"),
      done: step >= 6,
      busy: step === 5,
      value: t("Matched · 14-day window", "مطابق · مهلة 14 يومًا"),
    },
  ];

  return { status, checks };
}

function Chat({
  step,
  typing,
  t,
}: {
  step: number;
  typing: boolean;
  t: T;
}) {
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [step, typing, reduceMotion]);

  const messages: {
    at: number;
    out: boolean;
    time: string;
    text?: string;
    photo?: boolean;
    tone?: "approved";
  }[] = [
    { at: 1, out: true, time: "10:01", text: t("I’d like to return these, the size doesn’t fit", "أبغى أرجّع هذا، المقاس ما ضبط") },
    { at: 2, out: false, time: "10:01", text: t("Sure, send your order number and a photo of the product.", "أكيد، أرسل رقم الطلب وصورة للمنتج.") },
    { at: 3, out: true, time: "10:02", text: t("Order #10248", "طلب رقم 10248#") },
    { at: 4, out: true, time: "10:02", photo: true },
    { at: 5, out: false, time: "10:03", text: t("Reviewing your request against the store’s policy…", "نراجع طلبك مقابل سياسة المتجر…") },
    { at: 6, out: false, time: "10:03", text: t("Return approved ✓", "تمت الموافقة على الإرجاع ✓"), tone: "approved" },
    {
      at: 7,
      out: false,
      time: "10:04",
      text: t(
        "Your SAR 749 refund has been initiated to your original payment method.",
        "بدأنا استرداد 749 ر.س إلى وسيلة الدفع الأصلية.",
      ),
    },
  ];

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 pb-3 pt-[2.65rem] text-white"
        style={{ background: BRAND.header }}
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        <StoreMark size="lg" className="ring-1 ring-white/25" />
        <div className="flex-1">
          <div className="text-sm font-semibold">Nova Store</div>
          <div className="text-[10px] text-white/75">
            {typing ? t("typing…", "يكتب…") : t("online", "متصل")}
          </div>
        </div>
        <Video className="size-4" aria-hidden="true" />
        <Phone className="ms-2 size-3.5" aria-hidden="true" />
      </div>

      <div
        ref={scrollRef}
        className="phone-chat phone-chat-scroll relative flex h-[440px] flex-col gap-2 md:h-[560px] overflow-y-auto px-3 py-4 text-[13px] leading-relaxed"
        aria-live="polite"
      >
        <span className="mx-auto shrink-0 rounded-md bg-white/75 px-3 py-0.5 text-[10px] text-[#65756d]">
          {t("Today", "اليوم")}
        </span>
        {messages.map((m) =>
          step >= m.at ? (
            <motion.div
              key={m.at}
              initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
              className={cn(
                "phone-bubble relative shrink-0 rounded-xl shadow-sm",
                m.photo ? "w-[64%] p-1" : "max-w-[84%] px-3 py-2",
                m.out ? "ms-auto rounded-se-none" : "me-auto rounded-ss-none",
              )}
              data-direction={m.out ? "outgoing" : "incoming"}
            >
              {m.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/demo/sneaker-photo.jpg"
                  alt={t("Customer’s photo of the sneakers", "صورة العميل للحذاء")}
                  width={560}
                  height={480}
                  className="block aspect-[7/6] w-full rounded-lg object-cover"
                />
              ) : (
                <p className={cn(m.tone === "approved" && "font-semibold")}>{m.text}</p>
              )}
              <span
                className={cn(
                  "mt-0.5 flex items-center justify-end gap-1 text-[9px] text-[#65756d]",
                  m.photo && "px-1 pb-0.5",
                )}
                dir="ltr"
              >
                {m.time}
                {m.out && <Check className="size-3 text-[#34aadc]" aria-hidden="true" />}
              </span>
            </motion.div>
          ) : null,
        )}
        <AnimatePresence>
          {typing && (
            <motion.div
              key="typing"
              className="shrink-0"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.14 } }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            >
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Message bar: without it the screen reads as a cropped chat, not a phone. */}
      <div
        className="phone-composer flex items-center gap-2 border-t border-[#dde4df]/80 bg-[#f7f8fa] px-3 py-2 text-[#72827a]"
        aria-hidden="true"
      >
        <Plus className="size-5" />
        <div className="flex h-8 min-w-0 flex-1 items-center justify-between rounded-full border border-[#dde4df] bg-white px-3 text-[11px]">
          <span>{t("Message", "رسالة")}</span>
          <Smile className="size-4" />
        </div>
        <Mic className="size-4" />
      </div>
    </div>
  );
}

function Workspace({ step, t }: { step: number; t: T }) {
  const { status, checks } = deriveWorkspace(step, t);

  const ai = step >= 6 ? "done" : step === 5 ? "busy" : "idle";

  return (
    <div
      className="ws-panel"
      data-empty={step === 0 || undefined}
      data-live={(step > 0 && step < LAST) || undefined}
    >
      <header className="ws-head">
        <div>
          <p className="ws-eyebrow">
            <span className="ws-live-dot" aria-hidden="true" />
            {t("Returns workspace", "مساحة المرتجعات")}
          </p>
          <p className="text-sm font-semibold">Nova Store</p>
        </div>
        {/* Structure never changes between states — the spinner is always
            mounted and the label always has its own element — so React only
            ever updates text or attributes here. Inserting the spinner next
            to a bare text node crashed when Chrome Translate had rewritten
            that node ("Failed to execute 'insertBefore' on 'Node'"). */}
        <span className="ws-status" data-tone={status.tone}>
          <Loader2 className="ws-status-spinner size-3 animate-spin" aria-hidden="true" />
          <span>{status.label}</span>
        </span>
      </header>

      {/* Order card */}
      <div className="ws-order" data-shown={step >= 1 || undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo/sneaker-pair.jpg"
          alt=""
          width={560}
          height={282}
          className="ws-order-thumb"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{t("Knit runner", "حذاء رياضي منسوج")}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {step >= 3 ? "#10248" : "#…"} · {t("Size 42", "مقاس 42")}
          </p>
        </div>
        <p className="text-[13px] font-semibold tabular-nums" dir="ltr">
          {t("SAR 749", "749 ر.س")}
        </p>
      </div>

      <div className="ws-body">
        {/* Evidence */}
        <div className="ws-evidence">
          <p className="ws-label">{t("Customer’s photo", "صورة العميل")}</p>
          <div className="ws-evidence-frame" data-shown={step >= 4 || undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/demo/sneaker-photo.jpg" alt="" width={560} height={480} />
            <span className="ws-evidence-empty">{t("Waiting for photo", "بانتظار الصورة")}</span>
            <span className="ws-evidence-badge">
              <Check className="size-3" strokeWidth={3} />
              {t("Reviewed", "تمت المراجعة")}
            </span>
          </div>
        </div>

        {/* Checks */}
        <ul className="ws-checks">
          {checks.map((c) => (
            <li key={c.label} data-done={c.done || undefined} data-busy={c.busy || undefined}>
              <span className="ws-check-mark" aria-hidden="true">
                {c.busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="flex-1">{c.label}</span>
              <span className="ws-check-value">
                {c.done ? c.value : c.busy ? t("Checking…", "جارٍ التحقق…") : t("Pending", "بالانتظار")}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* AI review */}
      <div className="ws-ai" data-state={ai}>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <Sparkles className="size-3.5" />
            {t("AI review", "المراجعة الذكية")}
          </p>
          <span className="text-xs text-muted-foreground">
            {ai === "done" ? t("Complete", "مكتملة") : ai === "busy" ? t("Reviewing…", "قيد المراجعة…") : t("Waiting", "بالانتظار")}
          </span>
        </div>
        <div className="ws-ai-track" aria-hidden="true">
          <span className="ws-ai-fill" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t(
            "Checks the evidence against the return policy your store approved.",
            "يطابق الأدلة مع سياسة الإرجاع التي اعتمدها متجرك.",
          )}
        </p>
      </div>

      {/* Decision + next step */}
      <div className="ws-foot">
        <div>
          <p className="ws-label">{t("Decision", "القرار")}</p>
          <div className="ws-decisions">
            {[
              { key: "approved", label: t("Approved", "مقبول") },
              { key: "review", label: t("Needs review", "يحتاج مراجعة") },
              { key: "rejected", label: t("Rejected", "مرفوض") },
            ].map((d) => (
              <span
                key={d.key}
                className="ws-decision"
                data-kind={d.key}
                data-picked={(step >= 6 && d.key === "approved") || undefined}
                data-dimmed={(step >= 6 && d.key !== "approved") || undefined}
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
        <div className="ws-next" data-shown={step >= 6 || undefined}>
          <p className="ws-label">{t("Next step", "الخطوة التالية")}</p>
          <p className="text-[13px] font-semibold">
            <span className="ws-next-value" data-done={step >= 7 || undefined}>
              <Check className="ws-next-check size-3.5" strokeWidth={3} aria-hidden="true" />
              <span>
                {step >= 7
                  ? t("Refund initiated", "بدأ الاسترداد")
                  : step >= 6
                    ? t("Initiate refund", "بدء الاسترداد")
                    : t("Pending", "بالانتظار")}
              </span>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Mobile: a slim live strip under the phone, so the store side is still
 *  visibly moving in sync with the chat. Tapping it opens the full panel. */
function MiniSync({ step, t, onOpen }: { step: number; t: T; onOpen: () => void }) {
  const { status, checks } = deriveWorkspace(step, t);
  const done = checks.filter((c) => c.done).length;
  return (
    <button type="button" className="ws-mini" onClick={onOpen} data-live={(step > 0 && step < LAST) || undefined}>
      <span className="ws-mini-row">
        <span className="ws-live-dot" aria-hidden="true" />
        <span className="ws-mini-title">{t("Your store", "متجرك")}</span>
        <span className="ws-status" data-tone={status.tone}>
          <Loader2 className="ws-status-spinner size-3 animate-spin" aria-hidden="true" />
          <span>{status.label}</span>
        </span>
      </span>
      <span className="ws-mini-row">
        <span className="ws-mini-dots" aria-label={t(`${done} of 4 checks done`, `${done} من 4 تحققات`)}>
          {checks.map((c) => (
            <span key={c.label} data-done={c.done || undefined} data-busy={c.busy || undefined} />
          ))}
        </span>
        <span className="ws-mini-open">
          <span>{t("See your side", "شاهد جهتك")}</span>
          <ChevronLeft className="size-3.5 rotate-180 rtl:rotate-0" />
        </span>
      </span>
    </button>
  );
}
