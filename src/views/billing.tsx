"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleCheck,
  CreditCard,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/desk/page-header";
import { CountUp, TWEEN, Segmented } from "@/components/desk/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { BillingUpgrade } from "@/components/billing-upgrade";
import { PaymentTracker } from "@/components/payment-tracker";
import { BillingFrequencyChange } from "@/components/billing-frequency-change";
import { cn } from "@/lib/utils";

type BillingSnapshot = {
  environment: "live" | "sandbox";
  storeName: string | null;
  plan: "standard" | "premium" | null;
  status: string;
  included: number;
  used: number;
  reserved: number;
  purchasedRemaining: number;
  periodStart: string | null;
  periodEnd: string | null;
  allowanceEnd: string | null;
  billingInterval: "monthly" | "annual";
  pendingInterval: "monthly" | "annual" | null;
  pendingCheckout: {
    kind: string;
    status: string;
    plan: string;
    billing_interval: string;
    amount_halalas: number;
    expires_at: string;
  } | null;
  cancelAtPeriodEnd: boolean;
  offerAvailable: boolean;
  canManage: boolean;
  enforcementEnabled: boolean;
  trialUntil: string | null;
  bundlePriceHalalas: number | null;
  bundlesAvailable: boolean;
  payments: Array<{
    amount_halalas: number;
    refunded_halalas: number;
    paid_at: string;
    plan: string;
    kind: string;
    billing_interval: string;
  }>;
};

