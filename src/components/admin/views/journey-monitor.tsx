"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Store,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  FilterChip,
  Metric,
  Panel,
  Segmented,
  TWEEN,
} from "@/components/desk/primitives";
import { useLanguage } from "@/components/language-provider";
import {
  checkoutMonitor,
  diagnosticLabel,
  eventLabel,
  journeyReport,
  journeyStatus,
  nextAction,
  type CheckoutMonitor,
  type CheckoutRecord,
  type JourneyStatus,
} from "@/lib/checkout-monitor";
import { cn } from "@/lib/utils";
import { ActivityView } from "./operations";
import type { AdminData } from "../types";
import type { Labels } from "../use-labels";

const tones: Record<JourneyStatus, string> = {
  unconfirmed: "text-amber-800 dark:text-review bg-review/10",
  waiting: "text-amber-800 dark:text-review bg-review/10",
  failed: "text-destructive bg-destructive/10",
  done: "text-emerald-800 dark:text-eligible bg-eligible/10",
};
const dots: Record<JourneyStatus, string> = {
  unconfirmed: "bg-review",
  waiting: "bg-review",
  failed: "bg-destructive",
  done: "bg-eligible",
};
function statusText(status: JourneyStatus, ar: boolean) {
  return {
    unconfirmed: ["Unconfirmed", "غير مؤكد"],
    waiting: ["Waiting", "بانتظار الإجراء"],
    failed: ["Failed", "تعذّر"],
    done: ["Payment confirmed", "الدفع مؤكد"],
  }[status][ar ? 1 : 0];
}
function relative(at: string, now: number, ar: boolean) {
  const seconds = Math.round((Date.parse(at) - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(ar ? "ar" : "en", {
    numeric: "auto",
  });
  return Math.abs(seconds) < 60
    ? rtf.format(0, "minute")
    : Math.abs(seconds) < 3600
      ? rtf.format(Math.round(seconds / 60), "minute")
      : Math.abs(seconds) < 86400
        ? rtf.format(Math.round(seconds / 3600), "hour")
        : rtf.format(Math.round(seconds / 86400), "day");
}
function stamp(at: string, ar: boolean) {
  return new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-gregory" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(at));
}

export function CheckoutJourneyMonitor() {
  const { t, isArabic: ar } = useLanguage();
  const [data, setData] = useState<CheckoutMonitor | null>(null),
    [failed, setFailed] = useState(false),
    [denied, setDenied] = useState(false),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now()),
    [filter, setFilter] = useState<"all" | JourneyStatus>("all");
  const active = useRef<AbortController | null>(null);
  const accessLost = useRef(false);
  const clock = useRef<{ server: number; received: number } | null>(null);
  const load = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/admin/journeys", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        if (active.current === controller) {
          accessLost.current = true;
          setDenied(true);
          setData(null);
          setFailed(true);
        }
        return;
      }
      if (!response.ok) throw new Error("unavailable");
      const snapshot = checkoutMonitor(await response.json());
      if (active.current === controller) {
        accessLost.current = false;
        setDenied(false);
        setData(snapshot);
        setFailed(false);
        clock.current = {
          server: Date.parse(snapshot.checked_at),
          received: performance.now(),
        };
        setNow(clock.current.server);
      }
    } catch {
      if (active.current === controller) setFailed(true);
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }, []);
  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !accessLost.current) {
        if (clock.current)
          setNow(
            clock.current.server + performance.now() - clock.current.received,
          );
        void load();
      }
    }, 15000);
    const visible = () => {
      if (document.visibilityState === "visible" && !accessLost.current)
        void load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      const pending = active.current;
      active.current = null;
      pending?.abort();
    };
  }, [load]);
  const records = data?.records ?? [];
  const visible = records.filter(
    (r) =>
      filter === "all" || journeyStatus(r, data?.blocked ?? false) === filter,
  );
  const categories = ["unconfirmed", "waiting", "failed", "done"] as const;
  return (
    <div className="space-y-6" data-checkout-monitor>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck className="size-3" />
            {t(
              "Development tests · owner access",
              "اختبارات التطوير · للمالكين",
            )}
          </span>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">
            {t("Checkout journeys", "رحلات إتمام الشراء")}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {t(
              "See the saved steps, what needs attention and the next safe action.",
              "تابع الخطوات المسجلة وما يحتاج مراجعة والخطوة الآمنة التالية.",
            )}
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 rounded-xl active:scale-[.98]"
          disabled={busy}
          onClick={() => void load()}
          aria-label={t("Refresh journey records", "تحديث سجلات الرحلات")}
        >
          {busy ? (
            <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {t("Refresh records", "تحديث السجلات")}
        </Button>
      </div>
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
        aria-live="polite"
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            failed ? "bg-review" : "bg-muted-foreground/50",
          )}
          aria-hidden="true"
        />
        <span>
          {failed
            ? t(
                denied
                  ? "Owner access is required. Saved records have been cleared."
                  : data
                    ? "Updates paused. Previous records stay visible."
                    : "Records could not be refreshed. Please try again.",
                denied
                  ? "يلزم دخول المالك. أُخفيت السجلات المحفوظة."
                  : data
                    ? "التحديث متوقف مؤقتًا. تبقى السجلات السابقة ظاهرة."
                    : "تعذر تحديث السجلات. حاول مرة أخرى.",
              )
            : data
              ? t(
                  `Updated ${relative(data.checked_at, now, ar)}`,
                  `حُدّث ${relative(data.checked_at, now, ar)}`,
                )
              : t("Loading saved records…", "جارٍ تحميل السجلات…")}
        </span>
        <span>
          {t(
            denied
              ? "Automatic updates paused"
              : "Refreshes every 15 seconds while visible",
            denied
              ? "التحديث التلقائي متوقف"
              : "يتحدث كل ١٥ ثانية أثناء عرض الصفحة",
          )}
        </span>
      </div>
      {!data && !failed ? (
        <div
          aria-label={t("Loading journeys", "تحميل الرحلات")}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {categories.map((c) => (
              <Skeleton key={c} className="h-24 rounded-2xl" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : !data ? (
        <Panel title={t("Records are unavailable", "السجلات غير متاحة")}>
          <EmptyState
            icon={TriangleAlert}
            title={t(
              denied ? "Owner access needed" : "We couldn’t load the journeys",
              denied ? "يلزم دخول المالك" : "تعذر تحميل الرحلات",
            )}
            text={t(
              denied
                ? "Sign in with your Reload owner account before refreshing. No order has been retried."
                : "Check your owner access and try refreshing. No order has been retried.",
              denied
                ? "سجّل الدخول بحساب مالك ريلود قبل التحديث. لم تُعد محاولة أي طلب."
                : "تحقق من صلاحية المالك وحاول تحديث السجلات. لم تُعد محاولة أي طلب.",
            )}
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {categories.map((c) => (
              <Metric
                key={c}
                label={statusText(c, ar)}
                value={
                  records.filter((r) => journeyStatus(r, data.blocked) === c)
                    .length
                }
                note={t("In recent saved records", "ضمن السجلات الحديثة")}
              />
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-xs leading-6 text-muted-foreground sm:px-5">
            <p className="flex items-start gap-2">
              <LockKeyhole className="mt-1 size-3.5 shrink-0" />
              <span>
                {data.blocked && (
                  <strong className="mb-1 block font-medium text-amber-800 dark:text-review">
                    {t(
                      "New test orders are paused until the unconfirmed request is checked.",
                      "إنشاء طلبات اختبار جديدة متوقف حتى مراجعة الطلب غير المؤكد.",
                    )}
                  </strong>
                )}
                {t(
                  "These are testing-z records, not merchant purchase totals. Refreshing reads Reload’s saved records; it does not contact Zid, retry orders or remove a safety lock.",
                  "هذه سجلات testing-z وليست إجمالي مشتريات التجار. يقرأ التحديث سجلات ريلود المحفوظة فقط؛ ولا يتصل بزد أو يعيد الطلبات أو يزيل قفل الأمان.",
                )}
              </span>
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t("Filter journey status", "تصفية حالة الرحلة")}
          >
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              count={records.length}
            >
              {t("All", "الكل")}
            </FilterChip>
            {categories.map((c) => (
              <FilterChip
                key={c}
                active={filter === c}
                onClick={() => setFilter(c)}
                count={
                  records.filter((r) => journeyStatus(r, data.blocked) === c)
                    .length
                }
              >
                {statusText(c, ar)}
              </FilterChip>
            ))}
          </div>
          <div className="space-y-3">
            {visible.map((record) => (
              <JourneyCard
                key={record.reference}
                record={record}
                snapshot={data}
                now={now}
              />
            ))}
          </div>
          {!visible.length && (
            <Panel title={t("Journeys", "الرحلات")}>
              <EmptyState
                icon={Activity}
                title={
                  records.length
                    ? t(
                        "No journeys match this filter",
                        "لا توجد رحلات تطابق التصفية",
                      )
                    : t(
                        "No checkout tests recorded yet",
                        "لا توجد اختبارات شراء مسجلة بعد",
                      )
                }
                text={
                  records.length
                    ? t(
                        "Choose another status to see recent activity.",
                        "اختر حالة أخرى لعرض النشاط الحديث.",
                      )
                    : t(
                        "A test appears after its details have been validated. Earlier steps are never invented.",
                        "يظهر الاختبار بعد قبول تفاصيله. لا نُنشئ خطوات سابقة غير مسجلة.",
                      )
                }
              />
            </Panel>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            {t(
              "Up to 50 recent attempts and 30 recorded steps per attempt. Cleanup runs with later checkout changes and removes step records older than 30 days.",
              "حتى ٥٠ محاولة حديثة و٣٠ خطوة لكل محاولة. يحذف التنظيف الخطوات الأقدم من ٣٠ يومًا عند تغيّرات الشراء اللاحقة.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
function JourneyCard({
  record,
  snapshot,
  now,
}: {
  record: CheckoutRecord;
  snapshot: CheckoutMonitor;
  now: number;
}) {
  const { t, isArabic: ar } = useLanguage();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  const status = journeyStatus(record, snapshot.blocked);
  const diagnostic = record.events.filter((e) => e.code !== null).at(-1);
  const title =
    record.state === "READY" && snapshot.blocked
      ? t("Paused by an earlier attempt", "متوقفة بسبب محاولة سابقة")
      : record.state === "READY"
        ? t("Waiting for confirmation", "بانتظار التأكيد")
        : record.state === "CREATED"
          ? record.has_order_reference
            ? t("Order reference saved", "مرجع الطلب محفوظ")
            : t("Order details need checking", "تفاصيل الطلب تحتاج مراجعة")
          : statusText(status, ar);
  const StatusIcon =
    status === "unconfirmed"
      ? CircleHelp
      : status === "failed"
        ? TriangleAlert
        : status === "done"
          ? CheckCheck
          : Clock3;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(journeyReport(record, snapshot));
      setCopied(true);
      setCopyError(false);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError(true);
    }
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`journey-${record.reference}`}
        className="flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-muted/20 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring sm:p-5"
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            tones[status],
          )}
        >
          <StatusIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="text-sm font-semibold">testing-z</strong>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                tones[status],
              )}
            >
              {statusText(status, ar)}
            </span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {title}
          </span>
          <time
            dateTime={record.updated_at}
            title={stamp(record.updated_at, ar)}
            className="mt-1 block text-[11px] text-muted-foreground"
          >
            {relative(record.updated_at, now, ar)}
          </time>
        </span>
        <ChevronDown
          className={cn(
            "mt-2 size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`journey-${record.reference}`}
            initial={{ height: reduce ? "auto" : 0, opacity: reduce ? 1 : 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: reduce ? "auto" : 0, opacity: reduce ? 1 : 0 }}
            transition={TWEEN}
          >
            <div className="space-y-5 border-t border-border p-4 sm:p-5">
              <div
                className={cn(
                  "rounded-xl px-4 py-3 text-sm leading-6",
                  tones[status],
                )}
              >
                <p className="mb-1 font-semibold">
                  {t("Next safe action", "الخطوة الآمنة التالية")}
                </p>
                <p>{nextAction(record, snapshot.blocked, ar)}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {t("Recorded steps", "الخطوات المسجلة")}
                </h3>
                {!record.events.length ? (
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {t(
                      "Earlier step history was not recorded. The current saved state is shown above; no missing steps are assumed complete.",
                      "لم تُسجّل الخطوات السابقة. تظهر الحالة الحالية المحفوظة أعلاه؛ ولا نفترض اكتمال أي خطوة مفقودة.",
                    )}
                  </p>
                ) : (
                  <ol className="ms-1.5 mt-4 space-y-5 border-s border-border">
                    {record.events.map((event, i) => {
                      const eventStatus: JourneyStatus =
                        event.outcome === "done" || event.outcome === "paid"
                          ? "done"
                          : event.outcome === "failed"
                            ? "failed"
                            : event.outcome === "unknown" ||
                                event.outcome === "unconfirmed"
                              ? "unconfirmed"
                              : "waiting";
                      return (
                        <li
                          key={`${event.occurred_at}-${i}`}
                          className="relative min-w-0 ps-5"
                        >
                          <span
                            className={cn(
                              "absolute -start-1 top-1.5 size-2 rounded-full ring-4 ring-card",
                              dots[eventStatus],
                            )}
                          />
                          <p className="text-xs font-medium leading-5">
                            {eventLabel(event, ar)}
                          </p>
                          <time
                            dateTime={event.occurred_at}
                            className="mt-0.5 block text-[11px] text-muted-foreground"
                            title={stamp(event.occurred_at, ar)}
                          >
                            {relative(event.occurred_at, now, ar)}
                          </time>
                          {event.code && (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {diagnosticLabel(event.code, ar)}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-xl bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    {t("Support reference", "مرجع الدعم")}
                  </p>
                  <p className="mt-1 font-mono text-xs" dir="ltr">
                    {record.reference}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    {t("Error details", "تفاصيل الخطأ")}
                  </p>
                  <p className="mt-1 text-xs leading-5">
                    {diagnosticLabel(diagnostic?.code ?? null, ar)}
                  </p>
                  {diagnostic?.provider_status && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("Provider response", "رد المنصة")}:{" "}
                      <bdi>HTTP {diagnostic.provider_status}</bdi>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl active:scale-[.98]"
                  onClick={() => void copy()}
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied
                    ? t("Report copied", "نُسخ التقرير")
                    : t("Copy troubleshooting report", "نسخ تقرير التشخيص")}
                </Button>
                <p role="status" className="text-xs text-muted-foreground">
                  {copyError
                    ? t(
                        "Clipboard unavailable. You can select the visible details instead.",
                        "الحافظة غير متاحة. يمكنك نسخ التفاصيل الظاهرة يدويًا.",
                      )
                    : t(
                        "Contact details and private payment links are excluded.",
                        "لا يشمل بيانات التواصل أو روابط الدفع الخاصة.",
                      )}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

type HubProps = {
  data: AdminData;
  labels: Labels;
  storeName: (id: string | null) => string;
  currentUserId: string;
};
export function ActivityHub(props: HubProps) {
  const { t } = props.labels;
  const reduce = useReducedMotion();
  const owner = props.data.role === "owner";
  const [view, setView] = useState(owner ? "checkout" : "merchants");
  const options = [
    ...(owner
      ? [{ value: "checkout", label: t("Checkout tests", "اختبارات الشراء") }]
      : []),
    { value: "merchants", label: t("Merchant journeys", "رحلات التجار") },
    { value: "audit", label: t("Audit log", "سجل التدقيق") },
  ];
  return (
    <div className="space-y-6">
      <Segmented
        value={view}
        options={options}
        onChange={setView}
        label={t("Activity view", "عرض النشاط")}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: reduce ? 1 : 0 }}
          transition={TWEEN}
        >
          {view === "checkout" && owner ? (
            <CheckoutJourneyMonitor />
          ) : view === "audit" ? (
            <ActivityView {...props} />
          ) : (
            <Panel
              title={t("Merchant journeys", "رحلات التجار")}
              subtitle={t(
                "Open a store to inspect its saved conversations, verification steps, tickets and return cases.",
                "افتح المتجر لمراجعة محادثاته وخطوات التحقق والتذاكر وحالات الإرجاع المسجلة.",
              )}
            >
              {!props.data.stores.length ? (
                <EmptyState
                  icon={Store}
                  title={t(
                    "No merchant workspaces yet",
                    "لا توجد مساحات تجار بعد",
                  )}
                  text={t(
                    "Merchant workspaces appear here.",
                    "تظهر مساحات التجار هنا.",
                  )}
                />
              ) : (
                <ul className="divide-y divide-border">
                  {props.data.stores.map((store) => (
                    <li
                      key={store.id}
                      className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">
                          <Store className="size-4 text-muted-foreground" />
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">
                            {store.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t(
                              "Masked support view · merchant approvals stay with the merchant",
                              "عرض دعم ببيانات مخفية · الموافقات تبقى بيد التاجر",
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-xl active:scale-[.98]"
                      >
                        <Link href={`/admin/workspaces/${store.id}`}>
                          {t("Open journey", "فتح الرحلة")}
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
