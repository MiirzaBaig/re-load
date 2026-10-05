"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, ChevronDown, ChevronUp, Copy, Mail, MessageCircle, Send, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Initial, SaveIndicator, SectionLabel, QUICK } from "@/components/desk/primitives";
import { StatusMenu } from "@/components/admin/status-menu";
import type { Lead, LeadChanges, LeadDetail, LeadNote, TeamMember } from "@/components/admin/types";
import { memberName } from "@/components/admin/views/team";
import { followUpIn, isDue, toIsoDay, type Labels } from "@/components/admin/use-labels";
import { cn } from "@/lib/utils";
import { PLATFORMS, PLATFORM_COLOR, PLATFORM_LABEL, platformOf, type Platform } from "@/lib/platforms";

type Props = {
  team: TeamMember[];
  leadId: string | null;
  lead: Lead | undefined;
  /** The list the drawer steps through with ↑/↓ (what's currently visible). */
  sequence: string[];
  labels: Labels;
  canEdit: boolean;
  currentUserId: string;
  saveState?: "saving" | "saved";
  update: (id: string, changes: LeadChanges, options?: { message?: string; undoable?: boolean }) => Promise<boolean>;
  onNavigate: (id: string | null) => void;
};

/**
 * A lead opens in a drawer that slides over the page, so the board or table
 * underneath never reflows (the old inline panel resized the grid).
 */