export function BillingPage() {
  const { workspace } = useAuth();
  const { t, isArabic } = useLanguage();
  const reduce = useReducedMotion();
  const [linkedStore, setLinkedStore] = useState<string | null>(null);
  const storeId = linkedStore || workspace?.storeId;
  const [interval, setIntervalChoice] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [data, setData] = useState<BillingSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [returned, setReturned] = useState<"return" | "failed" | null>(null);
  const version = useRef(0);
  const requestFlight = useRef(false);
  const load = useCallback(async () => {
    if (!storeId) return;
    const request = ++version.current;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/billing?store=${storeId}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error();
      if (request === version.current) {
        setData(result);
        if (result.plan) setIntervalChoice(result.billingInterval || "monthly");
        setError("");
      }
    } catch {
      if (request === version.current)
        setError(
          t(
            "We couldn’t load billing. Your workspace is safe. Please retry.",
            "تعذّر تحميل الاشتراك. بيانات متجرك محفوظة، حاول مرة أخرى.",
          ),
        );
    } finally {
      if (request === version.current) setRefreshing(false);
    }
  }, [storeId, t]);
  useEffect(() => {
    setData(null);
    setPaymentConfirmed(false);
    requestFlight.current = false;
    setBusy(null);
    void load();
    return () => {
      ++version.current;
    };
  }, [load]);
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("store");
    if (selected && /^[0-9a-f-]{36}$/i.test(selected)) setLinkedStore(selected);
    const checkout = new URLSearchParams(window.location.search).get(
      "checkout",
    );
    if (checkout === "return" || checkout === "failed") setReturned(checkout);
  }, []);
  useEffect(() => {
    if (returned !== "return" || !storeId) return;
    const invoiceId = new URLSearchParams(window.location.search).get(
      "invoice_id",
    );
    if (!invoiceId || !/^[0-9a-f-]{36}$/i.test(invoiceId)) return;
    const controller = new AbortController();
    void fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", storeId, invoiceId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) {
          const result = await response.json();
          if (!controller.signal.aborted)
            setPaymentConfirmed(result.checked === true);
        }
        return load();
      })
      .catch(() => {});
    return () => controller.abort();
  }, [returned, storeId, load]);
  useEffect(() => {
    if (returned !== "return") return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 12) clearInterval(timer);
      else void load();
    }, 5000);
    return () => clearInterval(timer);
  }, [returned, load]);
  useEffect(() => {
    const restore = () => {
      requestFlight.current = false;
      setBusy(null);
      void load();
    };
    window.addEventListener("pageshow", restore);
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.clearInterval(timer);
    };
  }, [load]);
  const sync = async () => {
    if (!storeId || requestFlight.current) return;
    requestFlight.current = true;
    setBusy("sync");
    try {
      const r = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", storeId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
    } catch {
      setError(
        t(
          "We’re still checking. Please don’t pay again; contact Reload if a payment was deducted.",
          "ما زلنا نتحقق. لا تدفع مرة أخرى؛ تواصل معنا إذا خُصم مبلغ.",
        ),
      );
    } finally {
      requestFlight.current = false;
      setBusy(null);
    }
  };
  const start = async (
    action: "checkout" | "portal",
    plan?: string,
    kind?: string,
  ) => {
    if (!storeId || requestFlight.current) return;
    requestFlight.current = true;
    setBusy(plan || action);
    setError("");
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          plan,
          storeId,
          kind,
          interval:
            data?.pendingCheckout &&
            data.pendingCheckout.plan === plan &&
            (!kind || kind === "SUBSCRIPTION")
              ? data.pendingCheckout.billing_interval
              : interval,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error);
      const target = new URL(result.url);
      if (
        target.protocol !== "https:" ||
        !(
          target.hostname === "streampay.sa" ||
          target.hostname.endsWith(".streampay.sa")
        )
      )
        throw new Error();
      window.location.assign(target.toString());
    } catch (cause) {
      setError(
        isArabic
          ? "تعذّر فتح الدفع الآن. إعداداتك محفوظة. أعد المحاولة أو تواصل مع ريلود."
          : cause instanceof Error && cause.message
            ? cause.message
            : "Could not open checkout. Please try again.",
      );
      requestFlight.current = false;
      setBusy(null);
    }
  };
  const money = (amount: number) =>
    new Intl.NumberFormat(isArabic ? "ar-SA-u-nu-latn" : "en-SA", {
      style: "currency",
      currency: "SAR",
      maximumFractionDigits: 2,
    }).format(amount / 100);
  const date = (value: string) =>
    new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
    }).format(new Date(value));
  const active = Boolean(
    data?.periodStart &&
    Date.parse(data.periodStart) <= Date.now() &&
    data?.periodEnd &&
    new Date(data.periodEnd).getTime() > Date.now() &&
    ["ACTIVE", "PAST_DUE", "CANCELED"].includes(data.status),
  );
  const canResubscribe =
    data?.status === "CANCELED" &&
    Boolean(data.periodEnd) &&
    Date.parse(data.periodEnd!) <= Date.now();
  const hasSubscription = Boolean(data?.plan) && !canResubscribe;
  const trial = Boolean(
    data?.trialUntil && new Date(data.trialUntil).getTime() > Date.now(),
  );
  // Usage. "Pending" messages were sent but not yet confirmed delivered; they
  // count toward the allowance, so the number and the bar include them.
  const pending = data?.reserved || 0;
  const consumed = (data?.used || 0) + pending;
  const included = data?.included || 0;
  const left = Math.max(0, included - consumed);
  const usedShare = included ? Math.min(1, (data?.used || 0) / included) : 0;
  const pendingShare = included ? Math.min(1 - usedShare, pending / included) : 0;
  const percentage = included ? Math.min(100, (consumed / included) * 100) : 0;
  const extra = data?.purchasedRemaining || 0;
  const exhausted = included > 0 && left === 0 && extra === 0;
  const runningOut = !exhausted && percentage >= 80 && extra === 0;
  // This month's window, for the pace estimate. Allowances refresh monthly
  // even on yearly plans, so the window ends at allowanceEnd.
  const windowEnd = data?.allowanceEnd ? Date.parse(data.allowanceEnd) : null;
  const windowStart = windowEnd
    ? Math.max(data?.periodStart ? Date.parse(data.periodStart) : 0, windowEnd - 30 * 86_400_000)
    : null;
  const daysLeft = windowEnd ? Math.max(0, Math.ceil((windowEnd - Date.now()) / 86_400_000)) : null;
  const elapsedDays = windowStart ? Math.max(1, (Date.now() - windowStart) / 86_400_000) : null;
  const totalDays = windowStart && windowEnd ? Math.max(1, (windowEnd - windowStart) / 86_400_000) : null;
  const projected = elapsedDays && totalDays && consumed > 0 ? Math.round((consumed / elapsedDays) * totalDays) : null;
  const tone = exhausted ? "full" : runningOut ? "low" : "calm";
  const planName = (plan: string | null) => (plan === "premium" ? "Premium" : "Standard");
  // Glide to the plans and briefly mark the suggested one, instead of jumping.
  const spotlight = (plan: "standard" | "premium") => {
    document.getElementById("billing-plans")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const card = document.querySelector<HTMLElement>(`[data-plan="${plan}"]`);
    if (!card) return;
    card.classList.remove("billing-spotlight");
    void card.offsetWidth;
    card.classList.add("billing-spotlight");
    window.setTimeout(() => card.classList.remove("billing-spotlight"), 2200);
  };
  const PRICES = {
    monthly: { standard: 14900, premium: 29900 },
    annual: { standard: 143040, premium: 287040 },
  } as const;

  return (
    <div className="billing mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 pb-10">
      <PageHeader
        icon={CreditCard}
        title={t("Plan & billing", "الاشتراك والفوترة")}
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={refreshing || Boolean(busy)}
            onClick={() =>
              data?.canManage && (data.plan || data.pendingCheckout)
                ? void sync()
                : void load()
            }
            aria-label={t("Refresh billing", "تحديث الاشتراك")}
          >
            <RefreshCw
              className={cn(
                "size-4",
                (refreshing || busy === "sync") &&
                  "animate-spin motion-reduce:animate-none",
              )}
            />
            <span className="hidden sm:inline">
              {refreshing ? t("Updating", "جارٍ التحديث") : t("Refresh", "تحديث")}
            </span>
          </Button>
        }
      >
        {t(
          "One store. A clear monthly allowance. Your setup stays with you.",
          "اشتراك لمتجر واحد، ورصيد شهري واضح. إعداداتك تبقى محفوظة.",
        )}
      </PageHeader>

      <div aria-hidden="true" className={cn("billing-refresh -mt-3 h-0.5 overflow-hidden rounded-full transition-opacity duration-300", refreshing || busy === "sync" ? "opacity-100" : "opacity-0")}>
        <span />
      </div>

      {error && (
        <motion.div
          role="alert"
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TWEEN}
          className="flex flex-wrap items-center justify-between gap-3 border-s-2 border-destructive ps-4 text-sm"
        >
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {t("Try again", "حاول مرة أخرى")}
          </Button>
        </motion.div>
      )}

      {!data && !error && <BillingSkeleton label={t("Loading billing", "جارٍ تحميل الاشتراك")} />}

      {data && (
        <div className="billing-stagger flex flex-col gap-6">
          {data.environment === "sandbox" && (
            <Notice tone="review" icon={ShieldCheck} title={t("Payment testing", "اختبار الدفع")}>
              {t(
                "This checkout is in sandbox. Test payments do not activate the live WhatsApp assistant.",
                "الدفع هنا تجريبي. الدفعات التجريبية لا تفعّل مساعد واتساب للعملاء.",
              )}
            </Notice>
          )}

          {returned && (
            <Notice
              tone={returned === "failed" ? "review" : paymentConfirmed ? "eligible" : "muted"}
              icon={returned === "failed" ? AlertCircle : paymentConfirmed ? CircleCheck : Loader2}
              spin={returned !== "failed" && !paymentConfirmed}
              title={
                returned === "failed"
                  ? t("Checkout wasn’t completed", "لم تكتمل عملية الدفع")
                  : paymentConfirmed
                    ? t("Your payment has been confirmed", "تم تأكيد دفعتك")
                    : t("We’re checking your payment", "نتحقق من دفعتك")
              }
            >
              {returned === "failed"
                ? t(
                    "Your setup is saved. Check your payment method before trying again. If money was deducted, contact us first.",
                    "إعداداتك محفوظة. تحقق من وسيلة الدفع قبل المحاولة مجددًا. إذا خُصم مبلغ، تواصل معنا أولًا.",
                  )
                : paymentConfirmed
                  ? t("Your plan and allowance are shown below.", "تفاصيل الاشتراك والرصيد موضحة أدناه.")
                  : t(
                      "We activate access after confirmation from Stream. This updates on its own; please don’t pay again while we check.",
                      "يتفعّل الاشتراك بعد تأكيد ستريم. تتحدث الصفحة تلقائيًا؛ لا تدفع مرة أخرى أثناء التحقق.",
                    )}
            </Notice>
          )}

          {data.pendingCheckout && (
            <section className="billing-card border-s-2 border-review ps-5" aria-live="polite">
              <h2 className="font-semibold">{t("Your checkout is saved", "خطوة الدفع محفوظة")}</h2>
              <p className="mb-5 mt-2 text-sm leading-6 text-muted-foreground">
                {data.pendingCheckout.status === "REVIEW" ||
                Date.parse(data.pendingCheckout.expires_at) <= Date.now()
                  ? t(
                      "We need to check this checkout before another payment. Your setup is safe. Contact Reload if you need help.",
                      "نتحقق من هذه العملية قبل دفع مبلغ جديد. إعداداتك محفوظة. تواصل معنا للمساعدة.",
                    )
                  : t(
                      "Continue the same checkout, or check a payment you already made. Opening another tab will not create another subscription.",
                      "أكمل نفس عملية الدفع، أو تحقق من دفعة أجريتها. فتح تبويب آخر لا ينشئ اشتراكًا جديدًا.",
                    )}
              </p>
              <PaymentTracker stage={0} review={data.pendingCheckout.status === "REVIEW"} />
              <div className="mt-5 flex flex-wrap gap-3">
                {data.pendingCheckout.status === "READY" &&
                  Date.parse(data.pendingCheckout.expires_at) > Date.now() && (
                    <Button
                      className="rounded-xl active:scale-[.98]"
                      disabled={Boolean(busy) || !data.canManage}
                      onClick={() => void start("checkout", data.pendingCheckout!.plan, data.pendingCheckout!.kind)}
                    >
                      {t("Continue checkout", "متابعة الدفع")}
                      <ArrowRight className="size-4 rtl:-scale-x-100" />
                    </Button>
                  )}
                <Button
                  variant="outline"
                  className="rounded-xl active:scale-[.98]"
                  disabled={Boolean(busy) || !data.canManage}
                  onClick={() => void sync()}
                >
                  {busy === "sync" && <Spinner />}
                  {t("Check payment", "التحقق من الدفع")}
                </Button>
              </div>
            </section>
          )}

          {paymentConfirmed && !data.pendingCheckout && (
            <div className="billing-card billing-enter">
              <PaymentTracker stage={active ? 2 : 1} />
            </div>
          )}

          {/* ── Current plan and usage ─────────────────────────────────── */}
          <section
            className="billing-card relative"
            aria-label={t("Current subscription", "الاشتراك الحالي")}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
                  {t("Your workspace", "مساحة متجرك")}
                </p>
                <h2 className="mt-2 truncate text-xl font-semibold tracking-tight sm:text-2xl" dir="auto">
                  {data.storeName || workspace?.storeName}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {active ? (
                    <>
                      <PlanBadge premium={data.plan === "premium"}>{planName(data.plan)}</PlanBadge>
                      <span>
                        {data.billingInterval === "annual" ? t("Yearly", "سنوي") : t("Monthly", "شهري")}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {data.cancelAtPeriodEnd ? t("Available until", "متاح حتى") : t("Renews", "يتجدد")}{" "}
                        {date(data.periodEnd!)}
                      </span>
                    </>
                  ) : trial ? (
                    t("Approved pilot access is active", "وصول تجريبي معتمد ومفعّل")
                  ) : (
                    t(
                      "Prepare your store for free. Choose a plan to activate your assistant.",
                      "جهّز متجرك مجانًا، ثم اختر اشتراكًا لتفعيل المساعد.",
                    )
                  )}
                </div>
              </div>
              {data.plan && (
                <Button
                  variant="outline"
                  className="rounded-xl active:scale-[.98]"
                  disabled={!data.canManage || Boolean(busy)}
                  onClick={() => void start("portal")}
                >
                  {busy === "portal" ? <Spinner /> : <ArrowUpRight className="size-4 rtl:-scale-x-100" />}
                  {t("Manage subscription", "إدارة الاشتراك")}
                </Button>
              )}
            </div>

            {data.plan && !active && !trial && (
              <div className="pb-6">
                <Notice tone="review" icon={AlertCircle}>
                  {canResubscribe
                    ? t("Your paid period has ended. Choose a plan below to restart.", "انتهت الفترة المدفوعة. اختر اشتراكًا أدناه لإعادة التفعيل.")
                    : t(
                        "Your assistant is paused. Manage your subscription or contact Reload before making another payment.",
                        "المساعد متوقف مؤقتًا. راجع الاشتراك أو تواصل مع ريلود قبل دفع مبلغ آخر.",
                      )}
                </Notice>
              </div>
            )}

            {included > 0 && (
              <div className="border-t pt-7">
                <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-end">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {t("Messages left this month", "الرسائل المتبقية هذا الشهر")}
                    </p>
                    <p className="mt-1 flex items-baseline gap-2">
                      <CountUp
                        value={left}
                        className={cn(
                          "font-display text-5xl font-semibold tracking-[-.04em] transition-colors duration-500 sm:text-6xl",
                          tone === "full" && "text-destructive",
                          tone === "low" && "text-review",
                        )}
                      />
                      <span className="text-sm text-muted-foreground tabular-nums">
                        / {included.toLocaleString()}
                      </span>
                    </p>
                    <UsageBar usedShare={usedShare} pendingShare={pendingShare} tone={tone} label={t("Message allowance used", "استخدام رصيد الرسائل")} value={consumed} max={included} />
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <Legend className="bg-foreground">{t(`${(data.used || 0).toLocaleString()} sent`, `${(data.used || 0).toLocaleString()} مرسلة`)}</Legend>
                      {pending > 0 && <Legend className="billing-pending">{t(`${pending} confirming`, `${pending} قيد التأكيد`)}</Legend>}
                      <Legend className="bg-muted-foreground/25">{t(`${left.toLocaleString()} left`, `${left.toLocaleString()} متبقية`)}</Legend>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <Stat
                      label={t("Resets in", "يتجدد بعد")}
                      value={daysLeft === null ? "—" : t(`${daysLeft} ${daysLeft === 1 ? "day" : "days"}`, `${daysLeft} يوم`)}
                      note={data.allowanceEnd ? date(data.allowanceEnd) : undefined}
                    />
                    <Stat
                      label={t("On pace for", "المتوقع هذا الشهر")}
                      value={projected === null ? "—" : projected.toLocaleString()}
                      note={
                        projected === null
                          ? t("Shows after first messages", "يظهر بعد أول رسائل")
                          : projected > included + extra
                            ? t("May run out before reset", "قد ينفد قبل التجديد")
                            : t("Within your allowance", "ضمن رصيدك")
                      }
                      warn={projected !== null && projected > included + extra}
                    />
                  </div>
                </div>

                {extra > 0 && (
                  <div className="billing-enter mt-6 flex items-start gap-3 text-sm">
                    <Plus className="mt-0.5 size-4 shrink-0 text-[var(--foreground)]" />
                    <div className="min-w-0">
                      <p className="font-medium">
                        <CountUp value={extra} /> {t("extra messages ready", "رسالة إضافية جاهزة")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("Used after your monthly allowance. Unused ones carry over.", "تُستخدم بعد الرصيد الشهري، والمتبقي ينتقل للشهر التالي.")}
                      </p>
                    </div>
                  </div>
                )}

                {(exhausted || runningOut) && (
                  <div className="mt-6">
                    <Notice
                      tone={exhausted ? "destructive" : "review"}
                      icon={AlertCircle}
                      title={
                        exhausted
                          ? t("You’ve used this month’s messages", "استخدمت رسائل هذا الشهر")
                          : t("Your messages are running low", "رسائلك أوشكت على الانتهاء")
                      }
                      action={
                        data.canManage && active ? (
                          data.plan === "standard" ? (
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => spotlight("premium")}>
                              {t("Compare plans", "قارن الاشتراكات")}
                              <ArrowRight className="size-3.5 rotate-90" />
                            </Button>
                          ) : data.bundlesAvailable && data.bundlePriceHalalas ? (
                            <Button size="sm" className="rounded-xl" disabled={Boolean(busy)} onClick={() => void start("checkout", "premium", "BUNDLE")}>
                              {t("Add messages", "أضف رسائل")}
                            </Button>
                          ) : null
                        ) : null
                      }
                    >
                      {data.plan === "standard"
                        ? t(
                            exhausted
                              ? "Upgrade to Premium for 2,000 messages a month and keep your assistant replying."
                              : "Upgrade to Premium for 2,000 messages a month before you run out.",
                            exhausted
                              ? "انتقل إلى Premium للحصول على 2,000 رسالة شهريًا ليستمر المساعد في الرد."
                              : "انتقل إلى Premium للحصول على 2,000 رسالة شهريًا قبل نفاد الرصيد.",
                          )
                        : data.bundlesAvailable && data.bundlePriceHalalas
                          ? t("Add extra messages any time. Unused ones carry over.", "أضف رسائل إضافية في أي وقت، والمتبقي ينتقل للشهر التالي.")
                          : t("Contact Reload to arrange more messages.", "تواصل مع ريلود لإضافة رسائل.")}
                    </Notice>
                  </div>
                )}

                {active && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-sm">
                    <p className="text-muted-foreground">
                      {data.billingInterval === "annual"
                        ? t("Paid yearly · messages refresh every month", "دفع سنوي · الرصيد يتجدد شهريًا")
                        : t("Paid monthly · messages refresh every month", "دفع شهري · الرصيد يتجدد شهريًا")}
                    </p>
                    {data.canManage && !data.cancelAtPeriodEnd && (
                      <BillingFrequencyChange
                        storeId={storeId!}
                        interval={data.billingInterval}
                        pending={data.pendingInterval}
                        plan={data.plan!}
                        periodEnd={data.periodEnd!}
                        disabled={Boolean(busy) || Boolean(data.pendingCheckout)}
                        onSaved={() => void load()}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Plans ──────────────────────────────────────────────────── */}
          <div id="billing-plans" className="flex scroll-mt-24 flex-wrap items-end justify-between gap-3 pt-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {hasSubscription ? t("Plans", "الاشتراكات") : t("Choose your plan", "اختر اشتراكك")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Same features every month. Change or cancel any time.", "نفس المزايا كل شهر. غيّر أو ألغِ في أي وقت.")}
              </p>
            </div>
            {!hasSubscription && (
              <Segmented
                label={t("Billing frequency", "مدة الاشتراك")}
                value={interval}
                onChange={setIntervalChoice}
                options={[
                  { value: "monthly", label: t("Monthly", "شهري") },
                  { value: "annual", label: t("Yearly · save 20%", "سنوي · وفر 20٪") },
                ]}
              />
            )}
          </div>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] divide-y border-y md:grid-cols-2 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
            {(["standard", "premium"] as const).map((plan) => {
              const premium = plan === "premium";
              const regular = PRICES[interval][plan];
              const offer = data.offerAvailable && interval === "monthly";
              const first = premium ? 19900 : 9900;
              const shown = offer ? first : regular;
              const selected = data.plan === plan && hasSubscription;
              const perMonth = interval === "annual" ? Math.round(regular / 12) : null;
              const features = [
                premium ? t("2,000 outgoing messages each month", "2,000 رسالة صادرة شهريًا") : t("500 outgoing messages each month", "500 رسالة صادرة شهريًا"),
                t("Return requests and policy checks", "طلبات الإرجاع والتحقق من السياسة"),
                premium
                  ? t("Product questions, order tracking and support tickets", "أسئلة المنتجات، متابعة الطلبات وتذاكر الدعم")
                  : t("Order verification and return case tracking", "التحقق من الطلب ومتابعة الإرجاع"),
                ...(premium ? [t("AI customer support in Arabic and English", "دعم العملاء بالذكاء الاصطناعي بالعربية والإنجليزية")] : []),
                t("Guided setup and merchant dashboard", "إعداد موجّه ولوحة تحكم للمتجر"),
              ];
              return (
                <section
                  key={plan}
                  data-plan={plan}
                  className={cn(
                    "billing-plan group relative flex min-w-0 flex-col py-8 md:px-8 md:first:ps-0 md:last:pe-0",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">{planName(plan)}</h3>
                    {selected ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background">
                        <Check className="size-3" />
                        {t("Your plan", "اشتراكك")}
                      </span>
                    ) : premium ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--foreground)]/30 bg-[var(--foreground)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
                        {t("Includes AI support", "يشمل دعم الذكاء الاصطناعي")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {premium
                      ? t("Support and returns, together on WhatsApp.", "خدمة العملاء والإرجاع معًا على واتساب.")
                      : t("A clear return journey for your customers.", "رحلة إرجاع واضحة لعملائك.")}
                  </p>
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-sm font-medium text-muted-foreground">SAR</span>
                    <CountUp
                      value={shown / 100}
                      decimals={shown % 100 ? 2 : 0}
                      className="font-display text-4xl font-semibold tracking-[-.04em] sm:text-[42px]"
                    />
                    <Swap id={`${interval}-${offer}`} className="text-sm text-muted-foreground">
                      {offer ? t("first month", "للشهر الأول") : interval === "annual" ? t("/ year", "/ سنة") : t("/ month", "/ شهر")}
                    </Swap>
                  </div>
                  <Swap id={`${interval}-${offer}`} block className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground sm:min-h-5">
                    {offer
                      ? t(`Your private first-month offer. Then ${money(regular)}/month. VAT included.`, `عرضك الخاص للشهر الأول، ثم ${money(regular)} شهريًا. شامل الضريبة.`)
                      : perMonth
                        ? t(`Works out to ${money(perMonth)}/month · VAT included`, `ما يعادل ${money(perMonth)} شهريًا · شامل الضريبة`)
                        : t("VAT included · one store", "شامل الضريبة · متجر واحد")}
                  </Swap>
                  <ul className="my-6 space-y-3 text-sm">
                    {features.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", premium ? "bg-[var(--foreground)]/15 text-[var(--foreground)]" : "bg-muted text-foreground")}>
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  {premium && data.plan === "standard" && active && storeId ? (
                    <div className="mt-auto">
                      <BillingUpgrade
                        storeId={storeId}
                        disabled={!data.canManage || Boolean(busy) || Boolean(data.pendingCheckout) || Boolean(data.pendingInterval)}
                        onConfirm={() => void start("checkout", "premium", "UPGRADE")}
                      />
                    </div>
                  ) : (
                    <Button
                      className="mt-auto h-11 w-full rounded-xl transition-transform active:scale-[.98]"
                      variant={premium && !hasSubscription ? "default" : "outline"}
                      disabled={!data.canManage || Boolean(busy) || hasSubscription || Boolean(data.pendingCheckout)}
                      onClick={() => void start("checkout", plan)}
                    >
                      {busy === plan ? <Spinner /> : selected ? <Check className="size-4" /> : null}
                      {selected
                        ? t("Current plan", "الاشتراك الحالي")
                        : hasSubscription
                          ? t("Switch in Manage subscription", "التبديل من إدارة الاشتراك")
                          : t(`Choose ${planName(plan)}`, `اختر ${planName(plan)}`)}
                      {!selected && !hasSubscription && busy !== plan && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />}
                    </Button>
                  )}
                </section>
              );
            })}
          </div>

          {data.plan === "premium" && active && data.bundlesAvailable && data.bundlePriceHalalas && (
            <section className="billing-card flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <MessageSquare className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <h2 className="font-semibold">{t("2,000 extra messages", "2,000 رسالة إضافية")}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {money(data.bundlePriceHalalas)} · {t("One-time. Unused messages carry over.", "لمرة واحدة. المتبقي ينتقل للشهر التالي.")}
                  </p>
                </div>
              </div>
              <Button className="rounded-xl active:scale-[.98]" disabled={!data.canManage || Boolean(busy)} onClick={() => void start("checkout", "premium", "BUNDLE")}>
                {t("Buy extra messages", "شراء رسائل إضافية")}
              </Button>
            </section>
          )}

          {!data.canManage && (
            <p className="text-sm text-muted-foreground">
              {t("Ask your store owner or admin to manage payments.", "اطلب من مالك المتجر أو المسؤول إدارة المدفوعات.")}
            </p>
          )}

          {/* Reassurance: the questions people have right before paying. */}
          <ul className="grid gap-5 sm:grid-cols-3 sm:gap-8">
            {[
              { icon: ShieldCheck, title: t("Secure checkout", "دفع آمن"), text: t("Payments are processed by Stream.", "تتم المدفوعات عبر ستريم.") },
              { icon: RefreshCw, title: t("Cancel any time", "ألغِ في أي وقت"), text: t("Your plan runs to the end of the period.", "يستمر اشتراكك حتى نهاية الفترة.") },
              { icon: Check, title: t("Your setup stays", "إعداداتك محفوظة"), text: t("Policies and knowledge are kept.", "السياسات والمعرفة تبقى محفوظة.") },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          <Faq title={t("How messages are counted", "كيف تُحتسب الرسائل")}>
            {t(
              "Only delivered outgoing messages count. Customer messages and failed sends don’t. Your allowance refreshes every month, even on yearly plans. Standard merchants upgrade for more capacity; Premium merchants can buy extra messages that carry over. Marketing campaigns and shipping charges aren’t included.",
              "تُحتسب الرسائل الصادرة التي تم تسليمها فقط، ولا تُحتسب رسائل العملاء أو الإرسال الفاشل. يتجدد الرصيد كل شهر حتى في الاشتراك السنوي. مشتركو Standard يرقّون لزيادة الرصيد، ومشتركو Premium يمكنهم شراء رسائل إضافية تنتقل للشهر التالي. الحملات التسويقية ورسوم الشحن غير مشمولة.",
            )}
          </Faq>

          {data.payments.length > 0 && (
            <section className="billing-card">
              <h2 className="font-semibold">{t("Payment history", "سجل المدفوعات")}</h2>
              <ul className="mt-3 divide-y border-t">
                {data.payments.map((payment, index) => {
                  const bundle = payment.kind === "BUNDLE";
                  const refunded = payment.refunded_halalas > 0;
                  return (
                    <li key={`${payment.paid_at}-${index}`} className="flex items-center gap-3 py-4 text-sm">
                      {bundle ? <MessageSquare className="size-4 shrink-0 text-muted-foreground" /> : <CreditCard className="size-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{bundle ? t("Extra messages", "رسائل إضافية") : planName(payment.plan)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {date(payment.paid_at)} ·{" "}
                          {bundle ? t("One-time", "لمرة واحدة") : payment.billing_interval === "annual" ? t("Yearly", "سنوي") : t("Monthly", "شهري")}
                        </p>
                      </div>
                      <span className={cn("hidden text-xs sm:inline", refunded ? "text-review" : "text-eligible")}>
                        {refunded ? t("Refunded", "مسترد") : t("Paid", "مدفوع")}
                      </span>
                      <span className="tabular-nums font-medium">{money(payment.amount_halalas)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function PlanBadge({ premium, children }: { premium: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", premium ? "bg-[var(--foreground)]/12 text-[var(--foreground)]" : "bg-muted text-foreground")}>
      {children}
    </span>
  );
}

/** Sent (solid), confirming (striped), remaining (track). Grows in once. */
function UsageBar({ usedShare, pendingShare, tone, label, value, max }: { usedShare: number; pendingShare: number; tone: "calm" | "low" | "full"; label: string; value: number; max: number }) {
  const reduce = useReducedMotion();
  const fill = tone === "full" ? "bg-destructive" : tone === "low" ? "bg-review" : "bg-foreground";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.min(value, max)}
      aria-valuemin={0}
      aria-valuemax={max}
      className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted"
    >
      <motion.span
        className={cn("h-full transition-colors duration-500", fill)}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${usedShare * 100}%` }}
        transition={{ ...TWEEN, duration: reduce ? 0 : 0.9 }}
      />
      {pendingShare > 0 && (
        <motion.span
          className="billing-pending h-full"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pendingShare * 100}%` }}
          transition={{ ...TWEEN, duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 0.2 }}
        />
      )}
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span aria-hidden="true" className={cn("size-2 rounded-full", className)} />
      {children}
    </span>
  );
}

function Stat({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className="border-s ps-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums transition-colors duration-500", warn && "text-review")}>{value}</p>
      {note && <p className={cn("mt-0.5 text-[11px] leading-4 text-muted-foreground", warn && "text-review")}>{note}</p>}
    </div>
  );
}

function Notice({
  tone,
  icon: Icon,
  title,
  children,
  action,
  spin,
}: {
  tone: "review" | "eligible" | "destructive" | "muted";
  icon: typeof AlertCircle;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  spin?: boolean;
}) {
  const reduce = useReducedMotion();
  const styles = {
    review: "border-review [&_.notice-icon]:text-review",
    eligible: "border-eligible [&_.notice-icon]:text-eligible",
    destructive: "border-destructive [&_.notice-icon]:text-destructive",
    muted: "border-border [&_.notice-icon]:text-muted-foreground",
  }[tone];
  return (
    <motion.div
      role="status"
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TWEEN}
      className={cn("flex flex-wrap items-start gap-3 border-s-2 py-0.5 ps-4 text-sm sm:flex-nowrap", styles)}
    >
      <Icon className={cn("notice-icon mt-0.5 size-4 shrink-0", spin && "animate-spin motion-reduce:animate-none")} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        <p className={cn("leading-6 text-muted-foreground", title && "mt-0.5")}>{children}</p>
      </div>
      {action && <div className="basis-full ps-7 sm:basis-auto sm:shrink-0 sm:ps-0">{action}</div>}
    </motion.div>
  );
}

/** Shaped like the real page so nothing jumps when data arrives. */
function BillingSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="flex flex-col gap-6">
      <div className="space-y-3 pb-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-6 border-t pt-7 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-14 w-36" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
      <div className="grid gap-10 border-t pt-8 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

/** Cross-fades text when it changes, instead of swapping it in place. */
function Swap({ id, children, className, block }: { id: string; children: React.ReactNode; className?: string; block?: boolean }) {
  const reduce = useReducedMotion();
  const Tag = block ? motion.p : motion.span;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Tag
        key={id}
        className={cn(!block && "inline-block", className)}
        initial={reduce ? false : { opacity: 0, y: 4, filter: "blur(2px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduce ? undefined : { opacity: 0, y: -4, filter: "blur(2px)" }}
        transition={{ ...TWEEN, duration: 0.18 }}
      >
        {children}
      </Tag>
    </AnimatePresence>
  );
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  return (
    <section className="border-y text-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-5 text-start font-medium outline-none transition-colors hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {title}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ ...TWEEN, duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="pb-5 leading-6 text-muted-foreground">{children}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
