"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, ChevronRight, ClipboardList, Download, FileText, Filter, LayoutDashboard, LockKeyhole, MessageSquareWarning, Plus, Search, Store, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";
import { ReloadLogo } from "@/components/reload-logo";
import { AdminEventLink } from "@/components/admin-event-link";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

type Lead = { id: string; store_name: string; contact_name: string; interest: string | null; status: string; source_type: string; source_label: string; created_at: string; next_follow_up_at: string | null; owner_user_id: string | null; store_id: string | null };
type StoreRow = { id: string; name: string; created_at: string };
type Membership = { store_id: string; user_id: string; role: string };
type Policy = { store_id: string; published_at: string };
type Commerce = { store_id: string; platform: string; status: string; external_store_name: string | null; last_synced_at: string | null; last_error_code: string | null; connected_at: string | null };
type WhatsApp = { store_id: string; status: string; last_webhook_at: string | null; connected_at: string | null };
type Decision = { store_id: string; outcome: string; reason_codes: string[]; evaluated_at: string };
type Case = { store_id: string; status: string; created_at: string };
type FailedMessage = { store_id: string; status: string; failure_code: string | null; occurred_at: string };
type FailedEvent = { store_id: string | null; provider: string; event_type: string; status: string; last_error: string | null; received_at: string };
type Report = { id: string; store_id: string | null; report_type: string; status: string; message: string; source_channel: string; created_at: string };
type Audit = { id: string; store_id: string; event_type: string; entity_type: string; created_at: string };
type AdminAudit = { id: string; actor_user_id: string; event_type: string; entity_type: string; created_at: string };
type LeadDetail = Lead & { email: string | null; phone: string | null; website: string | null; store_platform: string | null; preferred_contact: string | null; contact_consent: boolean; marketing_consent: boolean; partner_sharing_consent: boolean; financing_requests: Record<string, unknown> | null; lead_notes: { id: string; body: string; created_at: string; author_user_id: string }[] };

export type AdminDashboardProps = {
  role: string; currentUserId: string; leads: Lead[]; stores: StoreRow[]; memberships: Membership[];
  policies: Policy[]; commerce: Commerce[]; whatsapp: WhatsApp[]; decisions: Decision[];
  cases: Case[]; failedMessages: FailedMessage[]; failedEvents: FailedEvent[];
  reports: Report[]; merchantAudit: Audit[]; adminAudit: AdminAudit[];
};

type Tab = "today" | "leads" | "merchants" | "returns" | "health" | "feedback" | "audit";
const STATUSES = ["new", "contacted", "interested", "demo_booked", "customer", "not_interested"] as const;