export function LeadDrawer({ team, leadId, lead, sequence, labels, canEdit, currentUserId, saveState, update, onNavigate }: Props) {
  const { t, isArabic } = labels;
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState("overview");
  const request = useRef(0);

  const load = useCallback(async (id: string, { quiet = false } = {}) => {
    const ticket = ++request.current;
    if (!quiet) { setDetail(null); setFailed(false); }
    try {
      const response = await fetch(`/api/admin/leads/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (ticket === request.current) setDetail(result.lead);
    } catch {
      if (ticket === request.current && !quiet) setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (leadId) void load(leadId);
  }, [leadId, load]);

  const index = leadId ? sequence.indexOf(leadId) : -1;
  const step = useCallback((delta: number) => {
    const next = sequence[index + delta];
    if (next) onNavigate(next);
  }, [index, sequence, onNavigate]);

  // ↑/↓ step through leads without closing, unless typing.
  useEffect(() => {
    if (!leadId) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [role=menu], [role=dialog] [role=grid]")) return;
      if (event.key === "ArrowDown" || event.key === "j") { event.preventDefault(); step(1); }
      if (event.key === "ArrowUp" || event.key === "k") { event.preventDefault(); step(-1); }
      if (event.key === "n" && canEdit) { event.preventDefault(); setTab("notes"); window.setTimeout(() => document.getElementById("lead-note")?.focus(), 60); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leadId, step, canEdit]);

  // The list holds the latest status and follow-up (edited optimistically);
  // the fetched record adds contact details and notes.
  const view = detail && lead && detail.id === lead.id ? { ...detail, ...lead } : null;
  const header = lead ?? view;

  return <Sheet open={!!leadId} onOpenChange={(open) => { if (!open) onNavigate(null); }}>
    <SheetContent side={isArabic ? "left" : "right"} showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-[500px]" onOpenAutoFocus={(event) => event.preventDefault()}>
      <SheetTitle className="sr-only">{header?.store_name ?? t("Lead", "عميل محتمل")}</SheetTitle>
      <SheetDescription className="sr-only">{t("Lead record and follow-up", "سجل العميل المحتمل والمتابعة")}</SheetDescription>

      {/* Header */}
      <div className="border-b border-border px-5 pb-4 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={index <= 0} onClick={() => step(-1)} aria-label={t("Previous lead", "العميل السابق")}><ChevronUp className="size-4" /></Button>
            <Button variant="ghost" size="icon-sm" disabled={index < 0 || index >= sequence.length - 1} onClick={() => step(1)} aria-label={t("Next lead", "العميل التالي")}><ChevronDown className="size-4" /></Button>
            {index >= 0 && <span className="ms-1 text-[11px] tabular-nums text-muted-foreground">{index + 1} / {sequence.length}</span>}
          </div>
          <div className="flex items-center gap-3">
            <SaveIndicator state={saveState} />
            <Button variant="ghost" size="icon-sm" onClick={() => onNavigate(null)} aria-label={t("Close", "إغلاق")}><X className="size-4" /></Button>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={leadId ?? "none"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={QUICK}>
            {header ? <div className="mt-4 flex items-start gap-3">
              <Initial name={header.store_name} className="size-11 rounded-2xl text-base" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold tracking-tight" dir="auto">{header.store_name}</h2>
                <p className="mt-0.5 truncate text-sm text-muted-foreground" dir="auto">{header.contact_name} · {header.source_label}</p>
              </div>
            </div> : <div className="mt-4 flex gap-3"><Skeleton className="size-11 rounded-2xl" /><div className="flex-1 space-y-2 pt-1"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /></div></div>}
            {lead && <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusMenu status={lead.status} labels={labels} disabled={!canEdit} onChange={(status) => void update(lead.id, { status }, { message: t(`Moved to ${labels.status(status)}.`, `نُقل إلى ${labels.status(status)}.`), undoable: true })} />
              {canEdit && <button type="button" onClick={() => void update(lead.id, { owner_user_id: lead.owner_user_id === currentUserId ? null : currentUserId }, { message: lead.owner_user_id === currentUserId ? t("Unassigned.", "أُلغي الإسناد.") : t("Assigned to you.", "أُسند إليك.") })} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-200", lead.owner_user_id === currentUserId ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground")}>
                <UserRound className="size-3.5" />{lead.owner_user_id === currentUserId ? t("You own this", "أنت المسؤول") : lead.owner_user_id ? (() => { const owner = team.find((m) => m.user_id === lead.owner_user_id); return owner ? t(`Owned by ${memberName(owner)}`, `لدى ${memberName(owner)}`) : t("Owned by a teammate", "لدى زميل"); })() : t("Assign to me", "أسنده إليّ")}
              </button>}
              {isDue(lead) && <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-review-muted px-2.5 text-xs font-medium text-review"><CalendarDays className="size-3.5" />{t("Follow-up due", "متابعة مستحقة")}</span>}
            </div>}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {failed ? <div className="p-6 text-center"><p className="text-sm text-muted-foreground">{t("Couldn't open this lead.", "تعذّر فتح هذا العميل.")}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => leadId && void load(leadId)}>{t("Try again", "حاول مرة أخرى")}</Button></div>
          : !view ? <DrawerSkeleton />
            : <Tabs value={tab} onValueChange={setTab} className="gap-0">
              <div className="px-5 pt-4 sm:px-6"><ContactActions detail={view} labels={labels} /></div>
              <div className="sticky top-0 z-10 bg-background/95 px-5 pb-3 pt-4 backdrop-blur sm:px-6">
                <TabsList className="w-full"><TabsTrigger value="overview" className="flex-1">{t("Overview", "نظرة عامة")}</TabsTrigger><TabsTrigger value="notes" className="flex-1">{t("Notes", "الملاحظات")}{view.lead_notes.length ? <span className="ms-1 tabular-nums text-muted-foreground">{view.lead_notes.length}</span> : null}</TabsTrigger></TabsList>
              </div>
              <TabsContent value="overview" className="admin-fade space-y-6 px-5 pb-8 pt-2 sm:px-6">
                <PlatformPicker lead={view} labels={labels} canEdit={canEdit} update={update} />
                <FollowUp lead={view} labels={labels} canEdit={canEdit} update={update} />
                <section className="space-y-3"><SectionLabel>{t("Details", "التفاصيل")}</SectionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <Info label={t("Interest", "الاهتمام")} value={labels.interest(view.interest)} />
                    <Info label={t("Source", "المصدر")} value={view.source_label} />
                    <Info label={t("Requested", "تاريخ الطلب")} value={labels.date(view.created_at)} />
                    <Info label={t("Prefers", "يفضّل")} value={view.preferred_contact ? labels.code(view.preferred_contact) : "—"} />
                    <Info label={t("Website", "الموقع")} value={view.website || "—"} />
                  </div>
                </section>
                <section className="space-y-3"><SectionLabel>{t("Consent", "الموافقات")}</SectionLabel>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Consent yes={view.contact_consent} label={t("Contact request", "التواصل بشأن الطلب")} />
                    <Consent yes={view.marketing_consent} label={t("Marketing", "التسويق")} />
                    <Consent yes={view.partner_sharing_consent} label={t("Partner sharing", "مشاركة الشركاء")} />
                  </div>
                </section>
                {view.financing_requests && <section className="space-y-3"><SectionLabel>{t("Submitted figures", "الأرقام المقدّمة")}</SectionLabel>
                  <div className="grid grid-cols-2 gap-2">{Object.entries(view.financing_requests).filter(([key, value]) => value !== null && !["id", "status", "created_at"].includes(key)).map(([key, value]) => <Info key={key} label={labels.code(key)} value={String(value)} />)}</div>
                </section>}
              </TabsContent>
              <TabsContent value="notes" className="admin-fade px-5 pb-8 pt-2 sm:px-6">
                <Notes team={team} lead={view} labels={labels} canEdit={canEdit} currentUserId={currentUserId} onSaved={(note) => setDetail((current) => current ? { ...current, lead_notes: [note, ...current.lead_notes] } : current)} onRefresh={() => leadId && void load(leadId, { quiet: true })} />
              </TabsContent>
            </Tabs>}
      </div>
    </SheetContent>
  </Sheet>;
}

function ContactActions({ detail, labels }: { detail: LeadDetail; labels: Labels }) {
  const { t } = labels;
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(t("Copied.", "تم النسخ.")); }
    catch { toast.error(t("Couldn't copy.", "تعذّر النسخ.")); }
  };
  const phone = detail.phone?.replace(/\D/g, "");
  return <div className="grid grid-cols-3 gap-2">
    <ActionTile icon={MessageCircle} label="WhatsApp" href={phone ? `https://wa.me/${phone}` : undefined} />
    <ActionTile icon={Mail} label={t("Email", "البريد")} href={detail.email ? `mailto:${detail.email}` : undefined} />
    <ActionTile icon={Copy} label={t("Copy phone", "نسخ الرقم")} onClick={detail.phone ? () => void copy(detail.phone!) : undefined} />
    {(detail.email || detail.phone) && <p className="col-span-3 truncate text-xs text-muted-foreground" dir="ltr">{[detail.phone, detail.email].filter(Boolean).join(" · ")}</p>}
  </div>;
}

function ActionTile({ icon: Icon, label, href, onClick }: { icon: typeof Mail; label: string; href?: string; onClick?: () => void }) {
  const cls = "flex flex-col items-center gap-1.5 rounded-xl border border-border px-2 py-3 text-xs font-medium transition-[background-color,border-color,transform] duration-200 active:scale-[.98]";
  const content = <><Icon className="size-4" />{label}</>;
  if (href) return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cn(cls, "hover:border-foreground/25 hover:bg-muted/50")}>{content}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, "hover:border-foreground/25 hover:bg-muted/50")}>{content}</button>;
  return <span aria-disabled="true" className={cn(cls, "cursor-not-allowed text-muted-foreground/50")}>{content}</span>;
}

function PlatformPicker({ lead, labels, canEdit, update }: { lead: Lead; labels: Labels; canEdit: boolean; update: Props["update"] }) {
  const { t, isArabic } = labels;
  const current = platformOf(lead.store_platform);
  const raw = lead.store_platform?.trim();
  const name = (p: Platform) => (isArabic ? PLATFORM_LABEL[p].ar : PLATFORM_LABEL[p].en);
  const choose = (option: Platform) => {
    const next = current === option ? null : option;
    void update(lead.id, { store_platform: next }, {
      message: next ? t(`Platform set to ${name(next)}.`, `المنصة: ${name(next)}.`) : t("Platform cleared.", "أُزيلت المنصة."),
      undoable: true,
    });
  };
  return <section className="space-y-3">
    <div className="flex items-baseline justify-between gap-2">
      <SectionLabel>{t("Store platform", "منصة المتجر")}</SectionLabel>
      {!current && <span className="text-[11px] text-muted-foreground">{t("Not given yet", "لم تُحدَّد بعد")}</span>}
    </div>
    <div role="radiogroup" aria-label={t("Store platform", "منصة المتجر")} className="relative grid grid-cols-4 gap-1 rounded-2xl border border-border bg-muted/40 p-1">
      {PLATFORMS.map((option) => {
        const active = current === option;
        return <button key={option} type="button" role="radio" aria-checked={active} disabled={!canEdit} onClick={() => choose(option)}
          className={cn("relative z-0 flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors duration-200 disabled:cursor-default", active ? "text-foreground" : "text-muted-foreground enabled:hover:text-foreground")}>
          {active && <motion.span layoutId={`platform-${lead.id}`} transition={QUICK} className="absolute inset-0 -z-10 rounded-xl border border-border bg-background shadow-[0_1px_2px_rgba(15,15,18,.08)]" />}
          <span aria-hidden="true" className="size-2 rounded-full transition-transform duration-200" style={{ background: PLATFORM_COLOR[option], transform: active ? "scale(1.3)" : "none" }} />
          {name(option)}
        </button>;
      })}
    </div>
    {raw && current === "Other" && raw !== "Other" && <p className="text-xs text-muted-foreground">{t("They wrote:", "كتبوا:")} <span className="font-medium text-foreground" dir="auto">“{raw}”</span></p>}
  </section>;
}

function FollowUp({ lead, labels, canEdit, update }: { lead: Lead; labels: Labels; canEdit: boolean; update: Props["update"] }) {
  const { t } = labels;
  const [open, setOpen] = useState(false);
  const set = (value: string | null, message: string) => void update(lead.id, { next_follow_up_at: value }, { message, undoable: true });
  const presets = [
    { days: 1, label: t("Tomorrow", "غدًا") },
    { days: 3, label: t("In 3 days", "بعد 3 أيام") },
    { days: 7, label: t("Next week", "الأسبوع القادم") },
  ];
  const current = lead.next_follow_up_at;
  return <section className="rounded-2xl border border-border p-4">
    <div className="flex items-start justify-between gap-3">
      <div><SectionLabel>{t("Next follow-up", "المتابعة القادمة")}</SectionLabel>
        <p className={cn("mt-2 text-sm font-medium", current && isDue(lead) && "text-review")}>{current ? `${labels.date(current)} · ${labels.relative(current)}` : t("Not scheduled", "غير مجدولة")}</p>
      </div>
      {canEdit && current && <button type="button" onClick={() => set(null, t("Follow-up cleared.", "أُزيلت المتابعة."))} className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">{t("Clear", "إزالة")}</button>}
    </div>
    {canEdit && <div className="mt-3 flex flex-wrap gap-2">
      {presets.map(({ days, label }) => <button key={days} type="button" onClick={() => set(followUpIn(days), t(`Follow-up set for ${label.toLowerCase()}.`, `حُددت المتابعة: ${label}.`))} className="h-8 rounded-full border border-border px-3 text-xs font-medium transition-[background-color,border-color,transform] duration-200 hover:border-foreground/25 hover:bg-muted/50 active:scale-[.98]">{label}</button>)}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition-[background-color,border-color] duration-200 hover:border-foreground/25 hover:bg-muted/50 data-[state=open]:bg-muted"><CalendarDays className="size-3.5" />{t("Pick a date", "اختر تاريخًا")}</button></PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar mode="single" selected={current ? new Date(current) : undefined} disabled={{ before: new Date() }} onSelect={(day) => { if (!day) return; setOpen(false); set(`${toIsoDay(day)}T09:00:00+03:00`, t(`Follow-up set for ${labels.date(day.toISOString())}.`, `حُددت المتابعة في ${labels.date(day.toISOString())}.`)); }} />
        </PopoverContent>
      </Popover>
    </div>}
  </section>;
}

function Notes({ team, lead, labels, canEdit, currentUserId, onSaved, onRefresh }: { team: TeamMember[]; lead: LeadDetail; labels: Labels; canEdit: boolean; currentUserId: string; onSaved: (note: LeadNote) => void; onRefresh: () => void }) {
  const { t } = labels;
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/leads/${lead.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
      if (!response.ok) throw new Error();
      onSaved({ id: `local-${Date.now()}`, body: text, created_at: new Date().toISOString(), author_user_id: currentUserId });
      setBody("");
      onRefresh();
    } catch { toast.error(t("Couldn't save this note.", "تعذّر حفظ الملاحظة.")); }
    finally { setSaving(false); }
  };
  return <div className="space-y-5">
    {canEdit && <div className="rounded-2xl border border-border p-3 transition-[border-color,box-shadow] duration-200 focus-within:border-foreground/30 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_18%,transparent)]">
      <Textarea id="lead-note" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} placeholder={t("What happened, and what's next?", "ماذا حدث، وما الخطوة التالية؟")} className="min-h-20 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0 dark:bg-transparent" onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void save(); } }} />
      <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">⌘ ↵ {t("to save", "للحفظ")}</span><Button size="sm" disabled={saving || !body.trim()} onClick={() => void save()}><Send className="size-3.5 rtl:-scale-x-100" />{t("Add note", "إضافة")}</Button></div>
    </div>}
    <ol className="relative space-y-4 border-s border-border ps-5">
      <AnimatePresence initial={false}>
        {lead.lead_notes.map((note) => <motion.li key={note.id} layout="position" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={QUICK} className="relative">
          <span className="absolute -start-[25px] top-1.5 size-2 rounded-full border-2 border-background bg-foreground" />
          <div className="rounded-xl bg-muted/50 px-4 py-3"><p className="whitespace-pre-wrap text-sm leading-6" dir="auto">{note.body}</p></div>
          <span className="mt-1.5 block text-[11px] text-muted-foreground">{note.author_user_id === currentUserId ? t("You", "أنت") : (() => { const author = team.find((m) => m.user_id === note.author_user_id); return author ? memberName(author) : t("Teammate", "زميل"); })()} · {labels.datetime(note.created_at)}</span>
        </motion.li>)}
      </AnimatePresence>
      <li className="relative">
        <span className="absolute -start-[25px] top-1.5 size-2 rounded-full border-2 border-background bg-muted-foreground/50" />
        <p className="text-sm">{t("Lead created", "أُنشئ العميل")} <span className="text-muted-foreground">· {lead.source_label}</span></p>
        <span className="mt-1 block text-[11px] text-muted-foreground">{labels.datetime(lead.created_at)}</span>
      </li>
    </ol>
  </div>;
}

function DrawerSkeleton() {
  return <div className="space-y-6 px-5 py-5 sm:px-6">
    <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
    <Skeleton className="h-9 rounded-lg" />
    <Skeleton className="h-28 rounded-2xl" />
    <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2.5"><p className="truncate text-[11px] text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium" dir="auto">{value}</p></div>;
}

function Consent({ yes, label }: { yes: boolean; label: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1", yes ? "bg-eligible-muted text-eligible" : "bg-muted text-muted-foreground")}>{yes ? <Check className="size-3" /> : <X className="size-3" />}{label}</span>;
}
