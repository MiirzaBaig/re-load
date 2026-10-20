"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock3,
  Languages,
  ListChecks,
  Loader2,
  MessageCircleReply,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Tone } from "@/components/heading-accent";
import { PhoneFrame, TypingIndicator, BRAND, WhatsAppLogo } from "@/components/phone-frame";
import { ReloadMark } from "@/components/reload-logo";
import { RiyalSign } from "@/components/riyal-sign";
import { getWhatsAppPublicUrl } from "@/lib/whatsapp";
import { useSsrReducedMotion } from "@/hooks/use-ssr-reduced-motion";
import { cn } from "@/lib/utils";

const EASE = [0.2, 0, 0, 1] as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. Conversation demo (from v201 "مو مجرد رد آلي"), in our phone style.
 *    Five situations play one after another (progress bar on each tab). On
 *    "Needs your review" the merchant buttons are live: the chat answers.
 *    Illustrative data only.
 * ────────────────────────────────────────────────────────────────────────── */

type Who = "c" | "r" | "s";
type Msg = { who: Who; text: string; kind?: "products" | "pay" | "photo" | "order" };
type Mood = "ok" | "wait" | "no" | "info";
type Scenario = {
  key: string;
  label: string;
  outcome: string;
  tone: Mood;
  panel: string;
  rows: [string, string][];
  msgs: Msg[];
  extra?: string;
  review?: boolean;
};

const PILL: Record<Mood, string> = {
  ok: "bg-eligible/12 text-eligible",
  wait: "bg-review/14 text-review",
  no: "bg-foreground/[0.07] text-muted-foreground",
  info: "bg-foreground text-background",
};

