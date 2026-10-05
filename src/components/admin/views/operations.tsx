"use client";

import { useMemo, useState } from "react";
import { Activity, Bug, CheckCheck, MessageSquareText, ShieldCheck, UserRound, Webhook, type LucideIcon } from "lucide-react";
import { BarRow, EmptyState, FilterChip, Panel, SectionLabel } from "@/components/desk/primitives";
import type { AdminData } from "@/components/admin/types";
import type { Labels } from "@/components/admin/use-labels";
import { cn } from "@/lib/utils";
import { memberName } from "@/components/admin/views/team";

type Base = { data: AdminData; labels: Labels; storeName: (id: string | null) => string };

/* ───────────────────────── Returns ───────────────────────── */

const OUTCOMES = [
  { key: "ELIGIBLE", color: "var(--eligible)" },
  { key: "MANUAL_REVIEW", color: "var(--review)" },
  { key: "NOT_ELIGIBLE", color: "var(--not-eligible)" },
] as const;

export function ReturnsView({ data, labels }: Base) {
  const { t } = labels;
  const outcomeLabel = (key: string) => key === "ELIGIBLE" ? t("Eligible", "مؤهل") : key === "MANUAL_REVIEW" ? t("Needs review", "يحتاج مراجعة") : t("Not eligible", "غير مؤهل");
  const outcomes = OUTCOMES.map((o) => ({ ...o, count: data.decisions.filter((row) => row.outcome === o.key).length }));
  const total = data.decisions.length;
  const reasons = Object.entries(data.decisions.filter((row) => row.outcome === "MANUAL_REVIEW").flatMap((row) => row.reason_codes)
    .reduce<Record<string, number>>((acc, code) => { acc[code] = (acc[code] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxReason = reasons[0]?.[1] ?? 0;

  return <div className="space-y-6">
    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("Based on recorded decisions, including requests that never became a case.", "تستند إلى القرارات المسجلة، بما فيها الطلبات التي لم تتحول إلى حالة.")}</p>
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <Panel title={t("Decision outcomes", "نتائج القرارات")} subtitle={t(`${total} recorded decisions`, `${total} قرار مسجل`)}>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Donut segments={outcomes.map((o) => ({ value: o.count, color: o.color }))} total={total} label={t("decisions", "قرار")} />
          <ul className="w-full flex-1 space-y-2">
            {outcomes.map((o) => <li key={o.key} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3.5 py-2.5">
              <span className="size-2.5 rounded-full" style={{ background: o.color }} />
              <span className="flex-1 text-sm">{outcomeLabel(o.key)}</span>
              <strong className="text-sm font-semibold tabular-nums">{o.count}</strong>
              <span className="w-10 text-end text-xs tabular-nums text-muted-foreground">{total ? Math.round((o.count / total) * 100) : 0}%</span>
            </li>)}
          </ul>
        </div>
      </Panel>
      <Panel title={t("Why decisions need review", "أسباب المراجعة اليدوية")} subtitle={t("Most common reason codes.", "أكثر الأسباب تكرارًا.")}>
        {reasons.length ? <div className="space-y-3.5">{reasons.map(([reason, count]) => <BarRow key={reason} label={labels.code(reason)} value={count} total={maxReason} color="var(--review)" />)}</div>
          : total ? <EmptyState icon={CheckCheck} title={t("No manual reviews", "لا مراجعات يدوية")} text={t("Every recorded decision resolved automatically.", "كل القرارات المسجلة حُسمت تلقائيًا.")} />
          : <EmptyState icon={Activity} title={t("No decisions yet", "لا قرارات بعد")} text={t("Reasons appear once stores start deciding returns.", "تظهر الأسباب عندما تبدأ المتاجر في حسم المرتجعات.")} />}
      </Panel>
    </div>
    <Panel title={t("Return cases", "حالات الإرجاع")} subtitle={t("Operational state, separate from eligibility.", "الحالة التشغيلية مستقلة عن قرار الأهلية.")}>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-5">
        {["OPEN", "AWAITING_ITEM", "RECEIVED", "RESOLVED", "CANCELLED"].map((status) => <BarRow key={status} label={labels.code(status)} value={data.cases.filter((row) => row.status === status).length} total={data.cases.length} />)}
      </div>
    </Panel>
    <p className="text-xs text-muted-foreground">{t("Recent records shown; not a payout or savings report.", "السجلات المعروضة حديثة؛ هذا ليس تقريرًا بالمبالغ المصروفة أو التوفير.")}</p>
  </div>;
}

function Donut({ segments, total, label }: { segments: { value: number; color: string }[]; total: number; label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return <div className="relative size-40 shrink-0">
    <svg viewBox="0 0 100 100" className="size-full -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="9" />
      {total > 0 && segments.map((s, i) => {
        const length = (s.value / total) * c;
        const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="9" strokeDasharray={`${Math.max(0, length - 1.2)} ${c}`} strokeDashoffset={-offset} className="admin-donut" style={{ animationDelay: `${i * 120}ms` }} />;
        offset += length;
        return s.value ? el : null;
      })}
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center"><div><p className="font-display text-3xl font-semibold tabular-nums tracking-tight">{total}</p><p className="text-[11px] text-muted-foreground">{label}</p></div></div>
  </div>;
}

/* ───────────────────────── Health ───────────────────────── */

export function HealthView({ data, labels, storeName }: Base) {
  const { t } = labels;
  const groups: { title: string; icon: LucideIcon; rows: { key: string; title: string; detail: string; at?: string | null }[] }[] = [
    { title: "Salla", icon: ShieldCheck, rows: data.commerce.filter((row) => row.status === "ERROR" || row.status === "EXPIRED").map((row) => ({ key: `c-${row.store_id}`, title: storeName(row.store_id), detail: row.last_error_code ?? labels.code(row.status), at: row.last_synced_at })) },
    { title: t("Webhooks", "الأحداث"), icon: Webhook, rows: data.failedEvents.map((row, i) => ({ key: `e-${i}`, title: storeName(row.store_id), detail: `${row.provider} · ${row.event_type}${row.last_error ? ` · ${row.last_error}` : ""}`, at: row.received_at })) },
    { title: "WhatsApp", icon: MessageSquareText, rows: [
      ...data.whatsapp.filter((row) => row.status === "ERROR" || row.status === "RESTRICTED").map((row) => ({ key: `w-${row.store_id}`, title: storeName(row.store_id), detail: labels.code(row.status), at: row.last_webhook_at })),
      ...data.failedMessages.map((row, i) => ({ key: `m-${i}`, title: storeName(row.store_id), detail: row.failure_code ?? t("Send failed", "فشل الإرسال"), at: row.occurred_at })),
    ] },
  ];
  return <div className="space-y-6">
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
      {groups.map(({ title, icon: Icon, rows }) => <div key={title} className="admin-card flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <span className={cn("grid size-10 place-items-center rounded-xl", rows.length ? "bg-review-muted text-review" : "bg-eligible-muted text-eligible")}><Icon className="size-4" /></span>
        <div><p className="text-xs text-muted-foreground">{title}</p><p className="mt-0.5 text-sm font-semibold">{rows.length ? t(`${rows.length} issues`, `${rows.length} مشكلات`) : t("No recorded failures", "لا إخفاقات مسجلة")}</p></div>
      </div>)}
    </div>
    {groups.filter((g) => g.rows.length).map(({ title, icon: Icon, rows }) => <Panel key={title} title={title} subtitle={t("Recorded failures, newest first.", "الإخفاقات المسجلة، الأحدث أولًا.")} action={<Icon className="size-4 text-muted-foreground" />} bodyClassName="px-2 pb-2 pt-2 sm:px-3">
      <ul>{rows.map((row) => <li key={row.key} className="flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/40">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-review" />
        <div className="min-w-0 flex-1"><p className="text-sm font-medium" dir="auto">{row.title}</p><p className="mt-0.5 break-words text-xs text-muted-foreground">{row.detail}</p></div>
        {row.at && <span className="shrink-0 text-[11px] text-muted-foreground">{labels.age(row.at)}</span>}
      </li>)}</ul>
    </Panel>)}
    {groups.every((g) => !g.rows.length) && <div className="admin-card rounded-2xl border border-border bg-card"><EmptyState icon={Activity} title={t("All quiet", "كل شيء هادئ")} text={t("No recorded failures in this view.", "لا توجد إخفاقات مسجلة في هذا العرض.")} /></div>}
    <p className="text-xs text-muted-foreground">{t("A quiet log does not prove an integration is healthy; check its last activity too.", "عدم وجود أخطاء لا يثبت سلامة التكامل؛ راجع آخر نشاط أيضًا.")}</p>
  </div>;
}

/* ───────────────────────── Feedback ───────────────────────── */

export function FeedbackView({ data, labels, storeName }: Base) {
  const { t } = labels;
  const [type, setType] = useState<"all" | "BUG" | "FEEDBACK">("all");
  const rows = data.reports.filter((r) => type === "all" || (type === "BUG" ? r.report_type === "BUG" : r.report_type !== "BUG"));
  const bugs = data.reports.filter((r) => r.report_type === "BUG").length;
  return <div className="space-y-5">
    <div className="admin-scroll-row flex flex-wrap gap-2">
      <FilterChip active={type === "all"} onClick={() => setType("all")} count={data.reports.length}>{t("All", "الكل")}</FilterChip>
      <FilterChip active={type === "BUG"} onClick={() => setType("BUG")} count={bugs}>{t("Problems", "مشكلات")}</FilterChip>
      <FilterChip active={type === "FEEDBACK"} onClick={() => setType("FEEDBACK")} count={data.reports.length - bugs}>{t("Feedback", "ملاحظات")}</FilterChip>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.map((report) => <article key={report.id} className="admin-card rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", report.report_type === "BUG" ? "bg-review-muted text-review" : "bg-muted text-muted-foreground")}>{report.report_type === "BUG" ? <Bug className="size-3" /> : <MessageSquareText className="size-3" />}{report.report_type === "BUG" ? t("Problem", "مشكلة") : t("Feedback", "ملاحظة")}</span>
          <span className="text-[11px] text-muted-foreground">{labels.date(report.created_at)}</span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6" dir="auto">{report.message}</p>
        <p className="mt-4 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"><span dir="auto">{storeName(report.store_id)}</span>·<span>{labels.code(report.source_channel)}</span>·<span>{labels.code(report.status)}</span></p>
      </article>)}
    </div>
    {!rows.length && <div className="admin-card rounded-2xl border border-border bg-card"><EmptyState icon={MessageSquareText} title={t("No reports yet", "لا توجد بلاغات بعد")} text={t("Reports from merchants and WhatsApp conversations show up here.", "تظهر هنا بلاغات التجار ومحادثات واتساب.")} /></div>}
  </div>;
}

/* ───────────────────────── Activity ───────────────────────── */

export function ActivityView({ data, labels, storeName, currentUserId }: Base & { currentUserId: string }) {
  const { t } = labels;
  const [scope, setScope] = useState<"all" | "merchant" | "team">("all");
  const events = useMemo(() => [
    ...data.merchantAudit.map((e) => ({ id: `m-${e.id}`, kind: "merchant" as const, title: labels.code(e.event_type), detail: `${storeName(e.store_id)} · ${labels.code(e.entity_type)}`, at: e.created_at })),
    ...data.adminAudit.map((e) => ({ id: `a-${e.id}`, kind: "team" as const, title: labels.code(e.event_type), detail: `${e.actor_user_id === currentUserId ? t("You", "أنت") : (() => { const member = data.team.find((m) => m.user_id === e.actor_user_id); return member ? memberName(member) : t("Former teammate", "زميل سابق"); })()} · ${labels.code(e.entity_type)}`, at: e.created_at })),
  ].filter((e) => scope === "all" || e.kind === scope).sort((a, b) => b.at.localeCompare(a.at)), [data, scope, labels, storeName, currentUserId, t]);
  // Back-to-back repeats (e.g. a dozen "Dashboard viewed") collapse into one
  // row with a count and a time range, so the log stays readable.
  const days = useMemo(() => {
    const map = new Map<string, Array<(typeof events)[number] & { count: number; firstAt: string }>>();
    for (const e of events) {
      const key = labels.date(e.at);
      const list = map.get(key) ?? [];
      const last = list[list.length - 1];
      if (last && last.kind === e.kind && last.title === e.title && last.detail === e.detail) {
        last.count += 1;
        last.firstAt = e.at;
      } else {
        list.push({ ...e, count: 1, firstAt: e.at });
      }
      map.set(key, list);
    }
    return [...map.entries()];
  }, [events, labels]);
  const time = (value: string) => new Intl.DateTimeFormat(labels.isArabic ? "ar-SA" : "en-US", { timeStyle: "short" }).format(new Date(value));

  return <div className="space-y-5">
    <div className="admin-scroll-row flex flex-wrap gap-2">
      <FilterChip active={scope === "all"} onClick={() => setScope("all")}>{t("Everything", "الكل")}</FilterChip>
      <FilterChip active={scope === "merchant"} onClick={() => setScope("merchant")} count={data.merchantAudit.length}>{t("Merchants", "التجار")}</FilterChip>
      <FilterChip active={scope === "team"} onClick={() => setScope("team")} count={data.adminAudit.length}>{t("Team", "الفريق")}</FilterChip>
    </div>
    <div className="admin-card rounded-2xl border border-border bg-card px-5 py-2 sm:px-6">
      {days.map(([day, items]) => <section key={day} className="py-4">
        <div className="sticky top-14 z-[1] -mx-1 mb-2 bg-card/95 px-1 py-1 backdrop-blur"><SectionLabel>{day}</SectionLabel></div>
        <ol className="relative space-y-1 border-s border-border ms-2">
          {items.map((e) => <li key={e.id} className="relative flex items-start gap-3 rounded-lg py-2 ps-5 transition-colors hover:bg-muted/30">
            <span className={cn("absolute -start-[9px] top-2.5 grid size-[17px] place-items-center rounded-full border-2 border-card", e.kind === "team" ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{e.kind === "team" ? <UserRound className="size-2.5" /> : <span className="size-1.5 rounded-full bg-current" />}</span>
            <div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-medium">{e.title}{e.count > 1 && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">×{e.count}</span>}</p><p className="truncate text-xs text-muted-foreground" dir="auto">{e.detail}</p></div>
            <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">{e.count > 1 && time(e.firstAt) !== time(e.at) ? `${time(e.firstAt)} – ${time(e.at)}` : time(e.at)}</span>
          </li>)}
        </ol>
      </section>)}
      {!days.length && <EmptyState icon={Activity} title={t("No activity recorded", "لا يوجد نشاط مسجل")} />}
    </div>
  </div>;
}
