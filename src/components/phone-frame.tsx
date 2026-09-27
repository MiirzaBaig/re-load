"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  Video,
  Phone,
  Plus,
  Mic,
  Smile,
  CheckCheck,
  Pause,
  Play,
} from "lucide-react";
import { OutcomeBadge } from "@/components/outcome-badge";
import { StoreMark } from "@/components/store-identity";
import type { EligibilityDecision } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const WHATSAPP_STATUS: "live" | "coming-soon" = "live";
const BRAND = {
  green: "#25D366",
  header: "#075E54",
  outgoing: "#DCF8C6",
  ground: "#ECE5DD",
};

/** iOS-style status glyphs (not Lucide — those read Android/Material). */
function IosCellularSignal({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 17 11"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="0" y="7" width="3" height="4" rx="0.6" />
      <rect x="4.5" y="5" width="3" height="6" rx="0.6" />
      <rect x="9" y="2.5" width="3" height="8.5" rx="0.6" />
      <rect x="13.5" y="0" width="3" height="11" rx="0.6" />
    </svg>
  );
}

function IosWifi({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1.5 4.5c4-3.5 9-3.5 13 0" />
      <path d="M4 7.25c2.5-2 5.5-2 8 0" />
      <path d="M6.5 10c1.2-.95 2.8-.95 4 0" />
      <circle cx="8" cy="11.25" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IosBattery({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 27 13" fill="none" className={className} aria-hidden="true">
      <rect
        x="0.75"
        y="1.75"
        width="22"
        height="9.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M24.25 4.75v3.5c.75.35 1.25.35 1.25.35v-4.2s-.5 0-1.25.35Z"
        fill="currentColor"
      />
      <rect x="2.5" y="3.5" width="16.5" height="6" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function IosStatusBar() {
  return (
    <div className="phone-ios-status pointer-events-none absolute inset-x-0 top-0 z-30 px-5 pt-2.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <time
          dateTime="10:00"
          className="text-[15px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-white"
        >
          10:00
        </time>
        <div
          className="phone-dynamic-island relative h-[25px] w-[84px] rounded-full bg-black shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
          aria-hidden="true"
        >
          <span className="absolute right-[9px] top-1/2 size-[8px] -translate-y-1/2 rounded-full bg-[#0d1824]" />
        </div>
        <div className="flex items-center justify-end gap-[5px] text-white">
          <IosCellularSignal className="h-[11px] w-[17px]" />
          <IosWifi className="h-[11px] w-[15px]" />
          <IosBattery className="h-[12px] w-[27px]" />
        </div>
      </div>
    </div>
  );
}

export function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ color: BRAND.green }}
      className={className}
      aria-hidden="true"
    >
      <path d="M20.52 3.48A11.88 11.88 0 0 0 12.04 0C5.46 0 .1 5.35.1 11.93c0 2.1.55 4.15 1.6 5.96L0 24l6.26-1.64a11.96 11.96 0 0 0 5.77 1.47h.01C18.62 23.83 24 18.48 24 11.9c0-3.19-1.24-6.18-3.48-8.42ZM12.04 21.8a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.98.99-3.63-.24-.37a9.87 9.87 0 0 1-1.52-5.26c0-5.46 4.44-9.9 9.91-9.9a9.83 9.83 0 0 1 7 2.9 9.82 9.82 0 0 1 2.9 7c0 5.46-4.46 9.9-9.92 9.9Zm5.44-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.8-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.59-.49-.51-.67-.52h-.57c-.2 0-.52.08-.8.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.48 1.69.62.71.22 1.36.19 1.87.11.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

export function WhatsAppChannel({
  className,
  status = WHATSAPP_STATUS,
  showStatus = true,
}: {
  className?: string;
  status?: "live" | "coming-soon";
  /** Set false where another nearby element already states the status. */
  showStatus?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center justify-center gap-1.5 text-xs font-medium",
        className,
      )}
    >
      <WhatsAppLogo className="size-4" />
      <span>{status === "coming-soon" && showStatus ? "WhatsApp soon" : "WhatsApp"}</span>
    </span>
  );
}

