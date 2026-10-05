"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Search, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { BarRow, EmptyState, FilterChip, Initial, MilestoneBar, SectionLabel } from "@/components/desk/primitives";
import type { AdminData, Merchant } from "@/components/admin/types";
import type { Labels } from "@/components/admin/use-labels";
import { cn } from "@/lib/utils";

const steps = (m: Merchant) => [m.account, m.commerce?.status === "CONNECTED", m.policy, m.firstDecision];

export function MerchantsView({ merchants, labels, selectedId, onOpen }: { merchants: Merchant[]; labels: Labels; selectedId: string | null; onOpen: (id: string) => void }) {
  const { t } = labels;
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"all" | "setup" | "live">("all");
  const rows = useMemo(() => merchants.filter((m) => {
    const done = steps(m).filter(Boolean).length;
    if (stage === "setup" && done === 4) return false;
    if (stage === "live" && done < 4) return false;
    return m.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim());
  }), [merchants, query, stage]);
  const live = merchants.filter((m) => steps(m).every(Boolean)).length;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-9 rounded-xl ps-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search stores", "ابحث عن متجر")} /></div>
      <div className="admin-scroll-row flex flex-wrap gap-2">
      <FilterChip active={stage === "all"} onClick={() => setStage("all")} count={merchants.length}>{t("All", "الكل")}</FilterChip>
      <FilterChip active={stage === "setup"} onClick={() => setStage("setup")} count={merchants.length - live}>{t("In setup", "قيد الإعداد")}</FilterChip>
      <FilterChip active={stage === "live"} onClick={() => setStage("live")} count={live}>{t("Fully set up", "مكتمل")}</FilterChip>
      </div>
    </div>
    <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{t("Read-only. A test channel is shown as a test, never as a live customer channel.", "للقراءة فقط. تُعرض القناة التجريبية كتجربة، لا كقناة عملاء فعّالة.")}</p>
    <div className="admin-card overflow-hidden rounded-2xl border border-border bg-card">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_80px_24px] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
        <span>{t("Store", "المتجر")}</span><span>{t("Setup", "الإعداد")}</span><span>{t("WhatsApp", "واتساب")}</span><span className="text-end">{t("Cases", "الحالات")}</span><span />
      </div>
      <ul className="divide-y divide-border/70">
        {rows.map((m) => {
          const done = steps(m).filter(Boolean).length;
          return <li key={m.id}><button type="button" onClick={() => onOpen(m.id)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_24px] items-center gap-4 px-5 py-4 text-start transition-colors duration-150 hover:bg-muted/50 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_80px_24px]", selectedId === m.id && "bg-muted/70")}>
            <span className="flex min-w-0 items-center gap-3"><Initial name={m.name} /><span className="min-w-0"><strong className="block truncate text-sm font-semibold" dir="auto">{m.name}</strong><span className="block text-xs text-muted-foreground">{t("Joined", "انضم")} {labels.date(m.created_at)}</span>
              <span className="mt-2 flex items-center gap-2 md:hidden"><MilestoneBar steps={steps(m)} className="w-28" /><span className="text-[11px] tabular-nums text-muted-foreground">{done}/4</span></span></span></span>
            <span className="hidden items-center gap-3 md:flex"><MilestoneBar steps={steps(m)} className="flex-1" /><span className="text-xs tabular-nums text-muted-foreground">{done}/4</span></span>
            <span className="hidden md:block"><ConnectionBadge status={m.whatsapp?.status} labels={labels} /></span>
            <span className="hidden text-end text-sm tabular-nums md:block">{m.caseCount}</span>
            <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
          </button></li>;
        })}
      </ul>
      {!rows.length && <EmptyState icon={Store} title={merchants.length ? t("No stores match", "لا توجد متاجر مطابقة") : t("No merchant accounts yet", "لا توجد حسابات تجار بعد")} />}
    </div>
  </div>;
}

function ConnectionBadge({ status, labels }: { status?: string; labels: Labels }) {
  const { t } = labels;
  const ok = status === "CONNECTED" || status === "ACTIVE";
  const bad = status === "ERROR" || status === "RESTRICTED" || status === "EXPIRED";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", ok ? "bg-eligible-muted text-eligible" : bad ? "bg-review-muted text-review" : "bg-muted text-muted-foreground")}>
    <span className="size-1.5 rounded-full bg-current" />{status ? labels.code(status) : t("Not connected", "غير متصل")}
  </span>;
}

