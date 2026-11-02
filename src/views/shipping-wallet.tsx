"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Wallet,
  TriangleAlert,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { Panel, Metric, TWEEN, EmptyState } from "@/components/desk/primitives";
import { PageHeader } from "@/components/desk/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Snapshot = {
  environment: "sandbox";
  currency: "SAR";
  onHold: boolean;
  availableHalalas: number;
  reservedHalalas: number;
  spentHalalas: number;
  canManage: boolean;
  pendingTopup: null | {
    status: string;
    amountHalalas: number;
    expiresAt: string;
    createdAt: string;
  };
  entries: Array<{
    kind: string;
    availableDelta: number;
    reservedDelta: number;
    spentDelta: number;
    createdAt: string;
  }>;
};
export function ShippingWallet() {
  const { workspace } = useAuth(),
    { t, isArabic } = useLanguage(),
    reduce = useReducedMotion();
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState<string | null>(null),
    [amount, setAmount] = useState("100"),
    [busy, setBusy] = useState<string | null>(null),
    [returned, setReturned] = useState(false),
    [checked, setChecked] = useState(false);
  const active = useRef<AbortController | null>(null),
    storeId = workspace?.storeId;
  const currentStore = useRef(storeId);
  currentStore.current = storeId;
  const money = (v: number) =>
    new Intl.NumberFormat(isArabic ? "ar-SA" : "en-SA", {
      style: "currency",
      currency: "SAR",
    }).format(v / 100);
  const load = useCallback(async () => {
    if (!storeId) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    try {
      const response = await fetch(`/api/shipping/wallet?store=${storeId}`, {
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30000),
        ]),
      });
      const value = await response.json();
      if (!response.ok) {
        if (response.status === 403) setData(null);
        throw new Error(value.error || "unavailable");
      }
      if (active.current === controller) {
        setData(value);
        setError(null);
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "unavailable");
    }
  }, [storeId]);
  useEffect(() => {
    setData(null);
    setError(null);
    void load();
    return () => {
      active.current?.abort();
    };
  }, [load]);
  useEffect(() => {
    setReturned(new URLSearchParams(window.location.search).has("result"));
  }, []);
  async function act(action: "topup" | "sync" | "resume" | "recover") {
    if (busy || !storeId) return;
    setError(null);
    setChecked(false);
    const digits = amount.replace(/[٠-٩۰-۹]/g, (c) =>
      String(c.charCodeAt(0) - (c <= "٩" ? 0x660 : 0x6f0)),
    );
    const number = Number(digits);
    if (
      action === "topup" &&
      (!/^\d+(?:\.\d{1,2})?$/.test(digits) || number < 1 || number > 100000)
    ) {
      setError("invalid_amount");
      return;
    }
    setBusy(action);
    try {
      const response = await fetch("/api/shipping/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          action,
          ...(action === "topup"
            ? { amountHalalas: Math.round(number * 100) }
            : {}),
        }),
        signal: AbortSignal.timeout(110000),
      });
      const value = await response.json();
      if (currentStore.current !== storeId) return;
      if (!response.ok) throw new Error(value.error || "unavailable");
      if ((action === "topup" || action === "resume") && value.url) {
        const url = new URL(value.url);
        if (
          url.protocol !== "https:" ||
          !(
            url.hostname === "streampay.sa" ||
            url.hostname.endsWith(".streampay.sa")
          ) ||
          url.username ||
          url.password ||
          url.port ||
          url.hash
        )
          throw new Error("unavailable");
        window.location.assign(url.href);
        return;
      }
      setChecked(action !== "recover");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setBusy(null);
    }
  }
  const errorText: Record<string, string> = {
    disabled: t(
      "Shipping wallet tests are not enabled here yet.",
      "لم تُفعّل اختبارات محفظة الشحن هنا بعد.",
    ),
    sandbox_account_required: t(
      "This sandbox is limited to Reload’s authorized test accounts.",
      "تقتصر البيئة التجريبية على حسابات اختبار ريلود المعتمدة.",
    ),
    access_denied: t(
      "Sign in to this store with permission to manage shipping funds.",
      "سجّل الدخول إلى هذا المتجر بحساب مخوّل لإدارة رصيد الشحن.",
    ),
    invalid_amount: t(
      "Enter an amount from SAR 1 to SAR 100,000, with up to two decimal places.",
      "أدخل مبلغًا من 1 إلى 100,000 ريال، وبحد أقصى منزلتان عشريتان.",
    ),
    topup_pending: t(
      "An earlier top-up needs checking. Use Check payment before starting another payment.",
      "تحتاج عملية شحن رصيد سابقة إلى تحقق. اختر التحقق من الدفع قبل بدء عملية أخرى.",
    ),
    topup_unavailable: t(
      "An active Premium sandbox subscription is needed, or an earlier payment needs checking. Your existing balance is unchanged.",
      "يلزم اشتراك بريميوم تجريبي ساري، أو التحقق من عملية دفع سابقة. لم يتغير رصيدك الحالي.",
    ),
  };
  const pending =
    data?.pendingTopup &&
    !["PAID", "EXPIRED_UNPAID"].includes(data.pendingTopup.status);
  const resumable =
    data?.pendingTopup?.status === "READY" &&
    Date.parse(data.pendingTopup.expiresAt) > Date.now();
  const expired = data?.pendingTopup?.status === "READY" && !resumable;
  const labels: Record<string, string> = {
    TOPUP: t("Funds added", "إضافة رصيد"),
    RESERVE: t("Reserved for shipping", "حجز مبلغ للشحن"),
    SETTLE: t("Shipping charge confirmed", "تأكيد رسوم الشحن"),
    RELEASE: t("Reserved funds released", "إتاحة المبلغ المحجوز"),
    PROVIDER_CREDIT: t("OTO credit received", "استلام رصيد مرتجع من أوتو"),
  };
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader icon={Wallet} title={t("Shipping balance", "رصيد الشحن")}>
        {t(
          "Keep shipping funds separate from your subscription.",
          "تابع رصيد الشحن منفصلًا عن اشتراكك.",
        )}
      </PageHeader>
      <div className="flex items-start gap-3 rounded-2xl border border-review/25 bg-review/10 p-4 text-sm leading-6">
        <ShieldCheck className="mt-1 size-4 shrink-0" />
        <p>
          {t(
            "Sandbox only. Use test payments; this balance cannot pay for live shipping. No recurring subscription or Reload shipping fee is added.",
            "بيئة تجريبية فقط. استخدم مدفوعات الاختبار؛ لا يصلح هذا الرصيد للشحن الفعلي. لا نضيف اشتراكًا متجددًا أو رسوم شحن لريلود.",
          )}
        </p>
      </div>
      {returned && (
        <div className="rounded-2xl border p-4 text-sm leading-6">
          {t(
            "You’re back from checkout. Returning here does not confirm payment. Select Check payment to verify with Stream Pay.",
            "عدت من صفحة الدفع. العودة وحدها لا تؤكد الدفع. اختر التحقق من الدفع لمراجعة النتيجة لدى ستريم باي.",
          )}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6"
        >
          <TriangleAlert className="mt-1 size-4 shrink-0 text-destructive" />
          <p>
            {errorText[error] ||
              t(
                "We couldn’t confirm this step. Your balance is not changed by an unconfirmed payment. Refresh or check payment before paying again.",
                "تعذر تأكيد هذه الخطوة. لا يُضاف رصيد مقابل دفع غير مؤكد. حدّث الصفحة أو تحقق من الدفع قبل المحاولة مجددًا.",
              )}
          </p>
        </div>
      )}
      {!data && !error ? (
        <div
          aria-label={t("Loading shipping balance", "تحميل رصيد الشحن")}
          className="grid gap-3 sm:grid-cols-3"
        >
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : null}
      {data && (
        <>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
            <Metric
              label={t("Available", "متاح")}
              value={data.availableHalalas / 100}
              decimals={2}
              suffix={t("SAR", "ر.س")}
              note={t("Ready for test shipping", "متاح للشحن التجريبي")}
            />
            <Metric
              label={t("Reserved", "محجوز")}
              value={data.reservedHalalas / 100}
              decimals={2}
              suffix={t("SAR", "ر.س")}
              note={t("Held for pending bookings", "محجوز لحجوزات معلقة")}
            />
            <Metric
              label={t("Net shipping spent", "صافي مصروفات الشحن")}
              value={data.spentHalalas / 100}
              decimals={2}
              suffix={t("SAR", "ر.س")}
              note={t(
                "Confirmed costs less credits",
                "التكاليف المؤكدة ناقص الأرصدة المرتجعة",
              )}
            />
          </div>
          {data.onHold && (
            <div className="rounded-2xl border border-review/30 bg-review/10 p-4 text-sm leading-6">
              {t(
                "Shipping funds need review following a payment refund. New bookings are paused. Contact Reload; do not pay again to remove this hold.",
                "يحتاج رصيد الشحن إلى مراجعة بعد استرداد دفعة. الحجوزات الجديدة متوقفة. تواصل مع ريلود؛ لا تدفع مجددًا لإزالة هذا التعليق.",
              )}
            </div>
          )}
          <Panel
            title={t("Add test funds", "إضافة رصيد تجريبي")}
            subtitle={t(
              "For active Premium test stores. This is a one-time payment; funds appear after payment is verified.",
              "للمتاجر التجريبية ذات اشتراك بريميوم الساري. دفعة واحدة، ويظهر الرصيد بعد التحقق من الدفع.",
            )}
          >
            {data.canManage && !pending && !data.onHold ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("topup");
                }}
              >
                <div className="flex flex-wrap gap-2">
                  {[100, 250, 500].map((v) => (
                    <Button
                      key={v}
                      type="button"
                      variant={amount === String(v) ? "default" : "outline"}
                      size="sm"
                      disabled={!!busy || !!pending || data.onHold}
                      onClick={() => setAmount(String(v))}
                    >
                      {money(v * 100)}
                    </Button>
                  ))}
                </div>
                <div className="max-w-sm space-y-2">
                  <label
                    htmlFor="shipping-topup-amount"
                    className="text-sm font-medium"
                  >
                    {t("Amount (SAR)", "المبلغ (ريال)")}
                  </label>
                  <Input
                    id="shipping-topup-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    maxLength={10}
                    required
                    disabled={!!busy || !!pending || data.onHold}
                    className="h-11 rounded-xl"
                    aria-describedby="shipping-topup-help"
                  />
                </div>
                <p
                  id="shipping-topup-help"
                  className="text-xs leading-5 text-muted-foreground"
                >
                  {t(
                    "SAR 100 paid adds SAR 100 of test shipping credit. It does not buy a plan or extra WhatsApp messages.",
                    "دفع 100 ريال يضيف 100 ريال إلى رصيد الشحن التجريبي. لا يشتري باقة أو رسائل واتساب إضافية.",
                  )}
                </p>
                <Button
                  disabled={!!busy || !!pending || data.onHold}
                  type="submit"
                >
                  {busy === "topup" ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  {busy === "topup"
                    ? t("Preparing secure checkout…", "جارٍ تجهيز الدفع الآمن…")
                    : t(
                        "Continue to test checkout",
                        "متابعة إلى الدفع التجريبي",
                      )}
                </Button>
              </form>
            ) : data.canManage ? (
              <div className="space-y-3 text-sm leading-6" role="status">
                <p className="font-medium">
                  {data.onHold
                    ? t(
                        "Your shipping balance needs review",
                        "رصيد الشحن بحاجة إلى مراجعة",
                      )
                    : expired
                      ? t(
                          "Your earlier checkout has expired",
                          "انتهت صلاحية صفحة الدفع السابقة",
                        )
                      : resumable
                        ? t(
                            "Continue your saved payment",
                            "تابع عملية الدفع المحفوظة",
                          )
                        : t(
                            "We need to check your earlier payment",
                            "نحتاج إلى التحقق من دفعتك السابقة",
                          )}
                </p>
                <p className="text-muted-foreground">
                  {data.onHold
                    ? t(
                        "Contact Reload to review the refund hold. Making another payment will not remove it.",
                        "تواصل مع ريلود لمراجعة تعليق الرصيد بعد الاسترداد. لن تزيل دفعة جديدة هذا التعليق.",
                      )
                    : resumable
                      ? t(
                          "A payment for this store is already saved. Continue it below instead of starting another payment.",
                          "توجد عملية دفع محفوظة لهذا المتجر. تابعها أدناه بدلًا من بدء دفعة أخرى.",
                        )
                      : expired
                        ? t(
                            "If you have not submitted a payment, select Start fresh payment below. We’ll check that the old checkout is closed and unpaid before letting you choose a new amount. If you already tried paying, select Check payment first.",
                            "إذا لم ترسل دفعة، اختر بدء دفعة جديدة أدناه. سنتحقق من إغلاق العملية السابقة وعدم تحصيل مبلغ قبل اختيار مبلغ جديد. إذا حاولت الدفع بالفعل، اختر التحقق من الدفع أولًا.",
                          )
                        : t(
                            "Select Check payment below before paying again. An uncertain payment stays saved for review to help prevent duplicate payments.",
                            "اختر التحقق من الدفع أدناه قبل الدفع مجددًا. تبقى العملية غير المؤكدة محفوظة للمراجعة لتجنب تكرار الدفع.",
                          )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(
                  "A store owner or admin can add shipping funds.",
                  "يمكن لمالك المتجر أو المسؤول إضافة رصيد الشحن.",
                )}
              </p>
            )}
          </Panel>
          <Panel
            title={
              pending
                ? t("Payment needs checking", "الدفع بحاجة إلى تحقق")
                : t("Check your latest payment", "تحقق من آخر دفعة")
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 text-sm leading-6">
                {pending ? (
                  <>
                    <p>{money(data.pendingTopup!.amountHalalas)}</p>
                    <p className="text-muted-foreground">
                      {t(
                        "Your top-up is saved. It has not been credited yet. Check it before starting another payment.",
                        "عملية شحن الرصيد محفوظة ولم يُضف المبلغ بعد. تحقق منها قبل بدء دفعة أخرى.",
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {t(
                      "Verify with Stream Pay if a payment has not appeared yet.",
                      "تحقق لدى ستريم باي إذا لم تظهر دفعتك بعد.",
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {data.canManage &&
                  data.pendingTopup?.status === "READY" &&
                  Date.parse(data.pendingTopup.expiresAt) > Date.now() && (
                    <Button
                      disabled={!!busy || data.onHold}
                      onClick={() => void act("resume")}
                    >
                      {t(
                        "Continue saved checkout",
                        "متابعة عملية الدفع المحفوظة",
                      )}
                    </Button>
                  )}
                {data.canManage && expired && !data.onHold && (
                  <Button disabled={!!busy} onClick={() => void act("recover")}>
                    {busy === "recover"
                      ? t(
                          "Checking old checkout…",
                          "جارٍ التحقق من العملية السابقة…",
                        )
                      : t("Start fresh payment", "بدء دفعة جديدة")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => void load()}
                  aria-label={t("Refresh shipping balance", "تحديث رصيد الشحن")}
                >
                  <RefreshCw className="size-4" />
                </Button>
                {data.canManage && (
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => void act("sync")}
                  >
                    {busy === "sync" && (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    )}
                    {busy === "sync"
                      ? t("Checking…", "جارٍ التحقق…")
                      : t("Check payment", "التحقق من الدفع")}
                  </Button>
                )}
              </div>
            </div>
            <AnimatePresence>
              {checked && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={TWEEN}
                  className="mt-3 flex gap-2 text-sm"
                >
                  <Check className="size-4" />
                  {t(
                    "Check finished. Only verified payments are added; pending payments stay unchanged.",
                    "اكتمل التحقق. تُضاف المدفوعات المؤكدة فقط، وتبقى الدفعات المعلقة دون تغيير.",
                  )}
                </motion.p>
              )}
            </AnimatePresence>
          </Panel>
          <Panel
            title={t("Shipping history", "سجل الشحن")}
            subtitle={t(
              "Recent confirmed balance movements. No customer payment or subscription records are mixed in.",
              "آخر الحركات المؤكدة للرصيد، منفصلة عن مدفوعات العملاء والاشتراكات.",
            )}
          >
            {data.entries.length ? (
              <ul className="divide-y">
                {data.entries.map((entry, i) => (
                  <li
                    key={`${entry.createdAt}-${i}`}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <p>
                        {labels[entry.kind] ||
                          t("Shipping movement", "حركة شحن")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString(
                          isArabic ? "ar-SA" : "en-GB",
                        )}
                      </p>
                    </div>
                    <span className="font-medium">
                      <bdi>
                        {money(
                          entry.kind === "SETTLE"
                            ? entry.spentDelta
                            : entry.kind === "RESERVE"
                              ? entry.reservedDelta
                              : entry.availableDelta,
                        )}
                      </bdi>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Wallet}
                title={t("No shipping movements yet", "لا توجد حركات شحن بعد")}
                text={t(
                  "Your first verified top-up will appear here.",
                  "ستظهر أول عملية إضافة رصيد مؤكدة هنا.",
                )}
              />
            )}
          </Panel>
        </>
      )}
      <Link
        href="/app/billing"
        className="inline-flex text-sm text-muted-foreground underline underline-offset-4"
      >
        {t("Go to subscription billing", "الانتقال إلى فوترة الاشتراك")}
      </Link>
    </div>
  );
}
