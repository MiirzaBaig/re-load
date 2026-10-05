"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowRight, BellRing, CalendarCheck2, Check, CheckCheck, ChevronRight, Clock3, Inbox, MoreHorizontal, Sparkles } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, Metric, Panel, QUICK, STATUS_COLOR, StatusDot, StatusPill } from "@/components/desk/primitives";
import { STATUSES, type AdminData, type Lead, type LeadChanges, type Merchant } from "@/components/admin/types";
import type { View } from "@/components/admin/use-admin-state";
import { dailySeries, followUpIn, isDue, type Labels } from "@/components/admin/use-labels";
import { cn } from "@/lib/utils";
import { PLATFORMS, PLATFORM_COLOR, platformOf, type Platform } from "@/lib/platforms";
import { platformName } from "@/components/admin/views/leads";

type Props = {
  data: AdminData;
  leads: Lead[];
  merchants: Merchant[];
  issues: number;
  labels: Labels;
  canEdit: boolean;
  queue: Lead[];
  onOpenLead: (id: string) => void;
  /** Open the leads board filtered to one platform. */
  onPlatform: (platform: Platform | "unknown") => void;
  onGo: (view: View, extra?: { status?: string | null; layout?: "board" | "table" }) => void;
  update: (id: string, changes: LeadChanges, options?: { message?: string; undoable?: boolean }) => Promise<boolean>;
};

const DAY = 86_400_000;