export function PhoneFrame({
  children,
  className,
  scale = "hero",
}: {
  children: ReactNode;
  className?: string;
  scale?: "hero" | "compact";
}) {
  return (
    <div
      data-phone-frame
      className={cn(
        "phone-device relative mx-auto w-full rounded-[3rem] border border-[#737478] bg-[#202124] p-[7px]",
        scale === "hero" ? "max-w-[364px]" : "max-w-[344px]",
        className,
      )}
    >
      <div
        className="absolute -left-[3px] top-28 h-10 w-[3px] rounded-l bg-[#525356]"
        aria-hidden="true"
      />
      <div
        className="absolute -right-[3px] top-36 h-16 w-[3px] rounded-r bg-[#525356]"
        aria-hidden="true"
      />
      <div className="phone-screen relative overflow-hidden rounded-[2.55rem] bg-[#ECE5DD] text-[#172b27]">
        <IosStatusBar />
        {children}
        <div
          className="phone-home-indicator flex h-[22px] items-end justify-center bg-[#f7f8fa] pb-1.5"
          aria-hidden="true"
        >
          <div className="h-[5px] w-[134px] max-w-[36%] rounded-full bg-[#172b27]/88" />
        </div>
      </div>
    </div>
  );
}

export interface ThreadMessage {
  id: string;
  direction: "incoming" | "outgoing";
  text: string;
  decision?: EligibilityDecision;
  rule?: string;
}

