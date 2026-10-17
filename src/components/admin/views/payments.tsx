"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Metric, Segmented, TWEEN } from "@/components/desk/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Payment = {
  invoice_id: string;
  store_id: string;
  plan: string;
  billing_interval: string;
  kind: string;
  amount_halalas: number;
  refunded_halalas: number;
  paid_at: string;
};
type Checkout = {
  id: string;
  store_id: string;
  plan: string;
  billing_interval: string;
  status: string;
  amount_halalas: number;
  created_at: string;
  expires_at: string;
};
type Data = {
  environment: string;
  events: {
    id: string;
    event_type: string;
    received_at: string;
    processing_status: string;
    processing_attempts: number;
  }[];
  checkedAt: string;
  payments: Payment[];
  checkouts: Checkout[];
  stores: { id: string; name: string }[];
  accounts: {
    store_id: string;
    status: string;
    plan: string;
    period_end: string;
    billing_interval: string;
    pending_interval: string | null;
    cancel_at_period_end: boolean;
  }[];
};
export function PaymentsView() {
  const { t, isArabic } = useLanguage();
  const reduce = useReducedMotion();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"payments" | "waiting" | "renewals">(
    "payments",
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/billing", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const j = await r.json();
      if (n === seq.current) {
        setData(j);
        setError(false);
      }
    } catch {
      if (n === seq.current) setError(true);
    } finally {
      if (n === seq.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => {
      seq.current++;
      clearInterval(timer);
    };
  }, [load]);
  const money = (n: number) =>
    new Intl.NumberFormat(isArabic ? "ar-SA-u-nu-latn" : "en-SA", {
      style: "currency",
      currency: "SAR",
    }).format(n / 100);
  const date = (s: string) =>
    new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(s));
  const name = (id: string) =>
    data?.stores.find((s) => s.id === id)?.name || t("Store", "متجر");
  const frequency = (value: string) =>
    value === "annual" ? t("Annual", "سنوي") : t("Monthly", "شهري");
  const waiting = data?.checkouts.filter((c) => c.status !== "FAILED") || [];
  const paid =
    data?.payments.reduce(
      (n, p) => n + p.amount_halalas - p.refunded_halalas,
      0,
    ) || 0;
  const active =
    data?.accounts.filter(
      (a) =>
        ["ACTIVE", "PAST_DUE", "CANCELED"].includes(a.status) &&
        Date.parse(a.period_end) > Date.now(),
    ).length || 0;
  const rows =
    tab === "payments"
      ? (data?.payments || []).map((p) => ({
          id: p.invoice_id,
          store: p.store_id,
          title: `${p.plan === "premium" ? "Premium" : "Standard"} · ${frequency(p.billing_interval)}`,
          at: p.paid_at,
          amount: p.amount_halalas,
          label: p.refunded_halalas
            ? t("Refund recorded", "استرداد مسجل")
            : t("Payment confirmed", "دفعة مؤكدة"),
          tone: p.refunded_halalas ? "review" : "eligible",
          detail:
            p.kind === "UPGRADE"
              ? t(
                  "Paid upgrade. Original renewal date retained.",
                  "ترقية مدفوعة. موعد التجديد الأصلي محفوظ.",
                )
              : t(
                  "Verified with Stream. VAT included.",
                  "مؤكدة لدى ستريم. شاملة الضريبة.",
                ),
          refund: p.refunded_halalas,
        }))
      : tab === "waiting"
        ? (data?.checkouts || []).map((c) => ({
            id: c.id,
            store: c.store_id,
            title: `${c.plan === "premium" ? "Premium" : "Standard"} · ${frequency(c.billing_interval)}`,
            at: c.created_at,
            amount: c.amount_halalas,
            label:
              c.status === "FAILED"
                ? t("Checkout not completed", "لم تكتمل العملية")
                : c.status === "REVIEW" ||
                    Date.parse(c.expires_at) <= Date.now()
                  ? t("Needs checking", "تحتاج تحقق")
                  : t("Waiting for payment", "بانتظار الدفع"),
            tone: c.status === "FAILED" ? "muted" : "review",
            detail:
              c.status === "FAILED"
                ? t(
                    "No access was granted by this checkout.",
                    "لم تُفعّل هذه العملية وصولًا.",
                  )
                : t(
                    "Check provider records before asking the merchant to pay again. Waiting does not mean a payment failed.",
                    "تحقق من سجلات المزود قبل طلب دفع جديد. الانتظار لا يعني فشل الدفع.",
                  ),
            refund: 0,
          }))
        : (data?.accounts || [])
            .filter((a) => a.period_end)
            .map((a) => ({
              id: a.store_id,
              store: a.store_id,
              title: `${a.plan === "premium" ? "Premium" : "Standard"} · ${frequency(a.billing_interval)}`,
              at: a.period_end,
              amount: null,
              label:
                a.cancel_at_period_end || a.status === "CANCELED"
                  ? t("Renewal stopped", "التجديد متوقف")
                  : a.status === "FROZEN"
                    ? t("Paused", "متوقف مؤقتًا")
                    : Date.parse(a.period_end) <= Date.now()
                      ? t("Paid period ended", "انتهت الفترة المدفوعة")
                      : t("Next renewal", "التجديد القادم"),
              tone:
                a.status === "FROZEN" || Date.parse(a.period_end) <= Date.now()
                  ? "review"
                  : "muted",
              detail: a.pending_interval
                ? t(
                    `Requested next cycle: ${a.pending_interval}. No extra paid time until payment is verified.`,
                    `مدة التجديد المطلوبة: ${frequency(a.pending_interval)}. لا تمديد دون دفعة مؤكدة.`,
                  )
                : t(
                    "This is the paid-through date. Monthly message resets are separate from annual renewal.",
                    "هذا آخر يوم مدفوع. تجدد الرسائل الشهرية مستقل عن التجديد السنوي.",
                  ),
              refund: 0,
            }));
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" role="status">
          {data?.environment === "sandbox"
            ? t("Sandbox · no real charges", "تجريبي · لا مبالغ فعلية")
            : t("Live billing", "الفوترة الفعلية")}{" "}
          · {t("Refreshes every 15 seconds", "يتحدث كل 15 ثانية")}
          {data &&
            ` · ${t("Updated", "آخر تحديث")} ${new Date(data.checkedAt).toLocaleTimeString(isArabic ? "ar-SA" : "en-GB")}`}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw
            className={cn(
              "size-4",
              busy && "animate-spin motion-reduce:animate-none",
            )}
          />
          {t("Refresh", "تحديث")}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-review/30 p-4 text-sm text-review"
        >
          {t(
            "Could not refresh payments. Displayed records may be out of date. Retry above.",
            "تعذّر تحديث المدفوعات. السجلات المعروضة قديمة؛ أعد المحاولة.",
          )}
        </p>
      )}
      {!data && !error ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        data && (
          <>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
              <Metric
                label={t("Net recorded payments", "صافي الدفعات المسجلة")}
                value={paid / 100}
                decimals={2}
                suffix=" SAR"
                note={t(
                  "Latest 200 payments, after recorded refunds",
                  "أحدث 200 دفعة بعد الاستردادات المسجلة",
                )}
              />
              <Metric
                label={t("Stores with paid time", "متاجر بفترة مدفوعة")}
                value={active}
                note={t(
                  "Within the current paid period",
                  "ضمن الفترة المدفوعة",
                )}
              />
              <Metric
                label={t("Waiting checkouts", "عمليات بانتظار التحقق")}
                value={waiting.length}
                note={t(
                  "Needs payment or confirmation",
                  "تحتاج دفعًا أو تأكيدًا",
                )}
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {t(
                "Latest 200 payments and checkouts; up to 1,000 subscriptions. Net payments include VAT, subtract recorded refunds, and are not profit. No card or customer contact details are shown.",
                "أحدث 200 دفعة وعملية دفع وحتى 1,000 اشتراك. الصافي يشمل الضريبة ويخصم الاستردادات المسجلة، وليس ربحًا. لا تُعرض بيانات البطاقات أو جهات اتصال العملاء.",
              )}
            </p>
            {data.events?.length > 0 && (
              <details className="rounded-2xl border border-review/25 bg-review/5 p-5">
                <summary className="cursor-pointer text-sm font-medium text-review">
                  {t(
                    `${data.events.length} provider updates waiting for confirmation`,
                    `${data.events.length} تحديثًا من المزود بانتظار التأكيد`,
                  )}
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {t(
                    "These updates are waiting for verification or staff review. Check Stream before requesting another payment. Latest 50 updates shown.",
                    "هذه التحديثات بانتظار التحقق أو مراجعة الفريق. تحقق من ستريم قبل طلب دفع آخر. يُعرض أحدث 50 تحديثًا.",
                  )}
                </p>
                <div className="mt-3 divide-y">
                  {data.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
                    >
                      <span>
                        {event.event_type.includes("REFUND")
                          ? t("Refund update", "تحديث استرداد")
                          : event.event_type.includes("SUBSCRIPTION")
                            ? t("Subscription update", "تحديث اشتراك")
                            : t("Payment update", "تحديث دفع")}{" "}
                        ·{" "}
                        {event.processing_status === "FAILED"
                          ? t("Needs checking", "تحتاج تحقق")
                          : t("Waiting", "بانتظار التحقق")}
                      </span>
                      <span className="text-muted-foreground">
                        {date(event.received_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <Segmented
              label={t("Payment view", "عرض المدفوعات")}
              value={tab}
              onChange={(v) => {
                setTab(v);
                setExpanded(null);
              }}
              options={[
                { value: "payments", label: t("Payments", "الدفعات") },
                { value: "waiting", label: t("Checkouts", "عمليات الدفع") },
                { value: "renewals", label: t("Renewals", "التجديدات") },
              ]}
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={tab}
                initial={{ opacity: 0, y: reduce ? 0 : 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ ...TWEEN, duration: reduce ? 0 : 0.22 }}
                className="overflow-hidden rounded-2xl border bg-card"
              >
                {rows.length === 0 ? (
                  <div className="p-8 text-center">
                    <CreditCard className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-3 font-medium">
                      {t("No records yet", "لا سجلات بعد")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(
                        "Payments appear here after verified checkout activity.",
                        "تظهر السجلات بعد نشاط الدفع المؤكد.",
                      )}
                    </p>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="border-b last:border-0">
                      <button
                        type="button"
                        aria-expanded={expanded === row.id}
                        className="flex w-full min-w-0 items-start gap-3 p-5 text-start transition-colors hover:bg-muted/30 active:bg-muted/50"
                        onClick={() =>
                          setExpanded(expanded === row.id ? null : row.id)
                        }
                      >
                        <span
                          className={cn(
                            "mt-1 flex size-8 shrink-0 items-center justify-center rounded-full",
                            row.tone === "eligible"
                              ? "bg-eligible/10 text-eligible"
                              : row.tone === "review"
                                ? "bg-review/10 text-review"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {row.tone === "eligible" ? (
                            <Check className="size-4" />
                          ) : (
                            <Clock3 className="size-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate font-medium"
                            dir="auto"
                          >
                            {name(row.store)}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {row.title}
                          </span>
                          <span className="mt-2 block text-xs">
                            {row.label}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          <span className="block text-sm tabular-nums">
                            {row.amount !== null ? money(row.amount) : ""}
                          </span>
                          <span className="mt-1 block max-w-32 text-xs text-muted-foreground">
                            {date(row.at)}
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            "mt-1 size-4 shrink-0 transition-transform duration-200",
                            expanded === row.id && "rotate-180",
                          )}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded === row.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              ...TWEEN,
                              duration: reduce ? 0 : 0.25,
                            }}
                            className="overflow-hidden"
                          >
                            <div className="mx-5 mb-5 rounded-xl bg-muted/40 p-4 text-sm">
                              <p className="leading-6 text-muted-foreground">
                                {row.detail}
                              </p>
                              {row.refund > 0 && (
                                <p className="mt-2">
                                  {t("Refunded: ", "المسترد: ")}
                                  {money(row.refund)}
                                </p>
                              )}
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="mt-3"
                              >
                                <Link href={`/admin/workspaces/${row.store}`}>
                                  {t(
                                    "Open support workspace",
                                    "فتح مساحة الدعم",
                                  )}
                                </Link>
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </motion.section>
            </AnimatePresence>
          </>
        )
      )}
    </div>
  );
}
