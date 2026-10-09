"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MotionConfig, motion } from "framer-motion";
import {
  Activity, ClipboardList, Ellipsis, FileText, LayoutDashboard, LogOut, MessageSquareWarning,
  PanelLeftClose, PanelLeftOpen, Search, Store, UserRound, Users, UsersRound, Keyboard, ExternalLink,
} from "lucide-react";
import { AdminEventLink } from "@/components/admin-event-link";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { ReloadLogo } from "@/components/reload-logo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { platformOf } from "@/lib/platforms";
import { AdminCommand, type NavItem } from "@/components/admin/admin-command";
import { ImportDialog } from "@/components/admin/import-dialog";
import { LeadDrawer } from "@/components/admin/lead-drawer";
import { TWEEN } from "@/components/desk/primitives";
import type { AdminData, Merchant } from "@/components/admin/types";
import { useDeskState, type DeskState, type View } from "@/components/admin/use-admin-state";
import { isDue, useLabels } from "@/components/admin/use-labels";
import { useLeads } from "@/components/admin/use-leads";
import { LeadsView, type LeadFilters } from "@/components/admin/views/leads";
import { MerchantDrawer, MerchantsView } from "@/components/admin/views/merchants";
import { ActivityView, FeedbackView, HealthView, ReturnsView } from "@/components/admin/views/operations";
import { TodayView } from "@/components/admin/views/today";
import { Avatar, TeamView, memberName } from "@/components/admin/views/team";
import { AdminWelcome } from "@/components/admin/welcome";

const SIDEBAR_KEY = "reload-admin-sidebar";