export function TypingIndicator() {
  return (
    <div
      aria-label="Nova Store is typing"
      className="flex w-fit gap-1 rounded-xl rounded-tl-none bg-white px-4 py-3 shadow-sm"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-[#80918a]"
          animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function WhatsAppThread({
  messages,
  status = WHATSAPP_STATUS,
  animated = false,
}: {
  messages: ThreadMessage[];
  status?: "live" | "coming-soon";
  animated?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.25, once: true });
  const [stage, setStage] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [paused, setPaused] = useState(false);
  const staticThread = !animated || reduceMotion || paused;
  useEffect(() => {
    if (staticThread || !inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    const frames: number[] = [];
    const customerText = messages[0]?.text ?? "";
    const cycle = () => {
      setStage(0);
      setTypedChars(0);
      timers.push(setTimeout(() => setStage(1), 500));
      timers.push(setTimeout(() => {
        let chars = 0;
        let lastFrame = 0;
        const step = (time: number) => {
          if (time - lastFrame >= 34) {
            lastFrame = time;
            chars = Math.min(customerText.length, chars + 2);
            setTypedChars(chars);
            if (chars >= customerText.length) return;
          }
          frames.push(requestAnimationFrame(step));
        };
        frames.push(requestAnimationFrame(step));
      }, 650));
      timers.push(setTimeout(() => setStage(2), 2850));
      timers.push(setTimeout(() => setStage(3), 3650));
      timers.push(setTimeout(() => setStage(4), 5050));
      // Hold the completed conversation; scrolling back must not reset it.
    };
    cycle();
    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      frames.forEach(cancelAnimationFrame);
    };
  }, [staticThread, inView]);
  const complete = staticThread || stage === 4;
  return (
    <div
      ref={ref}
      data-thread-stage={
        complete
          ? "complete"
          : stage === 3
            ? "typing"
            : stage === 2
              ? "message"
              : stage === 1
                ? "composing"
                : "waiting"
      }
    >
      <div
        className="phone-wa-header flex items-center gap-2 px-3 pb-3 pt-[2.65rem] text-white"
        style={{ background: BRAND.header }}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        <StoreMark size="lg" className="ring-1 ring-white/25" />
        <div className="flex-1">
          <div className="text-sm font-semibold">Nova Store</div>
          <div className="text-[10px] text-white/75">business account</div>
        </div>
        <Video className="size-4" aria-hidden="true" />
        <Phone className="ml-2 size-3.5" aria-hidden="true" />
      </div>
      <div
        className="phone-chat relative flex min-h-[415px] flex-col gap-3 px-3 py-4 text-[13px] leading-relaxed"
      >
        <span className="mx-auto rounded-md bg-white/75 px-3 py-0.5 text-[10px] text-[#65756d]">
          Today ·{" "}
          {status === "coming-soon"
            ? "Channel preview"
            : "Example conversation"}
        </span>
        <div className="text-center text-[10px] text-[#65756d]">
          Demo order · customer already verified
        </div>
        {(complete ? messages : messages.slice(0, stage >= 2 ? 1 : 0)).map(
          (message) => (
            <motion.div
              key={message.id}
              initial={staticThread ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "phone-bubble relative z-10 max-w-[96%] rounded-xl px-3 py-2.5 shadow-sm",
                message.direction === "outgoing"
                  ? "ml-auto rounded-tr-none"
                  : "mr-auto rounded-tl-none",
              )}
              data-direction={message.direction}
            >
              {message.decision && (
                <div className="mb-2">
                  <OutcomeBadge outcome={message.decision.outcome} size="sm" />
                </div>
              )}
              <p>{message.text}</p>
              {message.decision && (
                <div className="mt-3 border-t border-[#dce3de] pt-2 text-[11px] leading-relaxed">
                  <p className="font-semibold">{message.rule}</p>
                  <p className="mt-1 text-[#65756d]">
                    Policy {message.decision.policyVersionLabel} · approved by
                    merchant
                  </p>
                  <p className="mt-1 break-all font-mono text-[9px] text-[#65756d]">
                    {message.decision.appliedRules.find((r) => !r.passed)
                      ?.reasonCode ?? "WITHIN_WINDOW"}
                  </p>
                </div>
              )}
              <span className="mt-1 flex items-center justify-end gap-1 text-[9px] text-[#65756d]">
                10:00
                {message.direction === "outgoing" && (
                  <CheckCheck
                    className="size-3 text-[#34aadc]"
                    aria-hidden="true"
                  />
                )}
              </span>
            </motion.div>
          ),
        )}
        {!complete && stage === 3 && <TypingIndicator />}
      </div>
      <div
        className="phone-composer flex items-center gap-2 border-t border-[#dde4df]/80 bg-[#f7f8fa] px-3 py-2 text-[#72827a]"
        aria-hidden="true"
      >
        <Plus className="size-5" />
        <div className="flex h-8 min-w-0 flex-1 items-center justify-between rounded-full border border-[#dde4df] bg-white px-3 text-[11px]">
          <span className="min-w-0 truncate">
            {!staticThread && stage === 1
              ? messages[0]?.text.slice(0, typedChars)
              : "Message"}
            {!staticThread && stage === 1 && (
              <span className="ml-px inline-block h-3 w-px animate-pulse bg-current align-middle" />
            )}
          </span>
          <Smile className="size-4" />
        </div>
        <Mic className="size-4" />
      </div>
      {animated && !reduceMotion && (
        <button
          onClick={() => setPaused((p) => !p)}
          className="flex w-full items-center justify-center gap-1 bg-[#f7f8fa] pb-1 text-[10px] text-[#466257]"
          aria-label={
            paused
              ? "Play conversation animation"
              : "Pause conversation animation"
          }
        >
          {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          {paused ? "Play preview" : "Pause preview"}
        </button>
      )}
    </div>
  );
}

/**
 * Whether the refund-deposit card renders as money actually moved.
 *
 * Relod decides eligibility; it does not move funds yet. While this is
 * "preview" the deposit card is labelled as the refund the customer is owed on
 * an approved return — true today — instead of claiming a completed transfer.
 * Flip to "live" when payouts ship and the wording follows.
 */
export const REFUND_PAYOUT_STATUS: "live" | "preview" = "preview";

export interface ConversationStep {
  id: string;
  direction: "incoming" | "outgoing";
  /** Clock label shown on the bubble, e.g. "10:02". */
  time: string;
  text?: string;
  /** Renders the customer's product photo instead of text. */
  photo?: boolean;
}

/**
 * A full return conversation that plays out step by step.
 *
 * `WhatsAppThread` above is fixed at the two-bubble eligibility exchange the
 * outcome cards need. This one takes an arbitrary sequence and reveals it on a
 * timer, with a typing indicator before each incoming reply, so the thread
 * reads as a conversation unfolding in real time.
 */
export function WhatsAppConversation({
  steps,
  refundLabel,
  refundAmount,
  showRefundCard = true,
  caption,
}: {
  steps: ConversationStep[];
  refundLabel: string;
  refundAmount: string;
  showRefundCard?: boolean;
  caption: string;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: true });
  const scrollRef = useRef<HTMLDivElement>(null);
  // -1 is "nothing yet"; steps.length means the refund card has landed too.
  const [shown, setShown] = useState(-1);
  const [typing, setTyping] = useState(false);

  const done = shown >= steps.length;

  useEffect(() => {
    if (reduceMotion) {
      setShown(steps.length);
      return;
    }
    if (!inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 400;
    steps.forEach((step, i) => {
      // An incoming reply gets a typing indicator first — that pause is what
      // makes the exchange feel like a person (or the engine) responding.
      if (step.direction === "incoming") {
        timers.push(setTimeout(() => setTyping(true), at));
        at += 900;
      }
      timers.push(
        setTimeout(() => {
          setTyping(false);
          setShown(i);
        }, at),
      );
      at += step.photo ? 1100 : 1250;
    });
    timers.push(setTimeout(() => setShown(steps.length), at + 250));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduceMotion, steps]);

  // Keep the newest bubble in view as the thread grows past the screen.
  useEffect(() => {
    if (reduceMotion || !scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [shown, typing, reduceMotion]);

  return (
    <div ref={ref} data-conversation-complete={done || undefined}>
      <div
        className="phone-wa-header flex items-center gap-2 px-3 pb-3 pt-[2.65rem] text-white"
        style={{ background: BRAND.header }}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        <StoreMark size="lg" className="ring-1 ring-white/25" />
        <div className="flex-1">
          <div className="text-sm font-semibold">Nova Store</div>
          <div className="text-[10px] text-white/75">business account</div>
        </div>
        <Video className="size-4" aria-hidden="true" />
        <Phone className="ml-2 size-3.5" aria-hidden="true" />
      </div>

      <div
        ref={scrollRef}
        className="phone-chat phone-chat-scroll relative flex h-[500px] flex-col gap-2.5 overflow-y-auto px-3 py-4 text-[13px] leading-relaxed"
      >
        <span className="mx-auto shrink-0 rounded-md bg-white/75 px-3 py-0.5 text-[10px] text-[#65756d]">
          {caption}
        </span>

        {steps.map((step, i) =>
          i <= shown ? (
            <motion.div
              key={step.id}
              initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "phone-bubble relative z-10 shrink-0 rounded-xl shadow-sm",
                step.photo ? "w-[62%] p-1.5" : "max-w-[82%] px-3 py-2.5",
                step.direction === "outgoing"
                  ? "ml-auto rounded-tr-none"
                  : "mr-auto rounded-tl-none",
              )}
              data-direction={step.direction}
            >
              {step.photo ? (
                <ProductPhoto />
              ) : (
                <p>{step.text}</p>
              )}
              <span
                className={cn(
                  "mt-1 flex items-center justify-end gap-1 text-[9px] text-[#65756d]",
                  step.photo && "pe-1 pb-0.5",
                )}
              >
                {step.time}
                {step.direction === "outgoing" && (
                  <CheckCheck className="size-3 text-[#34aadc]" aria-hidden="true" />
                )}
              </span>
            </motion.div>
          ) : null,
        )}

        {typing && !reduceMotion && (
          <div className="shrink-0">
            <TypingIndicator />
          </div>
        )}

        {/* The payoff: the refund lands in the same thread the customer
            already had open. */}
        {showRefundCard && done && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="phone-refund-card mt-1 shrink-0 rounded-xl px-3 py-2.5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1f8a52]">
              {refundLabel}
            </p>
            <p className="mt-0.5 text-[17px] font-bold text-[#0f2723]">
              {refundAmount}
            </p>
          </motion.div>
        )}
      </div>

      <div
        className="phone-composer flex items-center gap-2 border-t border-[#dde4df]/80 bg-[#f7f8fa] px-3 py-2 text-[#72827a]"
        aria-hidden="true"
      >
        <Plus className="size-5" />
        <div className="flex h-8 min-w-0 flex-1 items-center justify-between rounded-full border border-[#dde4df] bg-white px-3 text-[11px]">
          <span className="min-w-0 truncate">Message</span>
          <Smile className="size-4" />
        </div>
        <Mic className="size-4" />
      </div>
    </div>
  );
}

/** Stand-in for the photo the customer sends — drawn, not a stock image. */
function ProductPhoto() {
  return (
    <div className="overflow-hidden rounded-lg" aria-label="Photo of the product">
      <div className="relative aspect-square bg-gradient-to-b from-[#eef1f6] to-[#dfe5ee]">
        {/* A shoebox, read at a glance: lid, body, and the shoe's silhouette. */}
        <div className="absolute inset-x-[18%] bottom-[22%] top-[34%] rounded-[3px] bg-white shadow-sm" />
        <div className="absolute inset-x-[14%] top-[28%] h-[13%] rounded-[3px] bg-[#f3f5f8] shadow-sm" />
        <div className="absolute inset-x-[30%] bottom-[30%] h-[18%] rounded-b-full rounded-t-[4px] bg-[#e8ece6]" />
        <div className="absolute inset-x-[34%] bottom-[38%] h-[5%] rounded-full bg-[#cdd6c6]" />
      </div>
    </div>
  );
}