export function MerchantDrawer({ merchant, data, labels, onClose }: { merchant: Merchant | undefined; data: AdminData; labels: Labels; onClose: () => void }) {
  const { t, isArabic } = labels;
  const cases = merchant ? data.cases.filter((row) => row.store_id === merchant.id) : [];
  const decisions = merchant ? data.decisions.filter((row) => row.store_id === merchant.id) : [];
  const timeline = merchant ? [
    { done: merchant.account, label: t("Account created", "إنشاء الحساب"), at: merchant.created_at },
    { done: merchant.commerce?.status === "CONNECTED", label: t("Salla connected", "ربط سلة"), at: merchant.commerce?.connected_at ?? undefined },
    { done: merchant.policy, label: t("Return policy published", "نشر سياسة الإرجاع"), at: merchant.policyAt },
    { done: merchant.firstDecision, label: t("First return decision", "أول قرار إرجاع"), at: merchant.firstDecisionAt },
  ] : [];
  return <Sheet open={!!merchant} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent side={isArabic ? "left" : "right"} showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-[460px]">
      <SheetTitle className="sr-only">{merchant?.name ?? t("Merchant", "تاجر")}</SheetTitle>
      <SheetDescription className="sr-only">{t("Merchant setup and activity", "إعداد التاجر ونشاطه")}</SheetDescription>
      {merchant && <>
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <Initial name={merchant.name} className="size-11 rounded-2xl text-base" />
          <div className="min-w-0 flex-1"><h2 className="truncate text-xl font-semibold tracking-tight" dir="auto">{merchant.name}</h2><p className="mt-0.5 text-sm text-muted-foreground">{t("Joined", "انضم")} {labels.date(merchant.created_at)}</p></div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("Close", "إغلاق")}><X className="size-4" /></Button>
        </div>
        <div className="admin-fade min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
          <section className="space-y-4"><SectionLabel>{t("Setup", "الإعداد")}</SectionLabel>
            <ol className="relative space-y-5 border-s border-border ps-6">
              {timeline.map((item) => <li key={item.label} className="relative">
                <span className={cn("absolute -start-[33px] top-0 grid size-[18px] place-items-center rounded-full border-2 border-background", item.done ? "bg-foreground text-background" : "bg-muted")}>{item.done && <Check className="size-2.5" strokeWidth={3} />}</span>
                <p className={cn("text-sm", item.done ? "font-medium" : "text-muted-foreground")}>{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.done ? (item.at ? labels.date(item.at) : t("Done", "تم")) : t("Not yet", "لم يتم بعد")}</p>
              </li>)}
            </ol>
          </section>
          <section className="space-y-3"><SectionLabel>{t("Connections", "الاتصالات")}</SectionLabel>
            <div className="grid gap-2">
              <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3"><span className="text-sm">Salla{merchant.commerce?.external_store_name ? <span className="text-muted-foreground"> · {merchant.commerce.external_store_name}</span> : null}</span><ConnectionBadge status={merchant.commerce?.status} labels={labels} /></div>
              {merchant.commerce?.last_error_code && <p className="px-1 text-xs text-review">{t("Last error", "آخر خطأ")}: {merchant.commerce.last_error_code}</p>}
              {merchant.commerce?.last_synced_at && <p className="px-1 text-xs text-muted-foreground">{t("Last synced", "آخر مزامنة")} {labels.datetime(merchant.commerce.last_synced_at)}</p>}
              <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3"><span className="text-sm">WhatsApp</span><ConnectionBadge status={merchant.whatsapp?.status} labels={labels} /></div>
              {merchant.whatsapp?.last_webhook_at && <p className="px-1 text-xs text-muted-foreground">{t("Last message event", "آخر حدث رسائل")} {labels.datetime(merchant.whatsapp.last_webhook_at)}</p>}
            </div>
          </section>
          <section className="space-y-3"><SectionLabel>{t("Returns", "المرتجعات")}</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted/50 px-4 py-3"><p className="text-[11px] text-muted-foreground">{t("Decisions", "القرارات")}</p><p className="mt-1 text-xl font-semibold tabular-nums">{decisions.length}</p></div>
              <div className="rounded-xl bg-muted/50 px-4 py-3"><p className="text-[11px] text-muted-foreground">{t("Cases", "الحالات")}</p><p className="mt-1 text-xl font-semibold tabular-nums">{cases.length}</p></div>
            </div>
            {cases.length > 0 && <div className="space-y-3 pt-2">{["OPEN", "AWAITING_ITEM", "RECEIVED", "RESOLVED", "CANCELLED"].map((status) => <BarRow key={status} label={labels.code(status)} value={cases.filter((row) => row.status === status).length} total={cases.length} />)}</div>}
          </section>
        </div>
      </>}
    </SheetContent>
  </Sheet>;
}