export function AdminDashboard(data: AdminDashboardProps) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [tab, setTab] = useState<Tab>("today");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState("");
  const [importSource, setImportSource] = useState("");
  const canEdit = data.role !== "viewer";
  const date = (value: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium" }).format(new Date(value));
  const datetime = (value: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const statusLabel = (value: string) => ({ new: t("New", "جديد"), contacted: t("Contacted", "تم التواصل"), interested: t("Interested", "مهتم"), demo_booked: t("Demo booked", "حجز عرضًا"), customer: t("Customer", "عميل"), not_interested: t("Not interested", "غير مهتم") }[value] ?? value);
  const interestLabel = (value: string | null) => value === "returns" ? t("Returns", "الإرجاع") : value === "financing" ? t("Financing", "التمويل") : value === "both" ? t("Returns + financing", "الإرجاع والتمويل") : t("Not specified", "لم يُحدّد");
  const storeName = (id: string | null) => data.stores.find((store) => store.id === id)?.name ?? t("Unknown store", "متجر غير معروف");
  const now = Date.now();
  const due = data.leads.filter((lead) => lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() <= now && !["customer", "not_interested"].includes(lead.status));
  const newLeads = data.leads.filter((lead) => lead.status === "new");
  const visibleLeads = useMemo(() => data.leads.filter((lead) => {
    if (statusFilter !== "all" && lead.status !== statusFilter) return false;
    const haystack = `${lead.store_name} ${lead.contact_name} ${lead.source_label} ${lead.interest ?? ""}`.toLocaleLowerCase();
    return haystack.includes(query.toLocaleLowerCase().trim());
  }), [data.leads, query, statusFilter]);
  const merchants = useMemo(() => data.stores.map((store) => ({
    ...store,
    account: data.memberships.some((row) => row.store_id === store.id && row.role === "owner"),
    commerce: data.commerce.find((row) => row.store_id === store.id),
    policy: data.policies.some((row) => row.store_id === store.id),
    whatsapp: data.whatsapp.find((row) => row.store_id === store.id),
    firstDecision: data.decisions.some((row) => row.store_id === store.id),
    caseCount: data.cases.filter((row) => row.store_id === store.id).length,
  })), [data]);
  const outcomes = ["ELIGIBLE", "MANUAL_REVIEW", "NOT_ELIGIBLE"].map((name) => ({ name, count: data.decisions.filter((row) => row.outcome === name).length }));
  const reviewReasons = Object.entries(data.decisions.filter((row) => row.outcome === "MANUAL_REVIEW").flatMap((row) => row.reason_codes).reduce<Record<string, number>>((acc, code) => { acc[code] = (acc[code] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const openLead = async (id: string) => {
    setSelectedId(id); setDetail(null); setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/leads/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setDetail(result.lead);
    } catch { toast.error(t("Could not open this lead.", "تعذّر فتح بيانات هذا العميل المحتمل.")); }
    finally { setDetailLoading(false); }
  };

  const updateLead = async (changes: { status?: string; next_follow_up_at?: string | null; owner_user_id?: string | null }) => {
    if (!selectedId || !canEdit) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/leads/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      if (!response.ok) throw new Error();
      setDetail((current) => current ? { ...current, ...changes } : current);
      toast.success(t("Lead updated.", "تم تحديث بيانات العميل المحتمل."));
      router.refresh();
    } catch { toast.error(t("Could not save the change.", "تعذّر حفظ التغيير.")); }
    finally { setSaving(false); }
  };

  const saveNote = async () => {
    if (!selectedId || !note.trim() || !canEdit) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/leads/${selectedId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: note.trim() }) });
      if (!response.ok) throw new Error();
      setNote("");
      await openLead(selectedId);
    } catch { toast.error(t("Could not save this note.", "تعذّر حفظ الملاحظة.")); }
    finally { setSaving(false); }
  };

  const importCsv = async () => {
    if (!csv || !importSource.trim()) return;
    setImporting(true);
    try {
      const response = await fetch("/api/admin/leads/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, sourceLabel: importSource.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Import failed");
      toast.success(t(`${result.imported} leads imported. ${result.skipped} skipped.`, `تم استيراد ${result.imported} عميل محتمل، وتجاوز ${result.skipped}.`));
      setImportOpen(false); setCsv(""); setImportSource(""); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : t("Import failed.", "تعذّر الاستيراد.")); }
    finally { setImporting(false); }
  };

  const nav: { id: Tab; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
    { id: "today", label: t("Today", "اليوم"), icon: LayoutDashboard, count: newLeads.length + due.length },
    { id: "leads", label: t("Leads", "العملاء المحتملون"), icon: Users, count: data.leads.length },
    { id: "merchants", label: t("Merchants", "التجار"), icon: Store },
    { id: "returns", label: t("Returns", "المرتجعات"), icon: ClipboardList },
    { id: "health", label: t("Channel health", "حالة القنوات"), icon: Activity, count: data.failedMessages.length + data.failedEvents.length },
    { id: "feedback", label: t("Feedback", "الملاحظات"), icon: MessageSquareWarning },
    { id: "audit", label: t("Activity", "النشاط"), icon: FileText },
  ];

  return <div className="admin-dashboard min-h-svh bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-7">
        <div className="flex items-center gap-4"><Link href="/" aria-label="Reload"><ReloadLogo className="scale-[.75] origin-start rtl:origin-end" /></Link><span className="hidden h-5 w-px bg-border sm:block" /><span className="hidden text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground sm:block">{t("Team desk", "مساحة الفريق")}</span></div>
        <div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground sm:inline-flex"><LockKeyhole className="size-3" />{t("Private workspace", "مساحة خاصة")}</span><LanguageToggle compact /><ModeToggle /><Link href="/app" className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{t("Merchant workspace", "مساحة التاجر")}</Link></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)] gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="min-w-0 border-b border-border/70 px-3 py-3 lg:min-h-[calc(100svh-4rem)] lg:border-e lg:border-b-0 lg:px-4 lg:py-8" aria-label={t("Team desk navigation", "التنقل في مساحة الفريق")}>
        <p className="hidden px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-muted-foreground lg:block">{t("Workspace", "مساحة العمل")}</p>
        <div className="flex gap-1 overflow-x-auto lg:mt-4 lg:flex-col">{nav.map(({ id, label, icon: Icon, count }) => <button key={id} type="button" onClick={() => { setTab(id); setSelectedId(null); }} className={cn("group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-[background-color,color,transform] duration-150 hover:bg-muted lg:w-full", tab === id ? "bg-foreground text-background hover:bg-foreground" : "text-muted-foreground hover:text-foreground")} aria-current={tab === id ? "page" : undefined}><Icon className="size-4 shrink-0" /><span className="flex-1 whitespace-nowrap">{label}</span>{count ? <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] tabular-nums", tab === id ? "bg-background/15" : "bg-muted")}>{count}</span> : null}</button>)}</div>
        <p className="mt-8 hidden px-3 text-xs leading-5 text-muted-foreground lg:block">{t("Every number here comes from Reload records.", "كل رقم هنا مستند إلى سجلات ريلود.")}</p>
      </nav>
      <main className="min-w-0 px-4 py-7 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">{t("Reload / Team", "ريلود / الفريق")}</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-[-.04em] sm:text-[40px]">{nav.find((item) => item.id === tab)?.label}</h1></div><div className="flex items-center gap-4">{tab === "today" && <AdminEventLink />}<p className="text-xs text-muted-foreground">{t("Internal · verified data", "داخلي · بيانات موثّقة")}</p></div></div>

        {tab === "today" && <div className="space-y-8 animate-fade-in">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={t("New leads", "عملاء محتملون جدد")} value={newLeads.length} note={t("Awaiting first reply", "ينتظرون أول رد")} /><Metric label={t("Follow-ups due", "متابعات مستحقة")} value={due.length} note={t("Today or overdue", "اليوم أو متأخرة")} /><Metric label={t("Demos booked", "عروض محجوزة")} value={data.leads.filter((lead) => lead.status === "demo_booked").length} note={t("From captured leads", "من العملاء المسجلين")} /><Metric label={t("First decisions", "أول قرارات الإرجاع")} value={merchants.filter((merchant) => merchant.firstDecision).length} note={t("Stores with a decision", "متاجر لديها قرار")} /></div>
          <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><Panel title={t("Needs a reply", "ينتظر ردًا")} subtitle={t("New requests and follow-ups, in one place.", "الطلبات الجديدة والمتابعات في مكان واحد.")}><div className="divide-y divide-border/70">{[...due, ...newLeads.filter((lead) => !due.some((item) => item.id === lead.id))].slice(0, 7).map((lead) => <button key={lead.id} onClick={() => { setTab("leads"); void openLead(lead.id); }} className="flex w-full items-center justify-between gap-4 py-3 text-start transition-colors hover:text-[var(--brand-accent)]"><span><span className="block text-sm font-semibold">{lead.store_name}</span><span className="text-xs text-muted-foreground">{lead.contact_name} · {lead.source_label}</span></span><ChevronRight className="size-4 shrink-0 rtl:rotate-180" /></button>)}{due.length + newLeads.length === 0 && <Empty text={t("No follow-ups due. You're caught up.", "لا توجد متابعات مستحقة الآن.")} />}</div></Panel>
            <Panel title={t("Merchant progress", "تقدّم التجار")} subtitle={t("Only verified setup milestones count.", "نحتسب خطوات الإعداد المكتملة فقط.")}><div className="space-y-4">{[[t("Accounts created", "حسابات أُنشئت"), merchants.length], [t("Salla connected", "متاجر سلة المتصلة"), merchants.filter((m) => m.commerce?.status === "CONNECTED").length], [t("Policy published", "سياسات منشورة"), merchants.filter((m) => m.policy).length], [t("First return decision", "أول قرار إرجاع"), merchants.filter((m) => m.firstDecision).length]].map(([label, count]) => <div key={String(label)} className="flex items-center justify-between border-b border-border/60 pb-3 text-sm"><span className="text-muted-foreground">{label}</span><strong className="tabular-nums">{count}</strong></div>)}</div></Panel></div>
        </div>}

        {tab === "leads" && <div className="animate-fade-in space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm leading-6 text-muted-foreground">{t("Event contacts, website requests and future QR sign-ups live together here.", "تجتمع هنا جهات اتصال الفعاليات وطلبات الموقع والتسجيلات القادمة عبر رمز QR.")}</p><div className="flex flex-wrap gap-2"><AdminEventLink />{canEdit && <><Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="size-4" />{t("Import event sheet", "استيراد قائمة الفعالية")}</Button><Button variant="outline" size="sm" asChild><a href="/api/admin/leads/export"><Download className="size-4" />{t("Export CSV", "تصدير CSV")}</a></Button></>}</div></div>
          <div className="flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search store, person or source", "ابحث عن متجر أو شخص أو مصدر")} /></div><div className="relative"><Filter className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-input bg-background ps-9 pe-4 text-sm"><option value="all">{t("All statuses", "كل الحالات")}</option>{STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div></div>
          <div className={cn("grid gap-5", selectedId && "xl:grid-cols-[minmax(0,1fr)_minmax(350px,.82fr)]")}><div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border/70 px-5 py-3 text-xs text-muted-foreground"><span>{t(`${visibleLeads.length} shown`, `معروض ${visibleLeads.length}`)}</span><span>{t("Newest first", "الأحدث أولًا")}</span></div>{visibleLeads.length ? <div className="divide-y divide-border/65">{visibleLeads.map((lead) => <button key={lead.id} type="button" onClick={() => void openLead(lead.id)} className={cn("flex w-full items-center gap-4 px-5 py-4 text-start transition-colors duration-150 hover:bg-muted/60", selectedId === lead.id && "bg-muted/70")}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-sm font-semibold">{lead.store_name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{lead.store_name}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{lead.contact_name} · {lead.source_label}</span></span><span className="hidden shrink-0 text-end sm:block"><StatusPill value={lead.status} label={statusLabel(lead.status)} /><span className="mt-1 block text-[11px] text-muted-foreground">{date(lead.created_at)}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" /></button>)}</div> : <Empty text={t("No leads match this view.", "لا توجد نتائج مطابقة.")} />}</div>
            {selectedId && <><button type="button" aria-label={t("Close lead details", "إغلاق تفاصيل العميل المحتمل")} className="fixed inset-0 z-30 bg-black/35 xl:hidden" onClick={() => { setSelectedId(null); setDetail(null); }} /><div className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl xl:sticky xl:top-24 xl:self-start xl:rounded-2xl xl:shadow-none"><div className="flex items-center justify-between border-b border-border/70 px-5 py-4"><span className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">{t("Lead record", "سجل العميل المحتمل")}</span><button onClick={() => { setSelectedId(null); setDetail(null); }} aria-label={t("Close details", "إغلاق التفاصيل")} className="rounded-lg p-1.5 transition-colors hover:bg-muted"><X className="size-4" /></button></div>{detailLoading ? <div className="p-8 text-sm text-muted-foreground">{t("Opening record…", "جارٍ فتح السجل…")}</div> : detail && <div className="h-[calc(100svh-8rem)] space-y-6 overflow-y-auto p-5 sm:p-6 xl:h-auto xl:max-h-[calc(100svh-10rem)]"><div><h2 className="text-2xl font-semibold tracking-tight">{detail.store_name}</h2><p className="mt-1 text-sm text-muted-foreground">{detail.contact_name} · {detail.source_label}</p></div><div className="grid grid-cols-2 gap-3"><Info label={t("Interest", "الاهتمام")} value={interestLabel(detail.interest)} /><Info label={t("Source", "المصدر")} value={detail.source_label} /><Info label={t("Platform", "المنصة")} value={detail.store_platform || "—"} /><Info label={t("Requested", "تاريخ الطلب")} value={date(detail.created_at)} /></div><div className="space-y-2 border-t border-border pt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Contact", "التواصل")}</h3>{detail.email && <a className="block text-sm underline-offset-4 hover:underline" href={`mailto:${detail.email}`}>{detail.email}</a>}{detail.phone && <a className="block text-sm underline-offset-4 hover:underline" href={`https://wa.me/${detail.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" dir="ltr">{detail.phone}</a>}{detail.website && <a className="block truncate text-sm underline-offset-4 hover:underline" href={detail.website.startsWith("https://") ? detail.website : `https://${detail.website}`} target="_blank" rel="noopener noreferrer">{detail.website}</a>}<p className="text-xs text-muted-foreground">{t(`Preferred: ${detail.preferred_contact || "not specified"}`, `المفضّل: ${detail.preferred_contact || "غير محدد"}`)}</p></div><div className="grid grid-cols-2 gap-2 border-t border-border pt-5 text-xs"><Consent yes={detail.contact_consent} label={t("Contact request", "التواصل بشأن الطلب")} /><Consent yes={detail.marketing_consent} label={t("Marketing", "التسويق")} /><Consent yes={detail.partner_sharing_consent} label={t("Partner sharing", "مشاركة الشركاء")} /></div>{detail.financing_requests && <div className="space-y-2 border-t border-border pt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Submitted figures", "الأرقام المقدّمة")}</h3><div className="grid grid-cols-2 gap-3">{Object.entries(detail.financing_requests).filter(([key, value]) => value !== null && !["id", "status", "created_at"].includes(key)).map(([key, value]) => <Info key={key} label={key.replaceAll("_", " ")} value={String(value)} />)}</div></div>}
              <div className="space-y-3 border-t border-border pt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Follow-up", "المتابعة")}</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">{t("Status", "الحالة")}<select className="mt-1 block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground" value={detail.status} disabled={!canEdit || saving} onChange={(event) => void updateLead({ status: event.target.value })}>{STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label><label className="text-xs text-muted-foreground">{t("Next follow-up", "المتابعة القادمة")}<input type="date" className="mt-1 block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground" value={detail.next_follow_up_at?.slice(0, 10) ?? ""} disabled={!canEdit || saving} onChange={(event) => void updateLead({ next_follow_up_at: event.target.value ? `${event.target.value}T09:00:00+03:00` : null })} /></label></div>{canEdit && <button className="text-xs text-[var(--brand-accent)] underline-offset-4 hover:underline" onClick={() => void updateLead({ owner_user_id: detail.owner_user_id === data.currentUserId ? null : data.currentUserId })}>{detail.owner_user_id === data.currentUserId ? t("Remove me as owner", "إزالة مسؤوليتي") : t("Assign to me", "إسنادها إليّ")}</button>}</div><div className="space-y-3 border-t border-border pt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Team notes", "ملاحظات الفريق")}</h3>{detail.lead_notes.length ? detail.lead_notes.map((item) => <div key={item.id} className="rounded-xl bg-muted/60 px-4 py-3"><p className="whitespace-pre-wrap text-sm">{item.body}</p><span className="mt-2 block text-[11px] text-muted-foreground">{datetime(item.created_at)}</span></div>) : <p className="text-xs text-muted-foreground">{t("No notes yet.", "لا توجد ملاحظات بعد.")}</p>}{canEdit && <div className="flex gap-2"><Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder={t("Add a follow-up note", "أضف ملاحظة للمتابعة")} /><Button size="sm" disabled={saving || !note.trim()} onClick={() => void saveNote()}><Plus className="size-4" />{t("Add", "إضافة")}</Button></div>}</div></div>}</div></>}
          </div>
        </div>}

        {tab === "merchants" && <div className="animate-fade-in space-y-4"><p className="max-w-2xl text-sm text-muted-foreground">{t("A read-only view of each store's real setup milestones. A test channel is shown as a test, never as a live customer channel.", "عرض للقراءة فقط لمراحل إعداد كل متجر. تُعرض القناة التجريبية كتجربة، لا كقناة عملاء فعّالة.")}</p><div className="grid gap-3">{merchants.map((merchant) => <div key={merchant.id} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{merchant.name}</h2><p className="mt-1 text-xs text-muted-foreground">{t("Joined", "انضمّ")} {date(merchant.created_at)}</p></div><span className="text-xs text-muted-foreground">{merchant.caseCount} {t("cases", "حالات")}</span></div><div className="mt-4 flex flex-wrap gap-2"><Milestone done={merchant.account} label={t("Account", "حساب")} /><Milestone done={merchant.commerce?.status === "CONNECTED"} label={t("Salla connected", "سلة متصلة")} /><Milestone done={merchant.policy} label={t("Policy published", "سياسة منشورة")} /><Milestone done={merchant.firstDecision} label={t("First decision", "أول قرار")} /><span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">{t("WhatsApp", "واتساب")}: {merchant.whatsapp?.status ?? t("Not connected", "غير متصل")}</span></div>{merchant.commerce?.last_error_code && <p className="mt-3 text-xs text-destructive">{t("Salla issue", "مشكلة في سلة")}: {merchant.commerce.last_error_code}</p>}</div>)}{merchants.length === 0 && <Empty text={t("No merchant accounts yet.", "لا توجد حسابات تجار بعد.")} />}</div></div>}

        {tab === "returns" && <div className="animate-fade-in space-y-6"><p className="max-w-2xl text-sm text-muted-foreground">{t("Based on recorded decisions, including requests that never became a case.", "تستند إلى القرارات المسجلة، بما فيها الطلبات التي لم تتحول إلى حالة.")}</p><div className="grid gap-3 sm:grid-cols-3">{outcomes.map(({ name, count }) => <Metric key={name} label={name === "ELIGIBLE" ? t("Eligible", "مؤهل") : name === "MANUAL_REVIEW" ? t("Needs review", "يحتاج مراجعة") : t("Not eligible", "غير مؤهل")} value={count} note={t("Recorded decisions", "قرارات مسجلة")} />)}</div><div className="grid gap-5 xl:grid-cols-2"><Panel title={t("Return cases", "حالات الإرجاع")} subtitle={t("Operational state, separate from eligibility.", "الحالة التشغيلية مستقلة عن قرار الأهلية.")}><div className="space-y-3">{["OPEN", "AWAITING_ITEM", "RECEIVED", "RESOLVED", "CANCELLED"].map((status) => <BarRow key={status} label={status.replaceAll("_", " ")} value={data.cases.filter((row) => row.status === status).length} total={data.cases.length} />)}</div></Panel><Panel title={t("Why cases need review", "أسباب المراجعة اليدوية")} subtitle={t("Most common reason codes in recorded decisions.", "أكثر الرموز تكرارًا في القرارات المسجلة.")}><div className="space-y-3">{reviewReasons.length ? reviewReasons.map(([reason, count]) => <BarRow key={reason} label={reason.replaceAll("_", " ")} value={count} total={data.decisions.length} />) : <Empty text={t("No manual-review decisions recorded.", "لا توجد قرارات مراجعة يدوية مسجلة.")} />}</div></Panel></div><p className="text-xs text-muted-foreground">{t("Recent records shown; not a payout or savings report.", "السجلات المعروضة حديثة؛ هذا ليس تقريرًا بالمبالغ المصروفة أو التوفير.")}</p></div>}

        {tab === "health" && <div className="animate-fade-in space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Metric label={t("Salla issues", "مشكلات سلة")} value={data.commerce.filter((row) => row.status === "ERROR" || row.status === "EXPIRED").length} note={t("Connections needing attention", "اتصالات تحتاج متابعة")} /><Metric label={t("Failed webhooks", "أحداث فاشلة")} value={data.failedEvents.length} note={t("Recent recorded failures", "إخفاقات مسجلة حديثًا")} /><Metric label={t("Failed WhatsApp sends", "رسائل واتساب فاشلة")} value={data.failedMessages.length} note={t("Recent recorded failures", "إخفاقات مسجلة حديثًا")} /></div><Panel title={t("Needs attention", "يحتاج انتباهًا")} subtitle={t("Connection and delivery errors from real events.", "مشكلات الاتصال والتسليم من الأحداث الفعلية.")}><div className="divide-y divide-border/70">{data.commerce.filter((row) => row.status === "ERROR" || row.status === "EXPIRED").map((row) => <HealthRow key={`c-${row.store_id}`} title={storeName(row.store_id)} detail={`Salla · ${row.last_error_code ?? row.status}`} />)}{data.whatsapp.filter((row) => row.status === "ERROR" || row.status === "RESTRICTED").map((row) => <HealthRow key={`w-${row.store_id}`} title={storeName(row.store_id)} detail={`WhatsApp · ${row.status}`} />)}{data.failedEvents.map((row, index) => <HealthRow key={`e-${index}`} title={storeName(row.store_id)} detail={`${row.provider} · ${row.event_type} · ${row.last_error ?? "FAILED"}`} />)}{data.failedMessages.map((row, index) => <HealthRow key={`m-${index}`} title={storeName(row.store_id)} detail={`WhatsApp · ${row.failure_code ?? "FAILED"}`} />)}{!data.commerce.some((row) => row.status === "ERROR" || row.status === "EXPIRED") && !data.whatsapp.some((row) => row.status === "ERROR" || row.status === "RESTRICTED") && !data.failedEvents.length && !data.failedMessages.length && <Empty text={t("No recorded failures in this view.", "لا توجد إخفاقات مسجلة في هذا العرض.")} />}</div></Panel><p className="text-xs text-muted-foreground">{t("A quiet log does not prove an integration is healthy; check its last activity too.", "عدم وجود أخطاء لا يثبت سلامة التكامل؛ راجع آخر نشاط أيضًا.")}</p></div>}

        {tab === "feedback" && <div className="animate-fade-in space-y-4"><p className="text-sm text-muted-foreground">{t("Reports from merchants and WhatsApp conversations.", "بلاغات التجار ومحادثات واتساب.")}</p>{data.reports.map((report) => <div key={report.id} className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{report.report_type === "BUG" ? t("Problem", "مشكلة") : t("Feedback", "ملاحظة")} · {report.status}</span><span className="text-xs text-muted-foreground">{date(report.created_at)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6" dir="auto">{report.message}</p><p className="mt-3 text-xs text-muted-foreground">{storeName(report.store_id)} · {report.source_channel}</p></div>)}{!data.reports.length && <Empty text={t("No feedback reports yet.", "لا توجد بلاغات بعد.")} />}</div>}

        {tab === "audit" && <div className="animate-fade-in grid gap-5 xl:grid-cols-2"><Panel title={t("Merchant activity", "نشاط التجار")} subtitle={t("Events recorded inside merchant workspaces.", "أحداث مسجلة داخل مساحات التجار.")}><div className="divide-y divide-border/70">{data.merchantAudit.map((event) => <ActivityRow key={event.id} title={event.event_type.replaceAll("_", " ")} detail={`${storeName(event.store_id)} · ${event.entity_type}`} time={date(event.created_at)} />)}{!data.merchantAudit.length && <Empty text={t("No activity recorded.", "لا يوجد نشاط مسجل.")} />}</div></Panel><Panel title={t("Team access", "وصول الفريق")} subtitle={t("Internal admin views and changes.", "عمليات العرض والتعديل الداخلية.")}><div className="divide-y divide-border/70">{data.adminAudit.map((event) => <ActivityRow key={event.id} title={event.event_type.replaceAll("_", " ")} detail={event.entity_type} time={date(event.created_at)} />)}{!data.adminAudit.length && <Empty text={t("No team activity recorded.", "لا يوجد نشاط للفريق مسجل.")} />}</div></Panel></div>}
      </main>
    </div>
    {importOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setImportOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby="import-title" className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 id="import-title" className="text-xl font-semibold">{t("Import event sheet", "استيراد قائمة الفعالية")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("CSV with store_name, contact_name and email or phone columns.", "ملف CSV بأعمدة store_name وcontact_name وبريد أو رقم هاتف.")}</p></div><button onClick={() => setImportOpen(false)} aria-label={t("Close", "إغلاق")}><X className="size-5" /></button></div><label className="mt-6 block text-sm font-medium">{t("Source / event name", "اسم المصدر أو الفعالية")}<Input className="mt-1" value={importSource} onChange={(event) => setImportSource(event.target.value)} maxLength={120} placeholder={t("Riyadh event, October 2026", "فعالية الرياض، أكتوبر 2026")} /></label><label className="mt-4 block text-sm font-medium">{t("CSV file", "ملف CSV")}<input type="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setCsv); }} /></label><p className="mt-4 text-xs leading-5 text-muted-foreground">{t("Existing contacts are skipped. Marketing consent is never inferred from a sheet.", "يتم تجاوز جهات الاتصال الموجودة. لا يُستنتج قبول التسويق من القائمة.")}</p><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setImportOpen(false)}>{t("Cancel", "إلغاء")}</Button><Button disabled={importing || !csv || !importSource.trim()} onClick={() => void importCsv()}>{t("Import leads", "استيراد العملاء")}</Button></div></div></div>}
  </div>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) { return <div className="rounded-2xl border border-border bg-card px-5 py-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-5 text-4xl font-semibold tracking-[-.06em] tabular-nums">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></div>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p><div className="mt-5">{children}</div></section>; }
function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl bg-muted/60 px-3 py-2.5"><p className="truncate text-[11px] text-muted-foreground capitalize">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div>; }
function StatusPill({ value, label }: { value: string; label: string }) { return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", value === "new" ? "bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]" : value === "customer" ? "bg-eligible-muted text-eligible" : "bg-muted text-muted-foreground")}>{label}</span>; }
function Consent({ yes, label }: { yes: boolean; label: string }) { return <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5", yes ? "bg-eligible-muted text-eligible" : "bg-muted text-muted-foreground")}>{yes ? <Check className="size-3" /> : <X className="size-3" />}{label}</span>; }
function Milestone({ done, label }: { done: boolean; label: string }) { return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]", done ? "border-eligible/20 bg-eligible-muted text-eligible" : "border-border text-muted-foreground")}>{done ? <Check className="size-3" /> : <span className="size-1 rounded-full bg-current" />}{label}</span>; }
function BarRow({ label, value, total }: { label: string; value: number; total: number }) { return <div><div className="mb-1.5 flex justify-between gap-2 text-xs"><span>{label}</span><strong className="tabular-nums">{value}</strong></div><div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--brand-accent)] transition-[width] duration-300" style={{ width: `${total ? (value / total) * 100 : 0}%` }} /></div></div>; }
function HealthRow({ title, detail }: { title: string; detail: string }) { return <div className="flex items-start gap-3 py-3"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-review" /><div><p className="text-sm font-medium">{title}</p><p className="mt-1 break-all text-xs text-muted-foreground">{detail}</p></div></div>; }
function ActivityRow({ title, detail, time }: { title: string; detail: string; time: string }) { return <div className="flex justify-between gap-3 py-3 text-sm"><span><strong className="block text-xs font-medium">{title}</strong><span className="text-xs text-muted-foreground">{detail}</span></span><span className="shrink-0 text-[11px] text-muted-foreground">{time}</span></div>; }
