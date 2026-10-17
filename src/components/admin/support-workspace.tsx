"use client";
import { StaffBillingCard } from "@/components/admin/billing-card";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  ShieldCheck,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Metric,
  Panel,
  EmptyState,
  QUICK,
  Segmented,
} from "@/components/desk/primitives";
import { ProgressRing } from "@/components/desk/progress-ring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  journeyLabel,
  customerActionLabel,
  auditLabel,
  type SupportWorkspace,
} from "@/lib/support-workspace";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tone = "done" | "waiting" | "failed" | "idle";
const colors: Record<Tone, string> = {
  done: "bg-eligible",
  waiting: "bg-review",
  failed: "bg-destructive",
  idle: "bg-muted-foreground/50",
};
export function SupportWorkspaceView({
  initial,
  canPrepare,
}: {
  initial: SupportWorkspace;
  canPrepare: boolean;
}) {
  const { t, isArabic } = useLanguage();
  const [data, setData] = useState(initial),
    [tab, setTab] = useState("activity"),
    [selected, setSelected] = useState("all");
  const [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState(false),
    [checked, setChecked] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null),
    [title, setTitle] = useState(""),
    [answer, setAnswer] = useState(""),
    [draftBusy, setDraftBusy] = useState(false),
    [language, setLanguage] = useState(isArabic ? "ar" : "en");
  const inflight = useRef(false),
    draftFlight = useRef(false),
    mounted = useRef(true);
  const endpoint = `/api/admin/workspaces/${initial.store.id}`;
  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setRefreshing(true);
    try {
      const r = await fetch(endpoint, { cache: "no-store" });
      if (!r.ok) throw new Error();
      const next = await r.json();
      if (mounted.current) {
        setData(next);
        setError(false);
        setChecked(new Date().toISOString());
      }
    } catch {
      if (mounted.current) setError(true);
    } finally {
      inflight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [endpoint]);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", focus);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  const dt = (value: string) =>
    new Date(value).toLocaleString(isArabic ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const relative = (value: string) => {
    const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000);
    if (mins < 1) return t("just now", "الآن");
    if (mins < 60) return t(`${mins}m ago`, `قبل ${mins} دقيقة`);
    if (mins < 1440)
      return t(
        `${Math.floor(mins / 60)}h ago`,
        `قبل ${Math.floor(mins / 60)} ساعة`,
      );
    return dt(value);
  };
  const pending = data.reviews.filter((r) => r.status === "PENDING");
  const setup = [
    true,
    data.connections.some((c) => c.status === "CONNECTED"),
    data.policies.length > 0,
    data.whatsapp?.status === "CONNECTED",
  ];
  const items = useMemo(() => {
    const match = (id: string) => selected === "all" || id === selected;
    const rows: Array<{
      key: string;
      label: string;
      detail: string;
      at: string;
      tone: Tone;
      action?: string;
    }> = [];
    if (selected === "all")
      for (const event of data.audit)
        rows.push({
          key: `audit-${event.id}`,
          label: auditLabel(event.event_type, t),
          detail:
            event.event_type === "workspace.issue"
              ? t(
                  "A workspace screen or action failed. Check the merchant’s setup before retrying.",
                  "تعذّر عرض شاشة أو إكمال إجراء. راجع إعداد التاجر قبل إعادة المحاولة.",
                )
              : t("Workspace activity", "نشاط مساحة العمل"),
          at: event.created_at,
          tone:
            event.event_type.endsWith(".failed") ||
            event.event_type === "workspace.issue" ||
            event.event_type === "ORDER_OTP_EMAIL_FAILED"
              ? "failed"
              : "done",
        });
    for (const m of data.messages.filter((m) => match(m.conversation_id))) {
      const failed = m.status === "FAILED" || m.processing_failed;
      const waiting =
        m.direction === "OUTBOUND" &&
        !["DELIVERED", "READ"].includes(m.status) &&
        !failed;
      rows.push({
        key: `message-${m.id}`,
        label:
          m.direction === "INBOUND"
            ? t("Customer message received", "وصول رسالة العميل")
            : t("Reload replied", "رد ريلود"),
        detail:
          m.message_type === "IMAGE"
            ? t(
                "Photo attached. Open the case in the merchant workspace to review it.",
                "صورة مرفقة. تُراجع في الحالة داخل مساحة التاجر.",
              )
            : customerActionLabel(
                m.body || t("Message without text", "رسالة دون نص"),
                t,
                m.direction === "INBOUND" && m.message_type === "INTERACTIVE",
              ),
        at: m.occurred_at,
        tone: failed ? "failed" : waiting ? "waiting" : "done",
        action: failed
          ? t(
              "Check the connection and delivery logs before retrying.",
              "راجع الاتصال وسجلات التسليم قبل إعادة المحاولة.",
            )
          : waiting
            ? t(
                "Accepted for sending; delivery has not been confirmed yet.",
                "قُبل الإرسال، ولم يتأكد التسليم بعد.",
              )
            : m.direction === "OUTBOUND"
              ? m.status === "READ"
                ? t("Read by the recipient", "قرأها المستلم")
                : t("Delivered to the recipient", "وصلت للمستلم")
              : undefined,
      });
    }
    for (const s of data.steps.filter((s) => match(s.conversation_id)))
      rows.push({
        key: `step-${s.id}`,
        label:
          s.kind === "issue"
            ? s.step === "billing_waiting"
              ? t(
                  "Assistant waiting for billing",
                  "المساعد بانتظار تفعيل الاشتراك",
                )
              : s.step === "order_lookup_unavailable"
                ? t(
                    "Order lookup could not finish",
                    "تعذّر إكمال التحقق من الطلب",
                  )
                : t("Photo could not be read", "تعذّرت قراءة الصورة")
            : journeyLabel(s.step, t),
        detail:
          s.kind === "issue"
            ? s.step === "billing_waiting"
              ? t(
                  "The customer message is saved in Inbox. Review the store’s subscription and allowance.",
                  "رسالة العميل محفوظة في المحادثات. راجع الاشتراك ورصيد الرسائل.",
                )
              : t(
                  "The customer received guidance to retry. No order details were disclosed.",
                  "وصلت للعميل إرشادات للمحاولة مجددًا. لم تُعرض تفاصيل الطلب.",
                )
            : t(
                "The conversation moved to this step.",
                "انتقلت المحادثة إلى هذه الخطوة.",
              ),
        at: s.created_at,
        tone:
          s.kind === "issue"
            ? s.step === "billing_waiting"
              ? "waiting"
              : "failed"
            : s.step === "COMPLETE"
              ? "done"
              : "waiting",
      });
    for (const review of data.reviews.filter((r) => match(r.conversation_id)))
      rows.push({
        key: `review-${review.id}`,
        label:
          review.status === "PENDING"
            ? t(
                "Waiting for merchant identity review",
                "بانتظار مراجعة الهوية من المتجر",
              )
            : review.status === "APPROVED"
              ? t("Merchant verified the customer", "تحقّق المتجر من العميل")
              : t("Merchant declined verification", "لم يعتمد المتجر التحقق"),
        detail: t(
          "Private order details stay hidden until identity is verified.",
          "تبقى تفاصيل الطلب مخفية حتى التحقق من الهوية.",
        ),
        at: review.reviewed_at || review.created_at,
        tone:
          review.status === "PENDING"
            ? "waiting"
            : review.status === "APPROVED"
              ? "done"
              : "idle",
        action:
          review.status === "PENDING"
            ? t(
                "Ask the merchant to open Inbox → identity reviews. Staff cannot approve on their behalf.",
                "اطلب من التاجر فتح المحادثات ثم مراجعات الهوية. الفريق لا يعتمد نيابة عنه.",
              )
            : undefined,
      });
    for (const c of data.cases.filter(
      (c) => selected === "all" || c.conversation_ids.includes(selected),
    ))
      rows.push({
        key: `case-${c.id}`,
        label: t(
          "Return case saved in the merchant workspace",
          "حفظ حالة الإرجاع في مساحة التاجر",
        ),
        detail:
          c.status === "RESOLVED"
            ? t(
                "The merchant marked this case resolved. This is not proof of refund payment.",
                "أغلق التاجر هذه الحالة. هذا لا يثبت دفع مبلغ الاسترجاع.",
              )
            : t(
                "The merchant can open the case in Return cases and manage the next steps.",
                "يستطيع التاجر فتح الحالة في حالات الإرجاع وإدارة الخطوات التالية.",
              ),
        at: c.updated_at || c.created_at,
        tone:
          c.status === "RESOLVED"
            ? "done"
            : c.status === "CANCELLED"
              ? "idle"
              : "waiting",
        action:
          c.status === "RESOLVED" || c.status === "CANCELLED"
            ? undefined
            : t(
                "Ask the merchant to review their Return cases page.",
                "اطلب من التاجر مراجعة صفحة حالات الإرجاع.",
              ),
      });
    for (const ticket of data.tickets.filter((c) => match(c.conversation_id)))
      rows.push({
        key: `ticket-${ticket.id}`,
        label: t(
          "Support request saved for the merchant",
          "حفظ طلب الدعم للمتجر",
        ),
        detail:
          ticket.status === "RESOLVED"
            ? t(
                "The store marked this request resolved.",
                "أغلق المتجر هذا الطلب.",
              )
            : ticket.status === "IN_PROGRESS"
              ? t(
                  "The store team is working on this request.",
                  "فريق المتجر يعمل على هذا الطلب.",
                )
              : t(
                  "The request is waiting in the merchant’s Inbox.",
                  "الطلب بانتظار المتجر في المحادثات.",
                ),
        at: ticket.updated_at || ticket.created_at,
        tone: ticket.status === "RESOLVED" ? "done" : "waiting",
        action:
          ticket.status === "RESOLVED"
            ? undefined
            : t(
                "The merchant can reply from their Inbox.",
                "يمكن للتاجر الرد من المحادثات.",
              ),
      });
    if (selected === "all")
      for (const issue of data.issues)
        rows.push({
          key: `issue-${issue.id}`,
          label: t(
            "An integration could not finish",
            "تعذّر إكمال عملية اتصال",
          ),
          detail:
            issue.reason === "delivery_uncertain"
              ? t(
                  "The send receipt is uncertain. Check before resending to avoid a duplicate.",
                  "تأكيد الإرسال غير واضح. تحقق قبل الإرسال مجددًا لتجنب التكرار.",
                )
              : issue.reason === "authorization"
                ? t(
                    "Store authorization needs attention.",
                    "تفويض المتجر يحتاج مراجعة.",
                  )
                : issue.reason === "timeout"
                  ? t(
                      "The provider did not respond in time.",
                      "لم تستجب الخدمة في الوقت المحدد.",
                    )
                  : issue.provider === "whatsapp"
                    ? t(
                        "WhatsApp processing needs attention.",
                        "معالجة واتساب تحتاج مراجعة.",
                      )
                    : t(
                        "The store integration needs attention.",
                        "اتصال المتجر يحتاج مراجعة.",
                      ),
          at: issue.received_at,
          tone: "failed",
          action: t(
            "Inspect the matching conversation and provider logs. Do not resend blindly.",
            "راجع المحادثة وسجلات الخدمة. لا تعِد الإرسال دون مراجعة.",
          ),
        });
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }, [data, selected, t]);
  async function saveDraft() {
    if (!title.trim() || !answer.trim() || draftFlight.current) return;
    draftFlight.current = true;
    setDraftBusy(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: answer.trim(),
          category: "FAQ",
          language,
        }),
      });
      if (!r.ok) throw new Error();
      setTitle("");
      setAnswer("");
      toast.success(
        t(
          "Draft saved for the merchant to review.",
          "حُفظت المسودة لمراجعة التاجر.",
        ),
      );
      await refresh();
    } catch {
      toast.error(
        t(
          "Could not save. Your draft is still here.",
          "تعذّر الحفظ. مسودتك ما زالت هنا.",
        ),
      );
    } finally {
      draftFlight.current = false;
      setDraftBusy(false);
    }
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-svh bg-background">
        <div className="sticky top-0 z-30 border-b border-review/25 bg-background px-4 py-3 shadow-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            <ShieldCheck className="size-5 shrink-0 text-review" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-review">
                {t("Staff support workspace", "مساحة مساعدة الفريق")}
              </p>
              <p className="truncate text-sm font-semibold" dir="auto">
                {data.store.name}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href="/admin?view=merchants">
                <ArrowLeft className="size-4 rtl:rotate-180" />
                {t("Exit workspace", "الخروج من المساحة")}
              </Link>
            </Button>
          </div>
        </div>
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
          <StaffBillingCard storeId={initial.store.id} canManage={canPrepare} />
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("Help this merchant", "مساعدة هذا التاجر")}
              </h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {canPrepare
                  ? t(
                      "Inspect setup and prepare drafts. The merchant approves changes.",
                      "راجع الإعداد وجهّز المسودات. التاجر يعتمد التغييرات.",
                    )
                  : t(
                      "Read-only support access. The merchant controls their workspace.",
                      "وصول للمراجعة فقط. التاجر يتحكم بمساحة عمله.",
                    )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ModeToggle />
              <Button
                variant="outline"
                size="sm"
                disabled={refreshing}
                onClick={() => void refresh()}
                className="rounded-xl active:scale-[.98]"
              >
                {refreshing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t("Refresh", "تحديث")}
              </Button>
            </div>
          </header>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
            <Metric
              label={t("Conversations", "المحادثات")}
              value={data.conversations.length}
              note={t(
                "Recent conversations, up to 30",
                "أحدث المحادثات، حتى 30",
              )}
            />
            <Metric
              label={t("Waiting for the merchant", "بانتظار التاجر")}
              value={pending.length}
              note={t(
                "Identity reviews to complete",
                "مراجعات هوية تحتاج إكمالًا",
              )}
              tone="review"
            />
            <Metric
              label={t("Approved answers", "الإجابات المعتمدة")}
              value={data.knowledge.filter((k) => k.published).length}
              note={t("Available to the assistant", "متاحة للمساعد")}
            />
          </div>
          <Panel
            title={t("Setup progress", "تقدم الإعداد")}
            action={
              <ProgressRing
                done={setup.filter(Boolean).length}
                total={4}
                label={t("Merchant setup progress", "تقدم إعداد التاجر")}
              />
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                t("Account created", "إنشاء الحساب"),
                t("Store connected", "ربط المتجر"),
                t("Policy approved", "اعتماد السياسة"),
                t("WhatsApp connected", "ربط واتساب"),
              ].map((label, i) => (
                <div
                  key={label}
                  className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/50 px-3 py-3 text-sm"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      setup[i] ? "bg-eligible" : "bg-muted-foreground/50",
                    )}
                  />
                  {label}
                  <span className="ms-auto text-xs text-muted-foreground">
                    {setup[i] ? t("Done", "تم") : t("Not started", "لم يبدأ")}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {t(
                "The merchant connects the store and publishes policies using their own account. This view does not sign in as them.",
                "التاجر يربط المتجر وينشر السياسات بحسابه. هذا العرض لا يسجّل الدخول نيابة عنه.",
              )}
            </p>
          </Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={tab}
              onChange={setTab}
              label={t("Support view", "عرض المساعدة")}
              options={[
                {
                  value: "activity",
                  label: t("Live activity", "النشاط المباشر"),
                },
                {
                  value: "knowledge",
                  label: t("Answers and drafts", "الإجابات والمسودات"),
                },
              ]}
            />
            <p
              className={cn(
                "text-xs",
                error ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {error
                ? t(
                    "Updates paused. Retry with Refresh.",
                    "التحديث متوقف. حاول باستخدام تحديث.",
                  )
                : checked
                  ? t(
                      `Updated ${relative(checked)} · refreshes every 15 seconds`,
                      `حُدّث ${relative(checked)} · كل 15 ثانية`,
                    )
                  : t(
                      "Auto-refresh every 15 seconds",
                      "تحديث تلقائي كل 15 ثانية",
                    )}
            </p>
          </div>
          <AnimatePresence mode="wait">
            <motion.section
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={QUICK}
              className="min-w-0"
            >
              {tab === "activity" ? (
                <div className="space-y-4">
                  <div className="max-w-lg space-y-2">
                    <label
                      htmlFor="support-conversation"
                      className="text-sm font-medium"
                    >
                      {t("Conversation", "المحادثة")}
                    </label>
                    <Select
                      dir={isArabic ? "rtl" : "ltr"}
                      value={selected}
                      onValueChange={(v) => {
                        setSelected(v);
                        setExpanded(null);
                      }}
                    >
                      <SelectTrigger
                        id="support-conversation"
                        className="w-full rounded-xl"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("All recent activity", "كل النشاط الحديث")}
                        </SelectItem>
                        {data.conversations.map((c, i) => (
                          <SelectItem key={c.id} value={c.id}>
                            {t(`Conversation ${i + 1}`, `المحادثة ${i + 1}`)} ·{" "}
                            {relative(c.last_message_at || c.created_at)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selected !== "all" &&
                    data.conversations.find((c) => c.id === selected) && (
                      <div className="rounded-2xl border border-review/20 bg-review-muted p-4">
                        <p className="text-sm font-medium">
                          {pending.some((r) => r.conversation_id === selected)
                            ? t(
                                "Waiting for merchant identity review",
                                "بانتظار مراجعة الهوية من المتجر",
                              )
                            : journeyLabel(
                                data.conversations.find(
                                  (c) => c.id === selected,
                                )!.step,
                                t,
                              )}
                        </p>
                        <p className="mt-1 text-xs leading-5">
                          {t(
                            "Current conversation step. Contacts and verification codes are hidden.",
                            "الخطوة الحالية للمحادثة. بيانات التواصل ورموز التحقق مخفية.",
                          )}
                        </p>
                      </div>
                    )}
                  <Panel
                    title={t("Journey timeline", "تسلسل الرحلة")}
                    subtitle={t(
                      "Newest first. Open a step for its message and next action. Up to 150 recent messages.",
                      "الأحدث أولًا. افتح الخطوة لرؤية الرسالة والإجراء التالي. حتى 150 رسالة حديثة.",
                    )}
                  >
                    {!items.length ? (
                      <EmptyState
                        icon={MessageSquare}
                        title={t("No activity yet", "لا يوجد نشاط بعد")}
                        text={t(
                          "Once the merchant shares their customer link, incoming messages will appear here.",
                          "بعد مشاركة التاجر رابط العملاء، تظهر الرسائل الواردة هنا.",
                        )}
                      />
                    ) : (
                      <ol className="divide-y divide-border">
                        <AnimatePresence initial={false}>
                          {items.map((item) => (
                            <motion.li
                              key={item.key}
                              layout="position"
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={QUICK}
                              className="min-w-0 py-1"
                            >
                              <button
                                type="button"
                                aria-expanded={expanded === item.key}
                                onClick={() =>
                                  setExpanded(
                                    expanded === item.key ? null : item.key,
                                  )
                                }
                                className="flex w-full items-start gap-3 rounded-xl px-2 py-3 text-start transition-colors hover:bg-muted/50 active:scale-[.98]"
                              >
                                <span
                                  className={cn(
                                    "mt-1.5 size-2 shrink-0 rounded-full",
                                    colors[item.tone],
                                  )}
                                />
                                <span className="min-w-0 flex-1">
                                  <strong className="block text-sm font-medium">
                                    {item.label}
                                  </strong>
                                  <span className="mt-1 block text-xs text-muted-foreground">
                                    {item.tone === "failed"
                                      ? t("Needs attention", "يحتاج مراجعة")
                                      : item.tone === "waiting"
                                        ? t("Waiting", "بانتظار المتابعة")
                                        : item.tone === "done"
                                          ? t("Done", "تم")
                                          : t("Recorded", "مسجّل")}{" "}
                                    ·{" "}
                                    <time
                                      dateTime={item.at}
                                      title={dt(item.at)}
                                    >
                                      {relative(item.at)}
                                    </time>
                                  </span>
                                </span>
                                <ChevronDown
                                  className={cn(
                                    "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                    expanded === item.key && "rotate-180",
                                  )}
                                />
                              </button>
                              <AnimatePresence initial={false}>
                                {expanded === item.key && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={QUICK}
                                    className="overflow-hidden"
                                  >
                                    <div className="ms-7 space-y-3 rounded-xl bg-muted/40 p-4">
                                      <p
                                        dir="auto"
                                        className="whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]"
                                      >
                                        {item.detail}
                                      </p>
                                      {item.action && (
                                        <p
                                          className={cn(
                                            "text-xs leading-6",
                                            item.tone === "failed"
                                              ? "text-destructive"
                                              : item.tone === "waiting"
                                                ? "text-review"
                                                : "text-muted-foreground",
                                          )}
                                        >
                                          {item.action}
                                        </p>
                                      )}
                                      <p className="text-[11px] text-muted-foreground">
                                        {dt(item.at)}
                                      </p>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ol>
                    )}
                  </Panel>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t(
                      "Detailed step history starts with this release. Older conversations show their saved messages and current step. This does not record every click or prove an order was verified.",
                      "سجل الخطوات التفصيلي يبدأ من هذا الإصدار. المحادثات السابقة تعرض رسائلها المحفوظة وخطوتها الحالية. لا يُسجّل كل نقرة ولا يثبت التحقق من الطلب.",
                    )}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
                  <Panel
                    title={t("Merchant answers", "إجابات التاجر")}
                    subtitle={t(
                      "Only approved answers are used with customers.",
                      "لا تُستخدم مع العملاء إلا الإجابات المعتمدة.",
                    )}
                  >
                    {!data.knowledge.length ? (
                      <EmptyState
                        icon={BookOpen}
                        title={t("No answers added yet", "لم تُضف إجابات بعد")}
                        text={t(
                          "Ask the merchant to open Store knowledge → Set up with questions. No help page is needed.",
                          "اطلب من التاجر فتح معلومات المتجر ثم إعداد خطوة بخطوة. لا يحتاج صفحة مساعدة.",
                        )}
                      />
                    ) : (
                      <ul className="divide-y divide-border">
                        {data.knowledge.map((k) => (
                          <li key={k.id} className="py-4">
                            <p className="text-sm font-medium" dir="auto">
                              {k.title}
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-xs",
                                k.published ? "text-eligible" : "text-review",
                              )}
                            >
                              {k.published
                                ? t("Approved", "معتمد")
                                : t(
                                    "Draft · waiting for merchant approval",
                                    "مسودة · بانتظار اعتماد التاجر",
                                  )}
                            </p>
                            <p
                              dir="auto"
                              className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground"
                            >
                              {k.content}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                  <Panel
                    title={t("Prepare an answer draft", "تجهيز مسودة إجابة")}
                    subtitle={t(
                      "Use facts the merchant has supplied. Never invent an answer.",
                      "استخدم معلومات قدّمها التاجر. لا تكتب إجابة تخمينية.",
                    )}
                  >
                    {canPrepare ? (
                      <form
                        className="space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void saveDraft();
                        }}
                      >
                        <label className="block text-sm">
                          {t("Customer question", "سؤال العميل")}
                          <Input
                            dir="auto"
                            required
                            maxLength={160}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="mt-2 h-11 rounded-xl"
                          />
                        </label>
                        <label className="block text-sm">
                          {t("Merchant’s answer", "إجابة التاجر")}
                          <Textarea
                            dir="auto"
                            required
                            maxLength={6000}
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            className="mt-2 min-h-40 rounded-xl"
                          />
                        </label>
                        <Segmented
                          label={t("Answer language", "لغة الإجابة")}
                          value={language}
                          onChange={setLanguage}
                          options={[
                            { value: "ar", label: "العربية" },
                            { value: "en", label: "English" },
                          ]}
                        />
                        <Button
                          type="submit"
                          disabled={
                            draftBusy || !title.trim() || !answer.trim()
                          }
                          className="rounded-xl active:scale-[.98]"
                        >
                          {draftBusy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                          {t("Save for merchant review", "حفظ لمراجعة التاجر")}
                        </Button>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {t(
                            "The draft appears in the merchant’s Store knowledge page. Only they can approve it.",
                            "تظهر المسودة في صفحة معلومات المتجر لدى التاجر. هو من يعتمدها.",
                          )}
                        </p>
                      </form>
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title={t("Read-only access", "وصول للمراجعة فقط")}
                        text={t(
                          "A Reload owner can prepare drafts; the merchant approves them.",
                          "مالك ريلود يستطيع تجهيز المسودات، والتاجر يعتمدها.",
                        )}
                      />
                    )}
                  </Panel>
                </div>
              )}
            </motion.section>
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}