export function AdminShell({ initial, ...data }: AdminData & { initial: DeskState }) {
  const router = useRouter();
  const labels = useLabels();
  const { t } = labels;
  const [state, go] = useDeskState(initial);
  const { leads, update, saveState } = useLeads(data.leads);
  const [filters, setFilters] = useState<LeadFilters>({ query: "", source: null, mine: false, platform: null });
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [channelBusy, setChannelBusy] = useState<string | null>(null);
  const canEdit = data.role !== "viewer";
  const me = data.team.find((member) => member.user_id === data.currentUserId);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1"); } catch { /* storage blocked: stay expanded */ }
  }, []);
  const toggleSidebar = () => setCollapsed((value) => {
    try { localStorage.setItem(SIDEBAR_KEY, value ? "0" : "1"); } catch { /* not remembered */ }
    return !value;
  });

  /* ── Derived data ── */
  const storeName = useCallback((id: string | null) => data.stores.find((store) => store.id === id)?.name ?? t("Unknown store", "متجر غير معروف"), [data.stores, t]);
  const merchants = useMemo<Merchant[]>(() => data.stores.map((store) => {
    const policies = data.policies.filter((row) => row.store_id === store.id).map((row) => row.published_at).sort();
    const decisions = data.decisions.filter((row) => row.store_id === store.id).map((row) => row.evaluated_at).sort();
    return {
      ...store,
      account: data.memberships.some((row) => row.store_id === store.id && row.role === "owner"),
      commerce: data.commerce.find((row) => row.store_id === store.id),
      policy: policies.length > 0,
      policyAt: policies[0],
      whatsapp: data.whatsapp.find((row) => row.store_id === store.id),
      firstDecision: decisions.length > 0,
      firstDecisionAt: decisions[0],
      caseCount: data.cases.filter((row) => row.store_id === store.id).length,
    };
  }), [data]);
  const visibleLeads = useMemo(() => {
    const q = filters.query.toLocaleLowerCase().trim();
    return leads.filter((lead) => {
      if (filters.source && lead.source_label !== filters.source) return false;
      if (filters.mine && lead.owner_user_id !== data.currentUserId) return false;
      if (filters.platform && (platformOf(lead.store_platform) ?? "unknown") !== filters.platform) return false;
      return !q || `${lead.store_name} ${lead.contact_name} ${lead.source_label} ${lead.interest ?? ""} ${lead.store_platform ?? ""}`.toLocaleLowerCase().includes(q);
    });
  }, [leads, filters, data.currentUserId]);
  // Today's queue: overdue follow-ups first, then new requests that aren't snoozed.
  const queue = useMemo(() => {
    const due = leads.filter(isDue).sort((a, b) => (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? ""));
    const fresh = leads.filter((lead) => lead.status === "new" && !isDue(lead) && !lead.next_follow_up_at);
    return [...due, ...fresh];
  }, [leads]);
  const issues = data.commerce.filter((row) => row.status === "ERROR" || row.status === "EXPIRED").length
    + data.whatsapp.filter((row) => row.status === "ERROR" || row.status === "RESTRICTED").length
    + data.failedEvents.length + data.failedMessages.length;

  const nav: (NavItem & { count?: number; tone?: "review" })[] = [
    { id: "today", label: t("Today", "اليوم"), icon: LayoutDashboard, key: "t", count: queue.length || undefined },
    { id: "leads", label: t("Leads", "العملاء المحتملون"), icon: Users, key: "l", count: leads.length || undefined },
    { id: "merchants", label: t("Merchants", "التجار"), icon: Store, key: "m" },
    { id: "returns", label: t("Returns", "المرتجعات"), icon: ClipboardList, key: "r" },
    { id: "health", label: t("Channel health", "حالة القنوات"), icon: Activity, key: "h", count: issues || undefined, tone: "review" },
    { id: "feedback", label: t("Feedback", "الملاحظات"), icon: MessageSquareWarning, key: "f" },
    { id: "activity", label: t("Activity", "النشاط"), icon: FileText, key: "a" },
    { id: "team", label: t("Team", "الفريق"), icon: UsersRound, key: "u" },
  ];
  const current = nav.find((item) => item.id === state.view) ?? nav[0];

  const openView = useCallback((view: View, extra: Partial<DeskState> = {}) => {
    go({ view, ...extra });
    window.scrollTo({ top: 0 });
  }, [go]);
  const openLead = useCallback((id: string | null, viewOverride?: View) => {
    go(viewOverride ? { view: viewOverride, lead: id } : { lead: id }, { push: !!id && !state.lead });
  }, [go, state.lead]);

  /* ── Keyboard ── */
  const pendingG = useRef(0);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((open) => !open); return; }
      const target = event.target as HTMLElement;
      if (event.metaKey || event.ctrlKey || event.altKey || target.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("[role=dialog]")) return;
      if (event.key === "/") {
        event.preventDefault();
        if (state.view !== "leads") openView("leads");
        window.setTimeout(() => document.getElementById("admin-lead-search")?.focus(), 60);
      } else if (event.key === "?") {
        setHelpOpen(true);
      } else if (event.key === "g") {
        pendingG.current = Date.now();
      } else if (Date.now() - pendingG.current < 900) {
        const item = nav.find((n) => n.key === event.key);
        if (item) { event.preventDefault(); openView(item.id); }
        pendingG.current = 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const signOut = async () => {
    await getSupabaseBrowserClient()?.auth.signOut();
    window.location.href = "/admin/login";
  };

  const updateChannel = async (storeId: string, action: "connect" | "disconnect") => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setChannelBusy(storeId);
    const { error } = await client.functions.invoke("whatsapp-connection", { body: { storeId, action } });
    setChannelBusy(null);
    if (error) {
      const response = "context" in error ? error.context : null;
      const payload = response instanceof Response ? await response.json().catch(() => null) : null;
      const code = payload?.error;
      const messages: Record<string, [string, string]> = {
        platform_owner_required: ["A Reload owner with two-factor sign-in must activate this channel.", "تفعيل القناة يتطلب دخول مالك ريلود بالتحقق الثنائي."],
        store_setup_incomplete: ["Connect the store and publish its return policy first.", "اربط المتجر وانشر سياسة الإرجاع أولًا."],
        number_assigned_to_another_store: ["This number is active for another pilot store. Disconnect it there first.", "هذا الرقم مفعّل لمتجر آخر. افصله من المتجر السابق أولًا."],
        meta_number_not_ready: ["The WhatsApp number is not ready in Meta yet.", "رقم واتساب غير جاهز في ميتا بعد."],
        meta_number_unavailable: ["Could not reach the registered WhatsApp number. Check the Meta connection.", "تعذّر الوصول إلى رقم واتساب المسجل. تحقق من ربط ميتا."],
      };
      const message = messages[code] ?? ["Could not update WhatsApp. Please try again.", "تعذّر تحديث واتساب. حاول مرة أخرى."];
      toast.error(t(message[0], message[1]));
      return;
    }
    toast.success(action === "connect" ? t("WhatsApp is active for this store.", "تم تفعيل واتساب لهذا المتجر.") : t("WhatsApp was disconnected from this store.", "تم فصل واتساب عن هذا المتجر."));
    router.refresh();
  };

  const drawerSequence = state.view === "leads" ? visibleLeads.map((lead) => lead.id) : state.view === "today" ? queue.map((lead) => lead.id) : leads.map((lead) => lead.id);
  const hour = new Date().getHours();
  const todayGreeting = hour < 12 ? t("Good morning", "صباح الخير") : hour < 18 ? t("Good afternoon", "مساء الخير") : t("Good evening", "مساء الخير");
  const heading = state.view === "today" ? todayGreeting : current.label;
  // One line for the welcome: what's waiting today.
  const newCount = leads.filter((lead) => lead.status === "new").length;
  const dueCount = leads.filter(isDue).length;
  const welcomeSummary = newCount || dueCount
    ? [newCount ? t(`${newCount} new ${newCount === 1 ? "lead" : "leads"}`, `${newCount} عميل جديد`) : "", dueCount ? t(`${dueCount} ${dueCount === 1 ? "follow-up" : "follow-ups"} due`, `${dueCount} متابعة مستحقة`) : ""].filter(Boolean).join(t(" and ", " و")) + t(" waiting for you.", " بانتظارك.")
    : t("You're all caught up.", "لا شيء بانتظارك.");
  const subtitle: Record<View, string> = {
    today: new Intl.DateTimeFormat(labels.isArabic ? "ar-SA" : "en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    leads: t("Event contacts, website requests and QR sign-ups, in one pipeline.", "جهات الفعاليات وطلبات الموقع وتسجيلات QR في مسار واحد."),
    merchants: t("Each store's real setup milestones.", "مراحل الإعداد الفعلية لكل متجر."),
    returns: t("How return decisions are landing.", "كيف تُحسم قرارات الإرجاع."),
    health: t("Connection and delivery errors from real events.", "مشكلات الاتصال والتسليم من الأحداث الفعلية."),
    feedback: t("Reports from merchants and WhatsApp conversations.", "بلاغات التجار ومحادثات واتساب."),
    activity: t("What happened, across merchants and the team.", "ما حدث لدى التجار والفريق."),
    team: t("Who can open the desk, and what they can do.", "من يمكنه فتح المساحة، وماذا يمكنه أن يفعل."),
  };

  return <MotionConfig reducedMotion="user"><div className="admin-desk min-h-svh bg-background text-foreground">
    {/* ── Top bar ── */}
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Reload" className="shrink-0"><ReloadLogo className="origin-start scale-[.7] rtl:origin-end" /></Link>
        <span className="hidden h-5 w-px bg-border md:block" />
        <nav aria-label={t("Breadcrumb", "مسار التنقل")} className="hidden min-w-0 items-center gap-2 text-sm md:flex">
          <span className="text-muted-foreground">{t("Team desk", "مساحة الفريق")}</span>
          <span className="text-muted-foreground/50">/</span>
          <motion.span key={current.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={TWEEN} className="truncate font-medium">{current.label}</motion.span>
        </nav>
        <div className="ms-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setPaletteOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-xs text-muted-foreground transition-[background-color,border-color,color] duration-200 hover:border-foreground/20 hover:text-foreground sm:w-56" aria-label={t("Search", "بحث")}>
            <Search className="size-3.5" /><span className="hidden flex-1 text-start sm:inline">{t("Search or jump to…", "ابحث أو انتقل إلى…")}</span><Kbd className="hidden sm:inline-flex" dir="ltr">⌘K</Kbd>
          </button>
          <div className="hidden md:block"><AdminEventLink /></div>
          <LanguageToggle compact />
          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className="ms-1 grid size-9 place-items-center rounded-full transition-[box-shadow] hover:shadow-[0_0_0_3px_var(--muted)]" aria-label={t("Account", "الحساب")}>{me ? <Avatar name={memberName(me)} /> : <UserRound className="size-4" />}</button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold" dir="auto">{me ? memberName(me) : t("Team desk", "مساحة الفريق")}</span><span className="ms-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{data.role}</span></span>
                {me && <span className="mt-0.5 block truncate text-xs text-muted-foreground" dir="ltr">{me.email}</span>}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => openView("team")}><UsersRound className="size-4" />{t("Team", "الفريق")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/app"><ExternalLink className="size-4" />{t("Merchant workspace", "مساحة التاجر")}</Link></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setHelpOpen(true)}><Keyboard className="size-4" />{t("Keyboard shortcuts", "الاختصارات")}<span className="ms-auto text-xs text-muted-foreground">?</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}><LogOut className="size-4 rtl:-scale-x-100" />{t("Sign out", "تسجيل الخروج")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

    <div className={cn("grid grid-cols-[minmax(0,1fr)] transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.2,0,0,1)]", collapsed ? "lg:grid-cols-[68px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]")}>
      {/* ── Sidebar (desktop) ── */}
      <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] flex-col overflow-hidden border-e border-border/70 py-5 lg:flex" aria-label={t("Team desk navigation", "التنقل في مساحة الفريق")}>
        <ul className="flex flex-col gap-0.5 px-3">
          {nav.map((item) => {
            const active = item.id === state.view;
            return <li key={item.id}><button type="button" onClick={() => openView(item.id)} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined}
              className={cn("relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200", active ? "text-background" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground")}>
              {active && <motion.span layoutId="admin-nav" transition={TWEEN} className="absolute inset-0 -z-0 rounded-xl bg-foreground" />}
              <item.icon className="relative size-4 shrink-0" />
              <span className={cn("relative flex-1 truncate text-start transition-opacity duration-200", collapsed && "opacity-0")}>{item.label}</span>
              {item.count ? <span className={cn("relative rounded-md px-1.5 py-0.5 text-[11px] tabular-nums transition-opacity duration-200", collapsed && "absolute end-1.5 top-1 px-1 py-0 text-[9px]", active ? "bg-background/15 text-background" : item.tone === "review" ? "bg-review-muted text-review" : "bg-muted text-muted-foreground")}>{item.count}</span> : null}
            </button></li>;
          })}
        </ul>
        <div className="mt-auto space-y-3 px-3">
          {!collapsed && <p className="px-3 text-[11px] leading-5 text-muted-foreground">{t("Every number here comes from Reload records.", "كل رقم هنا مستند إلى سجلات ريلود.")}</p>}
          <button type="button" onClick={toggleSidebar} className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground" aria-label={collapsed ? t("Expand sidebar", "توسيع الشريط") : t("Collapse sidebar", "طي الشريط")}>
            {collapsed ? <PanelLeftOpen className="size-4 shrink-0 rtl:-scale-x-100" /> : <PanelLeftClose className="size-4 shrink-0 rtl:-scale-x-100" />}<span className={cn("truncate transition-opacity", collapsed && "opacity-0")}>{t("Collapse", "طي")}</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="min-w-0 px-4 pb-28 pt-7 sm:px-8 sm:pt-9 lg:px-10 lg:pb-14">
        <div className="mx-auto max-w-[1400px]">
          <div className="desk-rise"><motion.div key={`head-${state.view}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={TWEEN} className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 suppressHydrationWarning className="font-display text-[28px] font-semibold leading-tight tracking-[-.035em] sm:text-[34px]">{heading}</h1>
              <p suppressHydrationWarning className="mt-1.5 text-sm text-muted-foreground">{subtitle[state.view]}</p>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{t("View only", "عرض فقط")}</span>}
              {state.view === "today" && <div className="md:hidden"><AdminEventLink /></div>}
            </div>
          </motion.div></div>
          <motion.div key={state.view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.04 }}>
            {state.view === "today" && <TodayView data={data} leads={leads} merchants={merchants} issues={issues} labels={labels} canEdit={canEdit} queue={queue} onOpenLead={(id) => openLead(id)} onPlatform={(platform) => { setFilters({ query: "", source: null, mine: false, platform }); openView("leads", { layout: "board" }); }} onGo={(view, extra) => openView(view, extra ?? {})} update={update} />}
            {state.view === "leads" && <LeadsView leads={visibleLeads} allLeads={leads} layout={state.layout} status={state.status} filters={filters} selectedId={state.lead} labels={labels} canEdit={canEdit} currentUserId={data.currentUserId}
              onFilters={setFilters} onLayout={(layout) => go({ layout }, { push: false })} onStatus={(status) => go({ status }, { push: false })} onOpen={(id) => openLead(id)} onImport={() => setImportOpen(true)} update={update} />}
            {state.view === "merchants" && <MerchantsView merchants={merchants} labels={labels} selectedId={state.merchant} onOpen={(id) => go({ merchant: id })} />}
            {state.view === "returns" && <ReturnsView data={data} labels={labels} storeName={storeName} />}
            {state.view === "health" && <HealthView data={data} labels={labels} storeName={storeName} />}
            {state.view === "feedback" && <FeedbackView data={data} labels={labels} storeName={storeName} />}
            {state.view === "activity" && <ActivityView data={data} labels={labels} storeName={storeName} currentUserId={data.currentUserId} />}
            {state.view === "team" && <TeamView team={data.team} currentUserId={data.currentUserId} isOwner={data.role === "owner"} labels={labels} />}
          </motion.div>
        </div>
      </main>
    </div>

    {/* ── Bottom tabs (phone and tablet) ── */}
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label={t("Team desk navigation", "التنقل في مساحة الفريق")}>
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {[...nav.filter((item) => ["today", "leads", "merchants", "health"].includes(item.id))].map((item) => {
          const active = item.id === state.view;
          return <li key={item.id}><button type="button" onClick={() => openView(item.id)} aria-current={active ? "page" : undefined} className={cn("relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-200", active ? "text-foreground" : "text-muted-foreground")}>
            {active && <motion.span layoutId="admin-tab" transition={TWEEN} className="absolute top-0 h-0.5 w-8 rounded-full bg-foreground" />}
            <span className="relative"><item.icon className="size-5" />{item.count ? <span className={cn("absolute -end-2.5 -top-1.5 min-w-4 rounded-full px-1 text-center text-[9px] leading-4 tabular-nums", item.tone === "review" ? "bg-review text-white" : "bg-foreground text-background")}>{item.count}</span> : null}</span>
            <span className="max-w-full truncate px-1">{item.id === "health" ? t("Health", "الحالة") : item.label}</span>
          </button></li>;
        })}
        <li><button type="button" onClick={() => setMoreOpen(true)} className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors", ["returns", "feedback", "activity", "team"].includes(state.view) ? "text-foreground" : "text-muted-foreground")}><Ellipsis className="size-5" />{t("More", "المزيد")}</button></li>
      </ul>
    </nav>
    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
      <SheetContent side="bottom" className="rounded-t-3xl px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        <SheetTitle className="px-3 pt-2 text-sm">{t("More", "المزيد")}</SheetTitle>
        <SheetDescription className="sr-only">{t("Other views", "عروض أخرى")}</SheetDescription>
        <ul className="grid gap-1">
          {nav.filter((item) => ["returns", "feedback", "activity", "team"].includes(item.id)).map((item) => <li key={item.id}><button type="button" onClick={() => { setMoreOpen(false); openView(item.id); }} className={cn("flex h-12 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors", item.id === state.view ? "bg-foreground text-background" : "hover:bg-muted")}><item.icon className="size-4" />{item.label}</button></li>)}
          <li><Link href="/app" className="flex h-12 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted"><ExternalLink className="size-4" />{t("Merchant workspace", "مساحة التاجر")}</Link></li>
        </ul>
      </SheetContent>
    </Sheet>

    <LeadDrawer team={data.team} leadId={state.lead} lead={leads.find((lead) => lead.id === state.lead)} sequence={drawerSequence} labels={labels} canEdit={canEdit} currentUserId={data.currentUserId}
      saveState={state.lead ? saveState[state.lead] : undefined} update={update} onNavigate={(id) => go({ lead: id }, { push: false })} />
    <MerchantDrawer merchant={merchants.find((m) => m.id === state.merchant)} data={data} labels={labels} onClose={() => go({ merchant: null }, { push: false })} canManageChannel={data.role === "owner"} channelBusy={channelBusy === state.merchant} onUpdateChannel={updateChannel} />
    <ImportDialog open={importOpen} onOpenChange={setImportOpen} labels={labels} onImported={() => router.refresh()} />
    <AdminCommand open={paletteOpen} onOpenChange={setPaletteOpen} nav={nav} leads={leads} merchants={merchants} labels={labels} canEdit={canEdit}
      onView={(view) => openView(view)} onLead={(id) => openLead(id, "leads")} onMerchant={(id) => go({ view: "merchants", merchant: id })} onImport={() => setImportOpen(true)} onShortcuts={() => setHelpOpen(true)} />
    <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} nav={nav} />
    <AdminWelcome greeting={todayGreeting} summary={welcomeSummary} />
  </div></MotionConfig>;
}

function ShortcutsDialog({ open, onOpenChange, nav }: { open: boolean; onOpenChange: (open: boolean) => void; nav: NavItem[] }) {
  const { t } = useLabels();
  const rows: [string, string[]][] = [
    [t("Search and commands", "البحث والأوامر"), ["⌘", "K"]],
    [t("Search leads", "البحث في العملاء"), ["/"]],
    ...nav.map((item) => [item.label, ["G", item.key.toUpperCase()]] as [string, string[]]),
    [t("Next / previous lead", "العميل التالي / السابق"), ["↓", "↑"]],
    [t("New note on a lead", "ملاحظة جديدة"), ["N"]],
    [t("Save note", "حفظ الملاحظة"), ["⌘", "↵"]],
    [t("Close", "إغلاق"), ["Esc"]],
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="rounded-2xl sm:max-w-md">
      <DialogHeader className="text-start"><DialogTitle>{t("Keyboard shortcuts", "اختصارات لوحة المفاتيح")}</DialogTitle><DialogDescription>{t("Move around the desk without the mouse.", "تنقّل في المساحة دون الفأرة.")}</DialogDescription></DialogHeader>
      <ul className="divide-y divide-border/70">
        {rows.map(([label, keys]) => <li key={label} className="flex items-center justify-between py-2.5 text-sm"><span>{label}</span><span className="flex gap-1" dir="ltr">{keys.map((key) => <Kbd key={key} className="min-w-6 border border-border bg-background">{key}</Kbd>)}</span></li>)}
      </ul>
    </DialogContent>
  </Dialog>;
}