export function ConversationDemo() {
  const { t } = useLanguage();
  const reduce = useSsrReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.12 });

  const scenarios: Scenario[] = [
    {
      key: "product",
      label: t("Product question", "سؤال عن منتج"),
      outcome: t("Answered", "تم الرد"),
      tone: "info",
      panel: t("Merchant dashboard · Conversations", "لوحة التاجر · المحادثات"),
      rows: [
        [t("Conversation", "نوع المحادثة"), t("Product question", "سؤال عن منتج")],
        [t("Answer source", "مصدر الإجابة"), t("Approved product data", "بيانات المنتج المعتمدة")],
        [t("Handled by", "تم بواسطة"), t("Reload", "ريلود")],
      ],
      msgs: [
        { who: "c", text: t("Hi, do you have the running shoes in size 42?", "السلام عليكم، عندكم الحذاء الرياضي مقاس 42؟") },
        { who: "r", text: t("Hi! Yes, size 42 is in stock in black for SAR 289. Want me to check another color?", "وعليكم السلام! إيه، مقاس 42 متوفر باللون الأسود، وسعره 289 ريال. تبي أشيّك لك على لون ثاني؟") },
      ],
    },
    {
      key: "buy",
      label: t("Wants to buy", "يبي يشتري"),
      outcome: t("Payment link sent", "تم إرسال رابط الدفع"),
      tone: "info",
      panel: t("Merchant dashboard · Conversations", "لوحة التاجر · المحادثات"),
      rows: [
        [t("Conversation", "نوع المحادثة"), t("Purchase", "طلب شراء")],
        [t("Product", "المنتج"), t("Running shoes · 42", "الحذاء الرياضي · 42")],
        [t("Amount", "المبلغ"), "289"],
        [t("Handled by", "تم بواسطة"), t("Reload", "ريلود")],
      ],
      extra: t("Payment link · Premium, soon", "رابط الدفع · بريميوم، قريبًا"),
      msgs: [
        { who: "c", text: t("I want white running shoes for walking, size 42", "أبي جزمة رياضية بيضاء للمشي، مقاس 42") },
        { who: "r", text: t("Two options that suit you 👟", "عندنا خيارين يناسبونك 👟"), kind: "products" },
        { who: "c", text: t("I’ll take the first one, size 42", "أبي الأولى، مقاس 42") },
        { who: "r", text: t("Done: running shoes · size 42 · SAR 289. Here’s the store’s secure payment link:", "تمام، طلبك: الحذاء الرياضي · مقاس 42 · 289 ريال. هذا رابط الدفع الآمن من المتجر:"), kind: "pay" },
      ],
    },
    {
      key: "accepted",
      label: t("Return accepted", "إرجاع مقبول"),
      outcome: t("Accepted automatically", "مقبول تلقائيًا"),
      tone: "ok",
      panel: t("Merchant dashboard · Returns", "لوحة التاجر · طلبات الإرجاع"),
      rows: [
        [t("Order", "رقم الطلب"), "#10482"],
        [t("Reason", "سبب الإرجاع"), t("Size doesn’t fit", "المقاس غير مناسب")],
        [t("Return label", "بوليصة الإرجاع"), t("Merchant arranges shipping", "التاجر يرتّب الشحن")],
        [t("Status", "الحالة"), t("Open", "مفتوحة")],
      ],
      msgs: [
        { who: "c", text: t("I want to return the shoes, the size doesn’t fit", "أبي أرجّع الحذاء، المقاس ما ناسبني") },
        { who: "r", text: t("Send your order number as shown in your order confirmation and we’ll check it.", "أرسل رقم الطلب مثل ما هو ظاهر في تأكيد الطلب، ونتحقق منه.") },
        { who: "c", text: "#10482", kind: "order" },
        { who: "r", text: t("Verified ✓ Your order is within the return window and unused, so your return is accepted under the store policy. The store will confirm the return arrangements.", "تم التحقق ✓ طلبك ضمن مدة الإرجاع والمنتج غير مستخدم، فتم قبول الإرجاع حسب سياسة المتجر. والمتجر بيؤكّد ترتيبات الإرجاع.") },
      ],
    },
    {
      key: "review",
      label: t("Needs your review", "يحتاج مراجعتك"),
      outcome: t("Waiting for you", "بانتظار قرارك"),
      tone: "wait",
      panel: t("Merchant dashboard · Returns", "لوحة التاجر · طلبات الإرجاع"),
      rows: [
        [t("Order", "رقم الطلب"), "#10519"],
        [t("Reason", "سبب الإرجاع"), t("Item is damaged", "المنتج فيه عيب")],
        [t("Status", "الحالة"), t("Needs review", "تحتاج مراجعة")],
      ],
      review: true,
      msgs: [
        { who: "c", text: t("The shoes arrived damaged", "وصلني الحذاء وفيه عيب") },
        { who: "r", text: t("Sorry about that. Send a photo of the damage so the store team can review it.", "آسفين على هذا. أرسل صورة توضح العيب عشان يراجعها فريق المتجر.") },
        { who: "c", text: t("Photo of the damage", "صورة العيب"), kind: "photo" },
        { who: "r", text: t("Photo received. We’ve passed your request to the store team, they’ll reply here.", "وصلت الصورة، وحوّلنا طلبك لفريق المتجر يراجعه ويرد عليك هنا.") },
      ],
    },
    {
      key: "outside",
      label: t("Outside return window", "خارج مدة الإرجاع"),
      outcome: t("Not eligible", "غير مؤهل"),
      tone: "no",
      panel: t("Merchant dashboard · Returns", "لوحة التاجر · طلبات الإرجاع"),
      rows: [
        [t("Order", "رقم الطلب"), "#10377"],
        [t("Reason", "سبب الإرجاع"), t("Size doesn’t fit", "المقاس غير مناسب")],
        [t("Status", "الحالة"), t("Closed", "مغلقة")],
      ],
      msgs: [
        { who: "c", text: t("I want to return the sandals", "أبي أرجّع الصندل") },
        { who: "r", text: t("Send your order number as shown in your order confirmation and we’ll check it.", "أرسل رقم الطلب مثل ما هو ظاهر في تأكيد الطلب، ونتحقق منه.") },
        { who: "c", text: "#10377", kind: "order" },
        { who: "r", text: t("You received this order 15 days ago, outside the store’s 7-day return window, so we can’t accept it. If you think that’s wrong, choose “Contact the store”.", "طلبك تسلّمته قبل 15 يوم، وهو خارج مدة الإرجاع في سياسة المتجر (7 أيام)، فما نقدر نقبله. إذا تشوف إن فيه خطأ، اختر «التواصل مع المتجر».") },
      ],
    },
  ];

  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0); // messages visible
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const [decision, setDecision] = useState<null | "accept" | "reject" | "takeover">(null);
  const [run, setRun] = useState(0);
  const s = scenarios[active];

  // Play the conversation: customer messages after a beat, Reload after typing.
  // Plays when the demo is on screen; scrolling away keeps the finished chat.
  const played = useRef("");
  useEffect(() => {
    const key = `${active}-${run}`;
    if (reduce) {
      setShown(s.msgs.length);
      setDone(true);
      setDecision(null);
      return;
    }
    if (!inView || played.current === key) return;
    played.current = key;
    setShown(0);
    setTyping(false);
    setDone(false);
    setDecision(null);
    const timers: number[] = [];
    let at = 350;
    s.msgs.forEach((m, n) => {
      if (m.who === "r") {
        timers.push(window.setTimeout(() => setTyping(true), at));
        at += 950;
      } else at += 650;
      timers.push(window.setTimeout(() => { setTyping(false); setShown(n + 1); }, at));
      at += 250;
    });
    let finished = false;
    timers.push(window.setTimeout(() => { finished = true; setDone(true); }, at + 150));
    return () => {
      timers.forEach(clearTimeout);
      // Interrupted halfway (scrolled away): replay from the start next time.
      if (!finished) played.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, run, inView, reduce]);

  // Auto-advance to the next situation (paused on hover, pause button or a decision).
  const HOLD = 4200;
  // Owner (2026-10-20): always autoplay; only the Pause button stops it.
  // Previous: const autoplay = !paused && !hover && !decision && !reduce && inView;
  const autoplay = !paused && !reduce && inView;
  useEffect(() => {
    if (!done || !autoplay) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % scenarios.length), HOLD);
    return () => clearTimeout(id);
  }, [done, autoplay, scenarios.length, decision]);

  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelectorAll<HTMLElement>("[role=tab]")[active];
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    const target = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    row.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" });
  }, [active, reduce]);

  const pick = useCallback((n: number) => {
    setActive(n);
    setRun((r) => r + 1);
  }, []);

  const outcome =
    decision === "accept" ? { text: t("Accepted by you", "قبلته أنت"), tone: "ok" as Mood }
    : decision === "reject" ? { text: t("Declined by you", "رفضته أنت"), tone: "no" as Mood }
    : decision === "takeover" ? { text: t("You’re in the chat", "أنت في المحادثة"), tone: "info" as Mood }
    : { text: s.outcome, tone: s.tone };

  const followUp: Msg | null =
    decision === "accept" ? { who: "r", text: t("Good news: the store reviewed your photo and accepted your return ✓ The store will confirm the next steps.", "أبشرك: راجع المتجر الصورة وقبل الإرجاع ✓ والمتجر بيؤكّد الخطوات التالية.") }
    : decision === "reject" ? { who: "r", text: t("The store reviewed your photo and couldn’t accept this return. The team will contact you with the details.", "راجع المتجر الصورة وما قدر يقبل الإرجاع هالمرة، وبيتواصل معك الفريق بالتفاصيل.") }
    : decision === "takeover" ? { who: "s", text: t("The store team joined the conversation", "انضم فريق المتجر للمحادثة") }
    : null;

  const msgs = [...s.msgs.slice(0, shown), ...(followUp ? [followUp] : [])];

  return (
    <section id="demo" className="scroll-mt-24" aria-labelledby="demo-title">
      <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("More than an auto-reply", "مو مجرد رد آلي")}</p>
            <h2 id="demo-title" className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-balance md:text-[42px] md:leading-[1.15]">
              {t("Reload doesn’t just reply. ", "ريلود ما يكتفي بالرد، ")}
              <Tone>{t("It settles the request.", "يحسم الطلب.")}</Tone>
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {/* Previous EN: "Pick a situation and see what your customer gets on WhatsApp, and what you see in your dashboard." */}
              {t("Pick a scenario and see what your customer gets on WhatsApp and what shows up in your merchant dashboard.", "اختر موقف، وشوف وش يوصل للعميل في واتساب ووش يظهر لك في لوحة التاجر.")}
            </p>
          </div>
        </ScrollReveal>

        <div ref={root}>
          <ScrollReveal delay={60}>
            <div ref={tabsRef} role="tablist" aria-label={t("Situations", "المواقف")} className="demo-tabs mx-auto mt-10">
              {scenarios.map((sc, n) => (
                <button
                  key={sc.key}
                  type="button"
                  role="tab"
                  aria-selected={active === n}
                  onClick={() => pick(n)}
                  className={cn("demo-tab", active === n && "demo-tab-on")}
                >
                  {active === n && <motion.span layoutId="demo-pill" className="demo-tab-pill" transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE }} />}
                  <span className={cn("relative size-1.5 rounded-full", sc.tone === "ok" ? "bg-eligible" : sc.tone === "wait" ? "bg-review" : sc.tone === "no" ? "bg-muted-foreground/60" : "bg-foreground")} />
                  <span className="relative">{sc.label}</span>
                  {active === n && !reduce && (
                    <span className="demo-tab-progress" aria-hidden="true">
                      <span key={`${active}-${run}-${done}`} className={cn(done && autoplay && "demo-tab-progress-run")} style={{ animationDuration: `${HOLD}ms` }} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </ScrollReveal>

          <div className="demo-stage mt-10">
            {/* Phone */}
            <div className="flex justify-center">
              <div className="w-[320px] max-w-full">
                <PhoneFrame scale="compact">
                  <div className="flex items-center gap-2 px-3 pb-3 pt-[2.65rem] text-white" style={{ background: BRAND.header }}>
                    <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                    <span className="grid size-8 place-items-center rounded-full bg-white text-[#0f0f12] ring-1 ring-white/25"><ReloadMark className="size-4" /></span>
                    <div className="flex-1 text-start">
                      <div className="text-sm font-semibold">{t("Reload | ريلود", "ريلود | Reload")}</div>
                      <div className="text-[10px] text-white/75">
                        {typing ? t("typing…", "يكتب…") : t("Replies for the store", "يرد نيابةً عن المتجر")}
                      </div>
                    </div>
                  </div>
                  <div className="phone-chat relative flex h-[380px] flex-col justify-end gap-2 overflow-hidden px-3 py-3 text-[13px] leading-relaxed" aria-live="polite">
                    <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`${s.key}-${run}`}
                      className="flex flex-col justify-end gap-2"
                      initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(3px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduce ? undefined : { opacity: 0, y: -10, filter: "blur(3px)" }}
                      transition={{ duration: 0.32, ease: EASE }}
                    >
                    <AnimatePresence initial={false} mode="popLayout">
                      {msgs.map((m, n) => (
                        <DemoBubble key={`${s.key}-${run}-${n}-${m.text.slice(0, 8)}`} m={m} reduce={reduce} />
                      ))}
                      {typing && (
                        <motion.div key="typing" layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          <TypingIndicator />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    </motion.div>
                    </AnimatePresence>
                  </div>
                  <div className="phone-composer flex items-center gap-2 border-t border-[#dde4df]/80 bg-[#f7f8fa] px-3 py-2 text-[#72827a]" aria-hidden="true">
                    <div className="flex h-8 flex-1 items-center rounded-full border border-[#dde4df] bg-white px-3 text-[11px]">{t("Message", "اكتب رسالة…")}</div>
                  </div>
                </PhoneFrame>
              </div>
            </div>

            {/* Merchant panel */}
            <div className="demo-panel">
              <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                <span className="text-sm font-semibold">{s.panel}</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="demo-live-dot" />
                  {t("Live", "مباشر")}
                </span>
              </div>
              <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={s.key}
                className="px-5 py-5"
                initial={reduce ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -10 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <p className="text-xs text-muted-foreground">{t("Outcome", "النتيجة")}</p>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={`${s.key}-${outcome.text}-${done}`}
                    initial={reduce ? false : { opacity: 0, scale: 0.9, y: 4 }}
                    animate={{ opacity: done || decision ? 1 : 0.35, scale: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", done || decision ? PILL[outcome.tone] : "bg-foreground/[0.06] text-muted-foreground")}
                  >
                    {done || decision ? outcome.text : t("In progress…", "جارٍ…")}
                  </motion.span>
                </AnimatePresence>

                <dl className="mt-5 divide-y">
                  {s.rows.map(([k, v], n) => (
                    <motion.div
                      key={`${s.key}-${k}`}
                      initial={reduce ? false : { opacity: 0, x: 8 }}
                      animate={{ opacity: done ? 1 : 0.25, x: 0 }}
                      transition={{ duration: 0.35, delay: done && !reduce ? n * 0.09 : 0, ease: EASE }}
                      className="flex items-center justify-between gap-4 py-2.5 text-sm"
                    >
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">
                        {s.key === "buy" && k === t("Amount", "المبلغ") ? (
                          <span className="inline-flex items-center gap-1" dir="ltr"><RiyalSign />{v}</span>
                        ) : v}
                      </dd>
                    </motion.div>
                  ))}
                </dl>
                {s.extra && <p className="mt-3 text-[11px] text-muted-foreground">{s.extra}</p>}

                {s.review && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {([
                      ["accept", t("Accept return", "قبول الإرجاع"), Check],
                      ["reject", t("Decline", "رفض"), X],
                      ["takeover", t("Take over chat", "استلم المحادثة"), UserRound],
                    ] as const).map(([key, label, Icon]) => (
                      <button
                        key={key}
                        type="button"
                        disabled={!done || Boolean(decision)}
                        onClick={() => setDecision(key)}
                        className={cn(
                          "demo-action",
                          key === "accept" && "demo-action-primary",
                          decision === key && "demo-action-chosen",
                        )}
                      >
                        <Icon className="size-3.5" strokeWidth={2.4} />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {s.review && done && !decision && (
                  <p className="mt-3 text-[11px] text-muted-foreground">{t("Try it: pick a decision and watch the chat.", "جرّبها: اختر قرار وشوف المحادثة.")}</p>
                )}
              </motion.div>
              </AnimatePresence>
              <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-xs text-muted-foreground">
                <span>{t("Illustrative example with sample data", "مثال توضيحي ببيانات افتراضية")}</span>
                <span className="flex items-center gap-1">
                  {!reduce && (
                    <button type="button" onClick={() => setPaused((p) => !p)} className="demo-ctrl" aria-label={paused ? t("Play", "تشغيل") : t("Pause", "إيقاف مؤقت")}>
                      {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                    </button>
                  )}
                  <button type="button" onClick={() => pick(active)} className="demo-ctrl" aria-label={t("Replay", "أعد التشغيل")}>
                    <RotateCcw className="size-3.5" />
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoBubble({ m, reduce }: { m: Msg; reduce: boolean }) {
  const { t } = useLanguage();
  if (m.who === "s")
    return (
      <motion.p layout initial={reduce ? false : { opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="phone-sys mx-auto rounded-md bg-[#fff6d5] px-3 py-1 text-[11px] text-[#5c4a12] shadow-sm">
        {m.text}
      </motion.p>
    );
  const out = m.who === "c";
  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.32, ease: EASE }}
      data-direction={out ? "outgoing" : "incoming"}
      className={cn("phone-bubble relative max-w-[86%] shrink-0 rounded-xl px-3 py-2 text-start shadow-sm", out ? "ms-auto rounded-se-none" : "me-auto rounded-ss-none")}
    >
      {m.kind === "photo" ? (
        <img src="/demo/sneaker-photo.jpg" alt={m.text} width={160} height={110} className="h-[110px] w-[160px] rounded-lg object-cover" />
      ) : (
        <p className={cn(m.kind === "order" && "font-semibold tabular-nums")} dir={m.kind === "order" ? "ltr" : undefined}>{m.text}</p>
      )}
      {m.kind === "products" && (
        <span className="mt-2 grid grid-cols-2 gap-1.5">
          {["sneaker-pair", "sneaker-photo"].map((img, n) => (
            <span key={img} className="demo-product overflow-hidden rounded-lg bg-black/[0.04] dark:bg-white/[0.06]">
              <img src={`/demo/${img}.jpg`} alt="" width={120} height={80} className="h-16 w-full object-cover" />
              <span className="block px-1.5 py-1 text-[10px] font-semibold">
                {n === 0 ? t("Runner", "رنر") : t("Walker", "ووكر")} · <span dir="ltr">{n === 0 ? "289" : "319"}</span>
              </span>
            </span>
          ))}
        </span>
      )}
      {m.kind === "pay" && (
        <span className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#075E54] px-3 py-1.5 text-[12px] font-semibold text-white">
          {t("Pay for the order", "ادفع الطلب")} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
        </span>
      )}
      <span className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-[#65756d]">
        10:01
        {out && <CheckCheck className="size-3 text-[#34aadc]" aria-hidden="true" />}
      </span>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. "We answer our own customers with Reload" (v201): proof by dogfooding.
 *    A small chat types itself when it comes into view.
 * ────────────────────────────────────────────────────────────────────────── */
export function AskReloadStrip() {
  const { t } = useLanguage();
  const reduce = useSsrReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5, once: true });
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const chat: [Who, string][] = [
    ["c", t("Hi, I run an online store. What can Reload do for me?", "هلا، عندي متجر إلكتروني. وش يقدر ريلود يسوي لي؟")],
    ["r", t("Hi 👋 Reload answers your customers on WhatsApp about products and orders, and settles return requests by your policy. Want me to show you how to start?", "يا هلا 👋 ريلود يرد على عملائك في واتساب عن المنتجات والطلبات، ويحسم طلبات الإرجاع حسب سياسة متجرك. تبي أوريك كيف تبدأ؟")],
    ["c", t("How much is it?", "كم الأسعار؟")],
    ["r", t("Plans start at SAR 149 a month including VAT, with 20% off yearly.", "الباقات تبدأ من 149 ريال شهريًا شاملة الضريبة، وفيه خصم 20% على السنوي.")],
  ];
  useEffect(() => {
    if (reduce) { setCount(chat.length); return; }
    if (!inView) return;
    const timers: number[] = [];
    let at = 300;
    chat.forEach(([who], n) => {
      if (who === "r") { timers.push(window.setTimeout(() => setTyping(true), at)); at += 1100; } else at += 500;
      timers.push(window.setTimeout(() => { setTyping(false); setCount(n + 1); }, at));
      at += 450;
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce]);

  return (
    <section className="ask-strip scroll-mt-24" aria-labelledby="ask-title">
      <div className="mx-auto grid max-w-[1100px] items-center gap-12 px-5 py-20 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <ScrollReveal>
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="ask-dot" />
              {t("We use our own product", "نستخدم منتجنا بأنفسنا")}
            </span>
            <h2 id="ask-title" className="mt-5 font-display text-3xl font-semibold tracking-[-0.025em] text-balance md:text-[40px] md:leading-[1.15]">
              {t("We answer our own customers ", "حنا نرد على عملائنا ")}
              <Tone>{t("with Reload.", "بريلود.")}</Tone>
            </h2>
            <p className="mt-4 max-w-md text-base leading-8 text-muted-foreground">
              {t("Ask us on WhatsApp about Reload, pricing or getting your store started.", "اسألنا على واتساب عن ريلود أو الأسعار أو بداية متجرك معنا.")}
            </p>
            <a href={getWhatsAppPublicUrl()} target="_blank" rel="noopener noreferrer" className="ask-cta group mt-7">
              <WhatsAppLogo className="size-5" />
              {t("Ask Reload on WhatsApp", "اسأل ريلود على واتساب")}
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <div ref={ref} className="ask-chat">
            <div className="flex items-center gap-2.5 border-b px-4 py-3">
              <span className="grid size-8 place-items-center rounded-full bg-foreground text-background"><ReloadMark className="size-4" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t("Reload", "ريلود")}</p>
                <p className="text-[11px] text-muted-foreground">{typing ? t("typing…", "يكتب…") : t("online", "متصل")}</p>
              </div>
            </div>
            <div className="flex min-h-[290px] flex-col justify-end gap-2 p-4 text-[13px] leading-relaxed">
              <AnimatePresence initial={false}>
                {chat.slice(0, count).map(([who, text], n) => (
                  <motion.p
                    key={n}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.32, ease: EASE }}
                    className={cn("max-w-[85%] rounded-2xl px-3.5 py-2", who === "c" ? "ms-auto rounded-se-md bg-foreground text-background" : "me-auto rounded-ss-md bg-foreground/[0.06]")}
                  >
                    {text}
                  </motion.p>
                ))}
                {typing && (
                  <motion.span key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="me-auto flex gap-1 rounded-2xl bg-foreground/[0.06] px-3.5 py-3">
                    {[0, 1, 2].map((i) => <span key={i} className="ask-typing size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. "Why Reload?" (v201): four business benefits, no boxes. A line draws in
 *    above each one; icons move a little on hover.
 * ────────────────────────────────────────────────────────────────────────── */
export function WhyReload() {
  const { t } = useLanguage();
  const items = [
    { Icon: Wallet, title: t("Lower support costs", "قلّل تكلفة خدمة العملاء"), body: t("Reload answers repeated questions and settles clear return requests, so you don’t need to hire more every time you grow.", "ريلود يرد على الأسئلة المتكررة ويحسم طلبات الإرجاع الواضحة، فما تحتاج توظّف أكثر كل ما كبر متجرك.") },
    { Icon: Clock3, title: t("Save your team’s time", "وفّر وقت فريقك"), body: t("Instead of answering the same questions every day, your team focuses on the cases that really need them.", "بدل ما يرد فريقك على نفس الأسئلة كل يوم، يتفرغ للحالات اللي تحتاجه فعلًا.") },
    { Icon: MessageCircleReply, title: t("Faster replies", "رد أسرع لعميلك"), body: t("Customers get answers around the clock, on the WhatsApp they already use, without waiting.", "عميلك ياخذ رده على مدار الساعة، في واتساب اللي يستخدمه أصلًا، بدون انتظار.") },
    { Icon: ListChecks, title: t("Organized returns", "مرتجعات مرتبة"), body: t("Every return gets a clear result by your policy, and everything sits in one dashboard.", "كل طلب إرجاع ياخذ نتيجة واضحة حسب سياستك، وكل شي مرتب في لوحة وحدة.") },
  ];
  return (
    <section className="scroll-mt-24" aria-labelledby="why-title">
      <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("Why Reload?", "ليش ريلود؟")}</p>
            <h2 id="why-title" className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-balance md:text-[42px] md:leading-[1.15]">
              {t("Faster support, ", "خدمة عملاء أسرع، ")}
              <Tone>{t("for less cost and effort.", "بتكلفة وجهد أقل.")}</Tone>
            </h2>
          </div>
        </ScrollReveal>
        <ul className="mt-14 grid min-w-0 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ Icon, title, body }, n) => (
            <li key={title}>
              <ScrollReveal delay={n * 90}>
                <div className="why-item group">
                  <span className="why-line" aria-hidden="true" />
                  <span className="why-icon"><Icon className="size-5" strokeWidth={1.8} /></span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
                </div>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* "Why trust Reload" (v201): four short promises, in the same open style as
   WhyReload, no boxes. */
export function TrustReload() {
  const { t } = useLanguage();
  const items = [
    { Icon: SlidersHorizontal, title: t("You're in control", "القرار بيدك"), body: t("You set the policy and approve the answers. Anything unclear comes to you to decide.", "أنت تحدد السياسة وتعتمد الإجابات، وأي حالة غير واضحة توصلك تقرر فيها.") },
    { Icon: Store, title: t("Answers only from your store data", "يرد من بيانات متجرك فقط"), body: t("Reload replies from your products, orders and approved policies. It doesn't make things up.", "ريلود يرد من منتجاتك وطلباتك وسياساتك المعتمدة، وما يألّف من عنده.") },
    { Icon: ShieldCheck, title: t("On official WhatsApp", "على واتساب الرسمي"), body: t("Built on the official WhatsApp Business Platform, with order details shared only after verification.", "مبني على منصة واتساب للأعمال الرسمية، وتفاصيل الطلب ما تنعرض إلا بعد التحقق.") },
    { Icon: Languages, title: t("Saudi, and speaks your customers' language", "سعودي ويتكلم لغة عملائك"), body: t("Made in Saudi Arabia, replying in Saudi Arabic or English, whichever your customer uses.", "صُنع في السعودية، ويرد بالعربي السعودي أو الإنجليزي حسب لغة عميلك.") },
  ];
  return (
    <section className="scroll-mt-24" aria-labelledby="trust-title">
      <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("Why trust Reload?", "ليش تثق في ريلود؟")}</p>
            <h2 id="trust-title" className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-balance md:text-[42px] md:leading-[1.15]">
              {t("Your store, your rules. ", "متجرك وقواعدك. ")}
              <Tone>{t("Reload follows them.", "وريلود يمشي عليها.")}</Tone>
            </h2>
          </div>
        </ScrollReveal>
        <ul className="mt-14 grid min-w-0 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ Icon, title, body }, n) => (
            <li key={title}>
              <ScrollReveal delay={n * 90}>
                <div className="why-item group">
                  <span className="why-line" aria-hidden="true" />
                  <span className="why-icon"><Icon className="size-5" strokeWidth={1.8} /></span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
                </div>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* The short contact form from v201: name, mobile and store link, saved as a
   lead through /api/contact. A WhatsApp card sits beside it for people who'd
   rather just ask. The longer financing form stays under the calculator. */
export function QuickContact() {
  const { t } = useLanguage();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "sending") return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value("name"), phone: value("phone"), store: value("store"), company: value("company") }),
      });
      if (res.status === 400) throw new Error("invalid");
      if (!res.ok) throw new Error("failed");
      setFirstName(value("name").split(/\s+/)[0] ?? "");
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(
        (err as Error).message === "invalid"
          ? t("Check your mobile number and store link.", "تأكد من رقم الجوال ورابط المتجر.")
          : t("We couldn't send this. Please try again, or message us on WhatsApp.", "تعذّر الإرسال. حاول مرة ثانية، أو راسلنا على واتساب."),
      );
    }
  };

  return (
    <section id="contact" aria-labelledby="quick-contact-title" className="scroll-mt-24 bg-muted/30">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <ScrollReveal>
          <p className="text-sm font-medium text-muted-foreground">{t("Talk to us", "تواصل معنا")}</p>
          <h2 id="quick-contact-title" className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-balance md:text-[42px] md:leading-[1.15]">
            {t("Want to see Reload ", "تبي تشوف ريلود ")}
            <Tone>{t("on your store?", "على متجرك؟")}</Tone>
          </h2>
          <p className="mt-4 max-w-md text-base leading-8 text-muted-foreground text-pretty">
            {t("Leave three details and we'll contact you to get you started.", "اترك ثلاث معلومات ونتواصل معك عشان نبدأ.")}
          </p>
          <a href={getWhatsAppPublicUrl()} target="_blank" rel="noopener noreferrer" className="qc-wa group mt-8">
            <span className="qc-wa-icon"><WhatsAppLogo className="size-5" /></span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">{t("Prefer WhatsApp?", "تفضّل واتساب؟")}</span>
              <span className="block text-sm text-muted-foreground">{t("Ask us directly", "اسألنا مباشرة")}</span>
            </span>
            <ArrowUpRight className="ms-auto size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
          </a>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <AnimatePresence mode="wait" initial={false}>
            {state === "sent" ? (
              <motion.div key="sent" role="status" className="qc-done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: EASE }}>
                <span className="grid size-11 place-items-center rounded-full bg-foreground text-background"><Check className="size-5" /></span>
                <h3 className="mt-5 text-xl font-semibold">
                  {firstName ? t(`Thanks, ${firstName}.`, `شكرًا ${firstName}.`) : t("Thanks.", "شكرًا.")}
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
                  {t("We've got your details. The Reload team will contact you soon.", "وصلتنا بياناتك، وفريق ريلود بيتواصل معك قريب.")}
                </p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={(event) => void submit(event)} className="qc-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.24, ease: EASE }}>
                <label className="block text-sm font-medium">
                  {t("Your name", "اسمك")}
                  <Input name="name" className="mt-2 h-11" required maxLength={120} autoComplete="name" />
                </label>
                <label className="block text-sm font-medium">
                  {t("Mobile number", "رقم الجوال")}
                  <Input name="phone" type="tel" dir="ltr" inputMode="tel" className="mt-2 h-11 rtl:text-right" required minLength={7} maxLength={25} autoComplete="tel" placeholder="05XXXXXXXX" />
                </label>
                <label className="block text-sm font-medium">
                  {t("Store link", "رابط المتجر")}
                  <Input name="store" dir="ltr" inputMode="url" className="mt-2 h-11 rtl:text-right" required maxLength={200} autoComplete="url" placeholder="yourstore.com" />
                </label>
                {/* Left empty by people; bots that fill it are dropped by the server. */}
                <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button type="submit" size="lg" className="h-11 w-full" disabled={state === "sending"}>
                  {state === "sending" && <Loader2 className="size-4 animate-spin" />}
                  {t("Contact me", "تواصلوا معي")}
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("We'll only use these details to contact you about Reload.", "نستخدم بياناتك فقط للتواصل معك بخصوص ريلود.")}
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </ScrollReveal>
      </div>
    </section>
  );
}