export function TodayView({ data, leads, merchants, issues, labels, canEdit, queue, onOpenLead, onPlatform, onGo, update }: Props) {
  const { t } = labels;
  const stats = useMemo(() => {
    const week = Date.now() - 7 * DAY;
    return {
      newLeads: leads.filter((lead) => lead.status === "new").length,
      addedThisWeek: leads.filter((lead) => new Date(lead.created_at).getTime() >= week).length,
      due: leads.filter(isDue).length,
      demos: leads.filter((lead) => lead.status === "demo_booked").length,
      customers: leads.filter((lead) => lead.status === "customer").length,
      decided: merchants.filter((merchant) => merchant.firstDecision).length,
      decisionsThisWeek: data.decisions.filter((row) => new Date(row.evaluated_at).getTime() >= week).length,
      leadSeries: dailySeries(leads.map((lead) => lead.created_at)),
      decisionSeries: dailySeries(data.decisions.map((row) => row.evaluated_at)),
    };
  }, [leads, merchants, data.decisions]);

  const platforms = useMemo(() => {
    const rows = [...PLATFORMS, "unknown" as const].map((key) => ({ key, count: leads.filter((lead) => (platformOf(lead.store_platform) ?? "unknown") === key).length }));
    // Known platforms by size; "not given" always last.
    return [...rows.filter((r) => r.key !== "unknown").sort((a, b) => b.count - a.count), rows.find((r) => r.key === "unknown")!];
  }, [leads]);
  const knownPlatforms = platforms.filter((p) => p.key !== "unknown").reduce((sum, p) => sum + p.count, 0);
  const pipeline = STATUSES.map((status) => ({ status, count: leads.filter((lead) => lead.status === status).length }));
  const funnel = [
    { label: t("Accounts", "الحسابات"), count: merchants.length },
    { label: t("Salla connected", "سلة متصلة"), count: merchants.filter((m) => m.commerce?.status === "CONNECTED").length },
    { label: t("Policy published", "سياسة منشورة"), count: merchants.filter((m) => m.policy).length },
    { label: t("First decision", "أول قرار"), count: merchants.filter((m) => m.firstDecision).length },
  ];

  return <div className="space-y-6">
    <div className="desk-stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric icon={Inbox} label={t("New leads", "عملاء جدد")} value={stats.newLeads} delta={t(`+${stats.addedThisWeek} this week`, `+${stats.addedThisWeek} هذا الأسبوع`)} note={t("awaiting a reply", "بانتظار رد")} series={stats.leadSeries} onClick={() => onGo("leads", { layout: "table", status: "new" })} />
      <Metric icon={BellRing} label={t("Follow-ups due", "متابعات مستحقة")} value={stats.due} note={stats.due ? t("today or overdue", "اليوم أو متأخرة") : t("you're caught up", "لا شيء متأخر")} tone="review" onClick={() => onGo("leads", { layout: "board" })} />
      <Metric icon={CalendarCheck2} label={t("Demos booked", "عروض محجوزة")} value={stats.demos} note={t(`${stats.customers} became customers`, `${stats.customers} أصبحوا عملاء`)} onClick={() => onGo("leads", { layout: "table", status: "demo_booked" })} />
      <Metric icon={Sparkles} label={t("First decisions", "أول القرارات")} value={stats.decided} delta={t(`+${stats.decisionsThisWeek} this week`, `+${stats.decisionsThisWeek} هذا الأسبوع`)} note={t("stores with a decision", "متاجر لديها قرار")} series={stats.decisionSeries} onClick={() => onGo("returns")} />
    </div>

    <div className="desk-stagger grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" style={{ ["--desk-base" as string]: "240ms" }}>
      <Panel title={t("Needs a reply", "بانتظار رد")} subtitle={t("Overdue follow-ups first, then new requests.", "المتابعات المتأخرة أولًا، ثم الطلبات الجديدة.")} bodyClassName="px-2 pb-2 pt-3 sm:px-3"
        action={<button type="button" onClick={() => onGo("leads", { layout: "board" })} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">{t("Open board", "فتح اللوحة")}<ArrowRight className="size-3.5 rtl:-scale-x-100" /></button>}>
        <ul>
          <AnimatePresence initial={false}>
            {queue.slice(0, 8).map((lead) => <motion.li key={lead.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={QUICK} className="overflow-hidden">
              <QueueRow lead={lead} labels={labels} canEdit={canEdit} onOpen={() => onOpenLead(lead.id)} update={update} />
            </motion.li>)}
          </AnimatePresence>
        </ul>
        {!queue.length && <EmptyState icon={CheckCheck} title={t("Inbox zero", "لا شيء ينتظر")} text={t("No new requests and no follow-ups due.", "لا طلبات جديدة ولا متابعات مستحقة.")} />}
        {queue.length > 8 && <button type="button" onClick={() => onGo("leads", { layout: "board" })} className="mt-1 w-full rounded-xl py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">{t(`${queue.length - 8} more on the board`, `${queue.length - 8} أخرى في اللوحة`)}</button>}
      </Panel>

      <div className="space-y-6">
        <Panel title={t("Pipeline", "مسار المبيعات")} subtitle={t(`${leads.length} leads across every stage.`, `${leads.length} عميل محتمل في كل المراحل.`)}>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            {pipeline.filter((p) => p.count).map(({ status, count }) => <span key={status} className="admin-grow h-full border-e-2 border-card last:border-e-0" style={{ width: `${(count / Math.max(1, leads.length)) * 100}%`, background: STATUS_COLOR[status] }} title={`${labels.status(status)}: ${count}`} />)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-1">
            {pipeline.map(({ status, count }) => <button key={status} type="button" onClick={() => onGo("leads", { layout: "table", status })} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs transition-colors duration-150 hover:bg-muted/60">
              <StatusDot status={status} /><span className="flex-1 truncate text-muted-foreground">{labels.status(status)}</span><strong className="tabular-nums font-semibold">{count}</strong>
            </button>)}
          </div>
        </Panel>

        <Panel title={t("Store platforms", "منصات المتاجر")} subtitle={knownPlatforms ? t(`Where ${knownPlatforms} of ${leads.length} leads sell. Click to filter.`, `أين يبيع ${knownPlatforms} من ${leads.length}. انقر للتصفية.`) : t("Platforms appear as leads tell us where they sell.", "تظهر المنصات عندما يخبرنا العملاء أين يبيعون.")}>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            {platforms.filter((p) => p.count && p.key !== "unknown").map(({ key, count }) => <span key={key} className="admin-grow h-full border-e-2 border-card last:border-e-0" style={{ width: `${(count / Math.max(1, leads.length)) * 100}%`, background: PLATFORM_COLOR[key] }} />)}
          </div>
          <ul className="mt-4 space-y-1">
            {platforms.map(({ key, count }, i) => <li key={key}>
              <button type="button" onClick={() => onPlatform(key)} disabled={!count} className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start text-xs transition-colors duration-150 enabled:hover:bg-muted/60 disabled:opacity-50">
                <span className="size-2 shrink-0 rounded-full" style={{ background: PLATFORM_COLOR[key] }} />
                <span className={cn("w-20 shrink-0 truncate", key === "unknown" ? "text-muted-foreground" : "font-medium")}>{platformName(key, labels)}</span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="admin-grow absolute inset-y-0 start-0 rounded-full" style={{ width: `${leads.length ? (count / leads.length) * 100 : 0}%`, background: PLATFORM_COLOR[key], animationDelay: `${i * 70}ms` }} />
                </span>
                <strong className="w-6 text-end tabular-nums font-semibold">{count}</strong>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-enabled:group-hover:opacity-100 rtl:rotate-180" />
              </button>
            </li>)}
          </ul>
        </Panel>

        <Panel title={t("Merchant setup", "إعداد التجار")} subtitle={t("Only verified milestones count.", "نحتسب المراحل المكتملة فعلًا.")}
          action={<button type="button" onClick={() => onGo("merchants")} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">{t("All", "الكل")}<ArrowRight className="size-3.5 rtl:-scale-x-100" /></button>}>
          <div className="space-y-2.5">
            {funnel.map(({ label, count }, i) => <div key={label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="admin-grow absolute inset-y-0 start-0 rounded-full bg-foreground" style={{ width: `${funnel[0].count ? (count / funnel[0].count) * 100 : 0}%`, opacity: 1 - i * 0.15, animationDelay: `${i * 90}ms` }} />
              </span>
              <strong className="w-6 text-end text-xs tabular-nums">{count}</strong>
            </div>)}
          </div>
        </Panel>

        <button type="button" onClick={() => onGo("health")} className={cn("admin-card admin-lift flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-start", issues ? "border-review/30 bg-review-muted/40" : "border-border bg-card")}>
          <span className={cn("grid size-8 place-items-center rounded-full", issues ? "bg-review-muted text-review" : "bg-eligible-muted text-eligible")}><Activity className="size-4" /></span>
          <span className="flex-1"><strong className="block text-sm font-semibold">{issues ? t(`${issues} channel issues need attention`, `${issues} مشكلات في القنوات تحتاج انتباهًا`) : t("Channels are quiet", "القنوات هادئة")}</strong><span className="text-xs text-muted-foreground">{t("Salla, webhooks and WhatsApp delivery", "سلة والأحداث وتسليم واتساب")}</span></span>
          <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
        </button>
      </div>
    </div>
  </div>;
}

function QueueRow({ lead, labels, canEdit, onOpen, update }: { lead: Lead; labels: Labels; canEdit: boolean; onOpen: () => void; update: Props["update"] }) {
  const { t } = labels;
  const due = isDue(lead);
  const snooze = (days: number, label: string) => void update(lead.id, { next_follow_up_at: followUpIn(days) }, { message: t(`Snoozed until ${label.toLowerCase()}.`, `أُجّل إلى ${label}.`), undoable: true });
  return <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-muted/50">
    <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-start">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-[13px] font-semibold uppercase", due ? "bg-review-muted text-review" : "bg-muted")}>{due ? <Clock3 className="size-4" /> : lead.store_name.slice(0, 1)}</span>
      <span className="min-w-0">
        <strong className="block truncate text-sm font-semibold" dir="auto">{lead.store_name}</strong>
        <span className="block truncate text-xs text-muted-foreground" dir="auto">{due && lead.next_follow_up_at ? t(`Follow-up ${labels.relative(lead.next_follow_up_at)}`, `متابعة ${labels.relative(lead.next_follow_up_at)}`) : `${lead.contact_name} · ${labels.age(lead.created_at)}`}</span>
      </span>
    </button>
    <StatusPill status={lead.status} label={labels.status(lead.status)} className="hidden md:inline-flex" />
    {canEdit && <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors active:bg-muted data-[state=open]:bg-muted sm:hidden" aria-label={t(`Actions for ${lead.store_name}`, `إجراءات ${lead.store_name}`)}><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {lead.status === "new" && <><DropdownMenuItem onSelect={() => void update(lead.id, { status: "contacted" }, { message: t(`${lead.store_name} marked contacted.`, `تم التواصل مع ${lead.store_name}.`), undoable: true })}><Check className="size-4" />{t("Mark contacted", "تم التواصل")}</DropdownMenuItem><DropdownMenuSeparator /></>}
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">{t("Snooze", "تأجيل")}</DropdownMenuLabel>
        {[{ d: 1, l: t("Tomorrow", "غدًا") }, { d: 3, l: t("In 3 days", "بعد 3 أيام") }, { d: 7, l: t("Next week", "الأسبوع القادم") }].map(({ d, l }) => <DropdownMenuItem key={d} onSelect={() => snooze(d, l)}><Clock3 className="size-4" />{l}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>}
    {canEdit && <div className="hidden shrink-0 items-center gap-1 transition-opacity duration-150 sm:flex sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
      {lead.status === "new" && <button type="button" onClick={() => void update(lead.id, { status: "contacted" }, { message: t(`${lead.store_name} marked contacted.`, `تم التواصل مع ${lead.store_name}.`), undoable: true })} className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[.98]">{t("Contacted", "تم التواصل")}</button>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium transition-colors duration-150 hover:bg-muted data-[state=open]:bg-muted">{t("Snooze", "تأجيل")}</button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {[{ d: 1, l: t("Tomorrow", "غدًا") }, { d: 3, l: t("In 3 days", "بعد 3 أيام") }, { d: 7, l: t("Next week", "الأسبوع القادم") }].map(({ d, l }) => <DropdownMenuItem key={d} onSelect={() => snooze(d, l)}>{l}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>}
    <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block rtl:rotate-180" />
  </div>;
}
