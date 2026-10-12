"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, BookOpen, Check, CheckCheck, Clock, Headphones, Info, Maximize2, MessageSquare, Minimize2, PanelLeftClose, PanelLeftOpen, Package, RefreshCw, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { Initial, QUICK, Segmented, TWEEN } from "@/components/desk/primitives";
import { OutcomeBadge } from "@/components/outcome-badge";
import { Key, PageHeader } from "@/components/desk/page-header";
import { ReloadMark } from "@/components/reload-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrandQr } from "@/lib/brand-qr";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { formatDateTimeString } from "@/lib/numerals";
import { getWhatsAppStartUrl, RELOAD_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { useWorkspaceData, workspaceKey } from "@/lib/workspace-data";

/*
 * The customer inbox: every WhatsApp conversation, who is handling it (the
 * assistant or the team), why it needs a person, and how long is left to
 * reply for free. Replies can be started from the store's approved answers.
 */

type Conversation = {
  id: string;
  state: string;
  language: string;
  service_window_expires_at: string | null;
  last_message_at: string;
  return_case_id?: string | null;
  whatsapp_contacts: { display_name: string | null; wa_id: string } | null;
};
type Message = { id: string; direction: string; body: string | null; message_type: string; status: string; occurred_at: string };
type Ticket = { id: string; conversation_id: string; kind: string; message: string; status: string };
type InboxAnswer = { id: string; title: string; content: string; language: string };
/** The return case a conversation is about, when there is one. */
type ReturnContext = { order: string; item: string; outcome: "ELIGIBLE" | "NOT_ELIGIBLE" | "MANUAL_REVIEW"; status: string } | null;
type Delivery = { external_event_id: string; status: string; last_error: string | null };
type T = (en: string, ar: string) => string;
type Filter = "ALL" | "ATTENTION";

const DAY = 24 * 60 * 60_000;
const SEEN_KEY = "reload-inbox-seen";
const LAYOUT_KEY = "reload-inbox-layout";

export function InboxPage() {
  const auth = useAuth();
  const { workspace } = auth;
  const { t, locale, isArabic } = useLanguage();
  const live = useWorkspaceData(workspaceKey(auth));
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [answers, setAnswers] = useState<InboxAnswer[]>([]);
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [sendPhase, setSendPhase] = useState<"idle" | "sending" | "sent">("idle");
  const sidebar = useSidebar();
  const sidebarOpenRef = useRef(sidebar.open);
  sidebarOpenRef.current = sidebar.open;
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  // Panels can be folded away so the conversation gets the room (remembered per browser).
  const [layout, setLayout] = useState({ rail: false, details: true, focus: false });
  const updateLayout = (patch: Partial<typeof layout>) => setLayout((value) => {
    const next = { ...value, ...patch };
    try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(Date.now());
  const [seen, setSeen] = useState<Record<string, string>>({});
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const request = useRef<{
    id: string;
    body: string;
    conversation: string;
  } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    if (!workspace || !supabase) {
      setLoading(false);
      return;
    }
    const [c, k] = await Promise.all([
      supabase
        .from("whatsapp_conversations")
        .select(
          "id,state,language,service_window_expires_at,last_message_at,return_case_id,whatsapp_contacts(display_name,wa_id)",
        )
        .eq("store_id", workspace.storeId)
        .order("last_message_at", { ascending: false })
        .limit(100),
      supabase
        .from("support_tickets")
        .select("id,conversation_id,kind,message,status")
        .eq("store_id", workspace.storeId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (c.error || k.error)
      toast.error(
        t("Could not refresh the inbox.", "تعذّر تحديث صندوق المحادثات."),
      );
    else {
      const rows = c.data as unknown as Conversation[];
      setConversations(rows);
      setTickets(k.data ?? []);
      setUpdatedAt(Date.now());
    }
    setLoading(false);
  }, [workspace, t]);
  const loadThread = useCallback(
    async (id: string) => {
      if (!supabase || !workspace) return;
      const [result, delivery] = await Promise.all([
        supabase
          .from("whatsapp_messages")
          .select("id,direction,body,message_type,status,occurred_at")
          .eq("store_id", workspace.storeId)
          .eq("conversation_id", id)
          .order("occurred_at", { ascending: false })
          .limit(100),
        supabase
          .from("integration_events")
          .select("external_event_id,status,last_error")
          .eq("store_id", workspace.storeId)
          .eq("event_type", `STAFF_REPLY:${id}`)
          .order("received_at", { ascending: false })
          .limit(50),
      ]);
      if (selectedRef.current !== id) return;
      if (result.error || delivery.error)
        toast.error(
          t("Could not load this conversation.", "تعذّر تحميل المحادثة."),
        );
      else {
        setMessages((result.data ?? []).reverse());
        setDeliveries(delivery.data ?? []);
      }
      setThreadLoading(false);
    },
    [workspace, t],
  );
  // Approved answers (for reply suggestions) and the store's WhatsApp code (for the empty state).
  useEffect(() => {
    if (!supabase || !workspace) return;
    void supabase.from("store_knowledge").select("id,title,content,language").eq("store_id", workspace.storeId).eq("published", true).limit(200)
      .then((result: { data: unknown }) => setAnswers((result.data as InboxAnswer[] | null) ?? []));
    void supabase.from("stores").select("whatsapp_code").eq("id", workspace.storeId).maybeSingle()
      .then((result: { data: { whatsapp_code?: unknown } | null }) => setWhatsappCode(typeof result.data?.whatsapp_code === "string" ? result.data.whatsapp_code : null));
  }, [workspace]);
  useEffect(() => {
    try { setSeen(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}")); } catch { /* ignore */ }
    try { const saved = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? "null"); if (saved) setLayout((value) => ({ ...value, ...saved })); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      setClock(Date.now());
      if (document.visibilityState !== "visible") return;
      void load();
      if (selectedRef.current) void loadThread(selectedRef.current);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [load, loadThread]);
  useEffect(() => {
    setMessages([]);
    setText("");
    request.current = null;
    setThreadLoading(Boolean(selected));
    if (selected) void loadThread(selected);
  }, [selected, loadThread]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, selected]);
  const allConversations = conversations;
  const allTickets = tickets;
  const thread = messages;
  const answerPool = answers;
  const current = allConversations.find((c) => c.id === selected);
  const windowOpen = Boolean(
    current?.service_window_expires_at &&
    new Date(current.service_window_expires_at).getTime() > clock,
  );
  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!supabase || !workspace || !selected) return false;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke(
      "customer-service",
      {
        body: {
          action,
          storeId: workspace.storeId,
          conversationId: selected,
          ...extra,
        },
      },
    );
    setBusy(false);
    if (error || data?.error) {
      toast.error(
        t(
          "Could not complete this action. Your message has not been confirmed as sent.",
          "تعذّر تنفيذ الخطوة. لم يتم تأكيد إرسال رسالتك.",
        ),
      );
      return false;
    }
    await load();
    await loadThread(selected);
    return true;
  }
  async function reply() {
    if (!text.trim() || !selected) return;
    if (
      !request.current ||
      request.current.body !== text.trim() ||
      request.current.conversation !== selected
    )
      request.current = {
        id: crypto.randomUUID(),
        body: text.trim(),
        conversation: selected,
      };
    setSendPhase("sending");
    const sent = await act("reply", {
      message: request.current.body,
      requestId: request.current.id,
    });
    // The button shows the result for a moment: a tick when it went, straight back when it didn't.
    setSendPhase(sent ? "sent" : "idle");
    if (sent) window.setTimeout(() => setSendPhase("idle"), 1300);
    if (sent) {
      setText("");
      request.current = null;
      toast.success(t("Reply queued. Delivery status will update here.", "تمت إضافة الرد للإرسال. ستظهر حالة الإرسال هنا."));
    }
  }
  const openTickets = (id: string) => allTickets.filter((k) => k.conversation_id === id && k.status !== "RESOLVED");
  const needsAttention = (c: Conversation) => c.state === "HANDED_TO_HUMAN" || openTickets(c.id).length > 0;
  const attentionCount = allConversations.filter(needsAttention).length;
  const needle = search.trim().toLowerCase();
  const visible = allConversations.filter((c) =>
    (filter === "ALL" || needsAttention(c)) &&
    (!needle || `${c.whatsapp_contacts?.display_name ?? ""} ${c.whatsapp_contacts?.wa_id ?? ""} ${openTickets(c.id).map((k) => k.message).join(" ")}`.toLowerCase().includes(needle)));
  const visibleIds = visible.map((c) => c.id).join(",");

  const choose = useCallback((id: string | null) => {
    setSelected(id);
    setShowDetails(false);
    if (!id) return;
    setSeen((value) => {
      const next = { ...value, [id]: new Date().toISOString() };
      try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const isUnread = (c: Conversation) => c.id !== selected && (!seen[c.id] || seen[c.id] < c.last_message_at);


  const refresh = async () => {
    setRefreshing(true);
    await load();
    if (selectedRef.current) await loadThread(selectedRef.current);
    window.setTimeout(() => setRefreshing(false), 500);
  };

  // What the customer last said, for suggesting approved answers.
  const lastInbound = [...thread].reverse().find((m) => m.direction === "INBOUND")?.body ?? "";
  const currentTickets = selected ? openTickets(selected) : [];
  const suggestions = useMemo(() => suggestAnswers(answerPool, `${lastInbound} ${currentTickets.map((k) => k.message).join(" ")}`), [answerPool, lastInbound, currentTickets.map((k) => k.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const slash = text.startsWith("/") ? text.slice(1).trim().toLowerCase() : null;
  const slashMatches = slash === null ? [] : answerPool.filter((a) => !slash || `${a.title} ${a.content}`.toLowerCase().includes(slash)).slice(0, 5);
  const insertAnswer = (answer: InboxAnswer) => { setText(answer.content); window.setTimeout(() => replyRef.current?.focus(), 30); };

  const linked = current?.return_case_id ? live.cases.find((c) => c.id === current.return_case_id) : undefined;
  const context: ReturnContext = linked ? { order: linked.orderId, item: linked.itemName, outcome: linked.outcome, status: linked.caseStatus } : null;

  const remaining = current?.service_window_expires_at ? new Date(current.service_window_expires_at).getTime() - clock : 0;
  const handed = current?.state === "HANDED_TO_HUMAN";

  // Arrow keys move between conversations, "/" jumps to the reply box, Cmd/Ctrl+Enter sends.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.tagName === "TEXTAREA" || target.tagName === "INPUT";
      if (document.querySelector('[role="dialog"]')) return;
      if (typing) return;
      const ids = visibleIds ? visibleIds.split(",") : [];
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && ids.length) {
        event.preventDefault();
        const at = selectedRef.current ? ids.indexOf(selectedRef.current) : -1;
        const next = event.key === "ArrowDown" ? Math.min(ids.length - 1, at + 1) : Math.max(0, at - 1);
        choose(ids[next]);
      }
      if (event.key === "/" && selectedRef.current) { event.preventDefault(); replyRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleIds, choose]);

  const wide = layout.focus && Boolean(selected);
  // Full view also folds the app sidebar away, and puts it back afterwards.
  useEffect(() => {
    if (!wide || !isDesktop) return;
    const wasOpen = sidebarOpenRef.current;
    if (wasOpen) sidebar.setOpen(false);
    return () => { if (wasOpen) sidebar.setOpen(true); };
  }, [wide, isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps
  const chromeFolded = Boolean(selected) && (!isDesktop || layout.focus);
  const whatsAppLink = live.whatsApp === "CONNECTED" && whatsappCode ? getWhatsAppStartUrl(RELOAD_WHATSAPP_NUMBER, whatsappCode) : null;
  const name = (c: Conversation) => c.whatsapp_contacts?.display_name || t("Customer", "عميل");

  return (
    <motion.div initial={false} animate={{ maxWidth: wide && isDesktop ? 2400 : 1280 }} transition={{ ...TWEEN, duration: 0.45 }}
      className={cn("mx-auto flex w-full flex-col lg:h-[calc(100svh-7.5rem)] lg:min-h-[600px]", selected ? "max-lg:h-[calc(100svh-9.75rem)]" : "pb-4")}>
      {/* ── Title and notices: fold away smoothly when a chat is open on a phone, or in full view ── */}
      <motion.div initial={false} animate={{ height: chromeFolded ? 0 : "auto", opacity: chromeFolded ? 0 : 1 }} transition={{ ...TWEEN, duration: 0.45 }} className="shrink-0 overflow-hidden" aria-hidden={chromeFolded}>
      <div>
      <PageHeader icon={MessageSquare} title={t("Inbox", "المحادثات")} helpId="inbox" className="pb-4"
        actions={<>
            <button type="button" onClick={() => void refresh()} aria-label={t("Refresh now", "تحديث الآن")}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <span className="relative grid size-2 place-items-center"><span className="absolute size-2 animate-ping rounded-full bg-eligible/60 motion-reduce:hidden" /><span className="size-2 rounded-full bg-eligible" /></span>
              {t("Live", "مباشر")} · {relative(new Date(updatedAt).toISOString(), clock, locale)}
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            </button>
        </>}
        help={t("Every WhatsApp conversation with your customers appears here. The Reload assistant replies using your approved answers and your policy. When someone asks for a person or makes a complaint, the conversation is marked for you, and you can take over and reply yourself.", "تظهر هنا كل محادثة واتساب مع عملائك. يرد مساعد ريلود باستخدام إجاباتك المعتمدة وسياستك. وعندما يطلب أحدهم موظفًا أو يقدّم شكوى، تُعلَّم المحادثة لك لتتولاها وترد بنفسك.")}>
        {t("Your assistant answers first.", "المساعد يرد أولًا.")} <Key>{t("Step in when a customer needs a person.", "تدخّل عندما يحتاج العميل موظفًا.")}</Key>
      </PageHeader>


      </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.05 }}
        className={cn("admin-card grid min-h-0 w-full min-w-0 flex-1 overflow-hidden border-border bg-card lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:rounded-2xl lg:border",
          selected ? "max-md:-mx-4 max-md:w-[calc(100%+2rem)] max-md:border-y md:max-lg:rounded-2xl md:max-lg:border" : "rounded-2xl border max-lg:min-h-[460px]")}>
        {/* ── Conversations ── */}
        <motion.aside initial={false} animate={{ width: isDesktop ? (layout.rail ? 68 : 300) : "100%" }} transition={{ ...TWEEN, duration: 0.45 }}
          className={cn("relative flex min-h-0 flex-col overflow-hidden border-e border-border max-lg:animate-[inbox-in_.35s_cubic-bezier(.2,0,0,1)] lg:shrink-0", selected && "hidden lg:flex")} aria-label={t("Conversations", "المحادثات")}>
          {/* Folded: just the faces, so the chat gets the width. */}
          <motion.div initial={false} animate={{ opacity: layout.rail ? 1 : 0 }} transition={{ ...TWEEN, duration: 0.3, delay: layout.rail ? 0.15 : 0 }} aria-hidden={!layout.rail}
            className={cn("absolute inset-y-0 start-0 hidden w-[68px] flex-col items-center gap-1 py-3 lg:flex", !layout.rail && "pointer-events-none")}>
            <button type="button" onClick={() => updateLayout({ rail: false })} aria-label={t("Show conversation list", "إظهار قائمة المحادثات")} title={t("Show conversation list", "إظهار قائمة المحادثات")}
              className="mb-1 grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><PanelLeftOpen className="size-4 rtl:-scale-x-100" /></button>
            <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto px-2 py-1">
              {visible.map((c) => {
                const reason = reasonFor(c, openTickets(c.id), t);
                return (
                  <button key={c.id} type="button" onClick={() => choose(c.id)} title={name(c)} aria-label={name(c)} aria-current={c.id === selected ? "true" : undefined}
                    className={cn("relative shrink-0 rounded-[14px] p-0.5 transition-[box-shadow,transform] duration-200 active:scale-95", c.id === selected ? "shadow-[0_0_0_2px_var(--foreground)]" : reason?.attention ? "shadow-[0_0_0_2px_var(--review)]" : "hover:shadow-[0_0_0_2px_var(--border)]")}>
                    <Initial name={name(c)} />
                    {isUnread(c) && <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-brand-accent" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
          <motion.div initial={false} animate={{ opacity: layout.rail && isDesktop ? 0 : 1 }} transition={{ ...TWEEN, duration: 0.3, delay: layout.rail ? 0 : 0.15 }}
            className={cn("flex min-h-0 flex-1 flex-col lg:absolute lg:inset-y-0 lg:start-0 lg:w-[300px]", layout.rail && "lg:pointer-events-none")}>
          <div className="space-y-2.5 border-b border-border p-3">
            <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t("Search conversations", "البحث في المحادثات")} placeholder={t("Search name or number…", "ابحث بالاسم أو الرقم…")} className="h-9 rounded-xl ps-9 pe-8" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label={t("Clear search", "مسح البحث")} className="absolute end-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
            </div>
            <button type="button" onClick={() => updateLayout({ rail: true })} aria-label={t("Hide conversation list", "إخفاء قائمة المحادثات")} title={t("Hide conversation list", "إخفاء قائمة المحادثات")}
              className="hidden size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:grid"><PanelLeftClose className="size-4 rtl:-scale-x-100" /></button>
            </div>
            <Segmented<Filter> value={filter} onChange={setFilter} label={t("Filter conversations", "تصفية المحادثات")} className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
              options={[
                { value: "ALL", label: <>{t("All", "الكل")}<span className="tabular-nums text-muted-foreground">{allConversations.length}</span></> },
                { value: "ATTENTION", label: <>{t("Needs you", "بانتظارك")}<span className={cn("tabular-nums", attentionCount ? "text-review" : "text-muted-foreground")}>{attentionCount}</span></> },
              ]} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-1">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-[68px] rounded-xl" />)}</div>
            ) : !allConversations.length ? (
              <EmptyInbox link={whatsAppLink} t={t} />
            ) : !visible.length ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium">{filter === "ATTENTION" && !needle ? t("Nothing needs you right now", "لا شيء بانتظارك الآن") : t("No conversations match", "لا توجد محادثات مطابقة")}</p>
                <button type="button" onClick={() => { setSearch(""); setFilter("ALL"); }} className="mt-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">{t("Show all conversations", "عرض كل المحادثات")}</button>
              </div>
            ) : (
              <ul className="space-y-0.5">
                <AnimatePresence initial={false}>
                  {visible.map((c) => {
                    const active = c.id === selected;
                    const reason = reasonFor(c, openTickets(c.id), t);
                    const waitMinutes = (clock - new Date(c.last_message_at).getTime()) / 60_000;
                    return (
                      <motion.li key={c.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={QUICK}>
                        <button type="button" onClick={() => choose(c.id)} aria-current={active ? "true" : undefined}
                          className={cn("relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-muted" : "hover:bg-muted/50")}>
                          {active && <motion.span layoutId="inbox-active" transition={TWEEN} className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-foreground" />}
                          <span className="relative shrink-0">
                            <Initial name={name(c)} />
                            {isUnread(c) && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={QUICK} className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-brand-accent" aria-label={t("New messages", "رسائل جديدة")} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className={cn("truncate text-sm", isUnread(c) ? "font-semibold" : "font-medium")}>{name(c)}</span>
                              <span className={cn("shrink-0 text-[11px] tabular-nums", !reason?.attention ? "text-muted-foreground" : waitMinutes > 120 ? "font-medium text-destructive" : waitMinutes > 30 ? "font-medium text-review" : "text-muted-foreground")}>{relative(c.last_message_at, clock, locale)}</span>
                            </span>
                            <span className="mt-1 flex items-center gap-1.5 text-[11px]">
                              {reason
                                ? <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium", reason.tone)}><reason.icon className="size-3" />{reason.label}</span>
                                : <span className="inline-flex items-center gap-1 text-muted-foreground"><ReloadMark className="size-3" />{t("Handled by assistant", "يتولاها المساعد")}</span>}
                            </span>
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
          <p className="hidden border-t border-border px-3 py-2 text-[11px] text-muted-foreground lg:block"><Kbd>↑</Kbd> <Kbd>↓</Kbd> {t("to move", "للتنقل")} · <Kbd>/</Kbd> {t("to reply", "للرد")}</p>
          </motion.div>
        </motion.aside>

        {/* ── Conversation ── */}
        {!current ? (
          <div className="hidden min-w-0 place-items-center p-12 text-center lg:col-span-2 lg:grid">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><MessageSquare className="size-5" /></span>
              <p className="mt-4 font-medium">{t("Choose a conversation", "اختر محادثة")}</p>
              <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">{t("You'll see the whole chat, what the assistant did and what the customer needs.", "سترى المحادثة كاملة، وما فعله المساعد، وما يحتاجه العميل.")}</p>
            </div>
          </div>
        ) : (
          <>
            <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden max-lg:animate-[inbox-in_.35s_cubic-bezier(.2,0,0,1)] lg:flex-1">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Button variant="ghost" size="icon" className="size-8 shrink-0 lg:hidden" onClick={() => choose(null)} aria-label={t("Back to conversations", "العودة للمحادثات")}><ArrowLeft className="size-4 rtl:rotate-180" /></Button>
                <Initial name={name(current)} className="hidden sm:grid" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name(current)}</p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p key={current.state} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={QUICK} className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("size-1.5 shrink-0 rounded-full", handed ? "bg-review" : "bg-eligible")} />
                      <span className="truncate">{handed ? t("Your team is replying, assistant paused", "فريقك يتولى الرد، المساعد متوقف") : t("Reload assistant is handling this", "مساعد ريلود يتولى المحادثة")}</span>
                    </motion.p>
                  </AnimatePresence>
                </div>
                <Button variant="ghost" size="icon" className="hidden size-8 shrink-0 text-muted-foreground lg:inline-flex" aria-pressed={layout.focus} onClick={() => updateLayout({ focus: !layout.focus })}
                  aria-label={layout.focus ? t("Exit full view", "الخروج من العرض الكامل") : t("Full view", "عرض كامل")} title={layout.focus ? t("Exit full view", "الخروج من العرض الكامل") : t("Full view", "عرض كامل")}>
                  {layout.focus ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground" aria-label={t("Customer details", "تفاصيل العميل")} title={t("Customer details", "تفاصيل العميل")}
                  onClick={() => { if (window.matchMedia("(min-width: 1400px)").matches) updateLayout({ details: !layout.details }); else setShowDetails((value) => !value); }}><Info className="size-4" /></Button>
                <Button variant={handed ? "outline" : "default"} size="sm" disabled={busy} onClick={() => void act(handed ? "resume" : "takeover")} className="h-9 shrink-0 rounded-xl transition-transform active:scale-[.97]">
                  {busy && sendPhase === "idle" ? <Dots /> : handed ? <ReloadMark className="size-4" /> : <Headphones className="size-4" />}
                  <span className="max-sm:sr-only">{handed ? t("Hand back to assistant", "إعادة للمساعد") : t("Take over", "تولّي المحادثة")}</span>
                </Button>
              </div>

              {/* Below 1400px the details slide in over the chat and never push it down. */}
              <AnimatePresence>
                {showDetails && (
                  <>
                    <motion.button key="scrim" type="button" aria-label={t("Close details", "إغلاق التفاصيل")} onClick={() => setShowDetails(false)}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK} className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] min-[1400px]:hidden" />
                    <motion.div key="details" initial={{ x: isArabic ? "-100%" : "100%" }} animate={{ x: 0 }} exit={{ x: isArabic ? "-100%" : "100%" }} transition={{ ...TWEEN, duration: 0.3 }}
                      className="absolute inset-y-0 end-0 z-20 flex w-[min(100%,320px)] flex-col border-s border-border bg-card shadow-[0_0_40px_-12px_rgba(0,0,0,.5)] min-[1400px]:hidden">
                      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{t("Customer details", "تفاصيل العميل")}</p>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowDetails(false)} aria-label={t("Close details", "إغلاق التفاصيل")}><X className="size-4" /></Button>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto"><Details conversation={current} context={context} tickets={currentTickets} remaining={remaining} busy={busy} onResolve={(id) => void act("ticket_status", { ticketId: id, status: "RESOLVED" })} name={name(current)} t={t} /></div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="inbox-wallpaper relative min-h-0 flex-1">
              <div className="relative z-[1] flex h-full flex-col gap-3 overflow-y-auto px-3 py-5 sm:px-6" aria-live="polite">
                {threadLoading ? (
                  <div className="space-y-3">{[0, 1, 2].map((index) => <Skeleton key={index} className={cn("h-14 rounded-2xl", index % 2 ? "ms-auto w-2/3" : "w-3/5")} />)}</div>
                ) : (
                  <AnimatePresence initial={false}>
                    {thread.map((m) => {
                      const out = m.direction === "OUTBOUND";
                      return (
                        <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={QUICK} className="flex flex-col gap-2.5">
                          <div className={cn("flex items-end gap-2", out && "flex-row-reverse")}>
                            {out
                              ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background" aria-hidden="true"><ReloadMark className="size-4" /></span>
                              : <Initial name={name(current)} className="size-8 rounded-full text-xs" />}
                            <div className={cn("min-w-0 max-w-[80%] rounded-2xl px-4 py-2.5 sm:max-w-[min(72%,40rem)]", out ? "rounded-ee-md bg-foreground text-background shadow-[0_1px_2px_rgba(15,15,18,.18)]" : "rounded-es-md border border-border bg-card shadow-[0_1px_2px_rgba(15,15,18,.06)]")}>
                              <p dir="auto" className="whitespace-pre-wrap break-words text-[15px] leading-6">
                                {m.body || (m.message_type === "IMAGE" ? t("Customer photo · evidence is available in the return case", "صورة العميل · تظهر في تفاصيل طلب الإرجاع") : t("Attachment", "مرفق"))}
                              </p>
                              <p className="mt-1 flex items-center justify-end gap-1 text-[11px] opacity-60">
                                {formatDateTimeString(m.occurred_at, { timeStyle: "short" }, locale)}
                                {out && (m.status === "FAILED"
                                  ? <span className="inline-flex items-center gap-0.5 font-medium text-destructive opacity-100"><AlertTriangle className="size-3" />{t("Not delivered", "لم تُسلَّم")}</span>
                                  : m.status === "READ" ? <CheckCheck className="size-3.5 text-[#53bdeb] opacity-100" aria-label={t("Read", "مقروء")} />
                                    : m.status === "DELIVERED" ? <CheckCheck className="size-3.5" aria-label={t("Delivered", "تم التسليم")} />
                                      : <Check className="size-3.5" aria-label={t("Sent", "تم الإرسال")} />)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                {!threadLoading && handed && <Divider icon={Headphones} label={t("Handed to your team. The assistant is paused.", "أُحيلت إلى فريقك. المساعد متوقف.")} />}
                <div ref={end} />
              </div>
              </div>

              {/* Reply */}
              <div className="shrink-0 space-y-2 border-t border-border p-3">
                {deliveries.filter((d) => d.status !== "PROCESSED").slice(0, 2).map((d) => (
                  <p key={d.external_event_id} className={cn("flex items-center gap-1.5 text-xs", d.status === "FAILED" ? "text-destructive" : "text-muted-foreground")}>
                    {d.status === "FAILED" ? <AlertTriangle className="size-3.5" /> : <Dots />}
                    {d.status === "FAILED" ? t("A reply wasn't delivered. Check it and send again.", "أحد الردود لم يُسلَّم. راجعه وأعد الإرسال.") : t("A reply is on its way.", "أحد الردود في الطريق.")}
                  </p>
                ))}
                {!windowOpen ? (
                  <p className="flex items-start gap-2.5 rounded-xl bg-muted px-3.5 py-3 text-xs leading-5">
                    <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    {t("The 24-hour reply window has closed. You can reply again as soon as the customer sends a new message.", "انتهت مهلة الرد خلال 24 ساعة. تستطيع الرد من جديد فور وصول رسالة من العميل.")}
                  </p>
                ) : (
                  <>
                    <AnimatePresence initial={false}>
                      {slash === null && !text && suggestions.length > 0 && (
                        <motion.div key="suggest" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={QUICK} className="overflow-hidden">
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" title={t("From your approved answers", "من إجاباتك المعتمدة")}>
                            <BookOpen className="size-3.5 shrink-0 text-muted-foreground" aria-label={t("From your approved answers", "من إجاباتك المعتمدة")} />
                            {suggestions.map((answer, index) => (
                              <motion.button key={answer.id} type="button" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ ...QUICK, delay: index * 0.05 }} onClick={() => insertAnswer(answer)}
                                className="max-w-[240px] shrink-0 truncate rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:border-foreground/30 hover:text-foreground active:scale-[.98]" dir="auto">{answer.title}</motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="relative">
                      <AnimatePresence>
                        {slash !== null && (
                          <motion.ul key="slash" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={QUICK}
                            className="absolute inset-x-0 bottom-full z-10 mb-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                            {slashMatches.length ? slashMatches.map((answer, index) => (
                              <li key={answer.id}><button type="button" onClick={() => insertAnswer(answer)} className={cn("w-full rounded-lg px-3 py-2 text-start transition-colors hover:bg-muted", index === 0 && "bg-muted/60")}>
                                <span className="block truncate text-sm font-medium" dir="auto">{answer.title}</span>
                                <span className="block truncate text-xs text-muted-foreground" dir="auto">{answer.content}</span>
                              </button></li>
                            )) : <li className="px-3 py-3 text-xs text-muted-foreground">{answerPool.length ? t("No approved answer matches.", "لا توجد إجابة معتمدة مطابقة.") : t("No approved answers yet. Add them in Store knowledge.", "لا توجد إجابات معتمدة بعد. أضفها من معلومات المتجر.")}</li>}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                      {/* One bar: the message, the time left to reply, and Send. */}
                      <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 ps-3.5 transition-[border-color,box-shadow] duration-200 focus-within:border-foreground/25 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_16%,transparent)]">
                        <label className="sr-only" htmlFor="team-reply">{t("Your reply", "ردك")}</label>
                        <textarea id="team-reply" ref={replyRef} dir="auto" rows={1} maxLength={4096} disabled={busy} value={text} onChange={(event) => setText(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void reply(); }
                            if (event.key === "Enter" && slash !== null && slashMatches[0]) { event.preventDefault(); insertAnswer(slashMatches[0]); }
                            if (event.key === "Escape") { if (slash !== null) setText(""); else (event.target as HTMLElement).blur(); }
                          }}
                          placeholder={t("Reply, or type / for an approved answer", "اكتب ردك، أو / لإجابة معتمدة")}
                          className="field-bare max-h-32 min-h-9 min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-[15px] leading-6 outline-none [field-sizing:content] placeholder:text-muted-foreground/70 disabled:opacity-60" />
                        {/* Only worth showing when time is nearly up; the full countdown lives in customer details. */}
                        {remaining < 2 * 3_600_000 && <WindowRing remaining={remaining} compact t={t} />}
                        <SendButton phase={sendPhase} ready={Boolean(text.trim()) && slash === null && !busy} rtl={isArabic} onClick={() => void reply()} label={t("Send", "إرسال")}
                          title={handed ? t("Send (⌘↵). The assistant stays paused until you hand it back.", "إرسال (⌘↵). يبقى المساعد متوقفًا حتى تعيد المحادثة إليه.") : t("Send (⌘↵). Sending a reply pauses the assistant.", "إرسال (⌘↵). إرسال الرد يوقف المساعد.")} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ── Customer details ── */}
            <motion.aside initial={false} animate={{ width: layout.details ? 272 : 0, opacity: layout.details ? 1 : 0 }} transition={{ ...TWEEN, duration: 0.45 }}
              className={cn("hidden min-h-0 shrink-0 overflow-hidden min-[1400px]:block", layout.details ? "border-s border-border" : "pointer-events-none")}
              aria-label={t("Customer details", "تفاصيل العميل")} aria-hidden={!layout.details}>
              <div className="h-full w-[272px] overflow-y-auto">
                <Details conversation={current} context={context} tickets={currentTickets} remaining={remaining} busy={busy} onResolve={(id) => void act("ticket_status", { ticketId: id, status: "RESOLVED" })} name={name(current)} t={t} />
              </div>
            </motion.aside>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function relative(iso: string, now: number, locale: string) {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return format.format(0, "minute");
}

/** Why a conversation needs a person, in the customer's terms. */
function reasonFor(c: Conversation, open: Ticket[], t: T) {
  const kinds = open.map((k) => k.kind);
  if (kinds.includes("COMPLAINT")) return { label: t("Complaint", "شكوى"), tone: "bg-destructive/10 text-destructive", icon: AlertTriangle, attention: true };
  if (kinds.includes("HUMAN")) return { label: t("Asked for a person", "طلب موظفًا"), tone: "bg-review-muted text-review", icon: Headphones, attention: true };
  if (kinds.includes("QUESTION")) return { label: t("Question for you", "سؤال لك"), tone: "bg-review-muted text-review", icon: MessageSquare, attention: true };
  if (c.state === "HANDED_TO_HUMAN") return { label: t("Your team is replying", "فريقك يتولى الرد"), tone: "bg-muted text-foreground", icon: Headphones, attention: true };
  return null;
}

/** Approved answers that share words with what the customer said. No AI: plain word overlap. */
function suggestAnswers(answers: InboxAnswer[], about: string) {
  const words = (value: string) => new Set(value.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3));
  const asked = words(about);
  if (!asked.size) return [];
  return answers
    .map((answer) => ({ answer, score: [...words(`${answer.title} ${answer.title} ${answer.content}`)].filter((word) => asked.has(word)).length }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.answer);
}

/**
 * Send, as one continuous gesture: the plane lifts off, three dots breathe
 * while the message is on its way, a tick draws itself when it lands, and the
 * plane glides back in. The button wakes up (fills in) once there is something to send.
 */
function SendButton({ phase, ready, rtl, onClick, label, title }: { phase: "idle" | "sending" | "sent"; ready: boolean; rtl: boolean; onClick: () => void; label: string; title: string }) {
  const awake = ready || phase !== "idle";
  const away = rtl ? -1 : 1;
  return (
    <motion.button type="button" onClick={onClick} disabled={!ready || phase !== "idle"} aria-label={label} title={title} aria-busy={phase === "sending"}
      whileTap={ready ? { scale: 0.9 } : undefined} animate={{ scale: phase === "sent" ? [1, 1.1, 1] : awake ? 1 : 0.94 }} transition={{ ...TWEEN, duration: 0.35 }}
      className={cn("relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl transition-colors duration-300",
        phase === "sent" ? "bg-eligible text-eligible-foreground" : awake ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
      <AnimatePresence mode="popLayout" initial={false}>
        {phase === "sent" ? (
          <motion.svg key="sent" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={QUICK}>
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ ...TWEEN, duration: 0.4, delay: 0.05 }} />
          </motion.svg>
        ) : phase === "sending" ? (
          <motion.span key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK}><Dots /></motion.span>
        ) : (
          <motion.span key="plane" initial={{ x: -12 * away, y: 12, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} exit={{ x: 18 * away, y: -18, opacity: 0 }} transition={{ ...TWEEN, duration: 0.32 }}>
            <Send className="size-4 rtl:-scale-x-100" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** "Working on it", as three dots that breathe. Used wherever the inbox waits on something. */
function Dots() {
  return (
    <span className="inline-flex h-4 items-center gap-[3px]" aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <motion.span key={dot} className="size-1 rounded-full bg-current" animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: dot * 0.14 }} />
      ))}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-muted px-1 font-sans text-[10px]">{children}</kbd>;
}

function Divider({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <motion.div initial={{ opacity: 0, scaleX: 0.9 }} animate={{ opacity: 1, scaleX: 1 }} transition={TWEEN} className="my-1 flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
      <span className="h-px flex-1 bg-border" /><span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"><Icon className="size-3" />{label}</span><span className="h-px flex-1 bg-border" />
    </motion.div>
  );
}

/** Time left in WhatsApp's free 24-hour reply window, as a ring that runs down. */
function WindowRing({ remaining, t, compact = false }: { remaining: number; t: T; compact?: boolean }) {
  const left = Math.max(0, Math.min(1, remaining / DAY));
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const low = remaining < 2 * 3_600_000;
  const c = 2 * Math.PI * 9;
  return (
    <span className={cn("inline-flex shrink-0 items-center text-xs tabular-nums", compact ? "h-9 gap-1.5" : "gap-2", low ? "font-medium text-review" : "text-muted-foreground")} title={t("WhatsApp lets you reply freely for 24 hours after the customer's last message.", "يسمح واتساب بالرد بحرية لمدة 24 ساعة بعد آخر رسالة من العميل.")}>
      <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" strokeWidth="3" className="stroke-muted" />
        <motion.circle cx="12" cy="12" r="9" fill="none" strokeWidth="3" strokeLinecap="round" className={low ? "stroke-review" : "stroke-eligible"} strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - left) }} transition={{ ...TWEEN, duration: 0.7 }} />
      </svg>
      {compact
        ? <span>{hours > 0 ? t(`${hours}h ${minutes}m left`, `باقي ${hours} س ${minutes} د`) : t(`${minutes} min left`, `باقي ${minutes} د`)}</span>
        : <span className="sm:hidden" dir="ltr">{hours}:{String(minutes).padStart(2, "0")}</span>}
      <span className={cn("max-sm:hidden", compact && "hidden")}>{hours > 0 ? t(`${hours}h ${minutes}m left to reply`, `باقي ${hours} ساعة و${minutes} دقيقة للرد`) : t(`${minutes}m left to reply`, `باقي ${minutes} دقيقة للرد`)}</span>
    </span>
  );
}

function Details({ conversation, context, tickets, remaining, busy, onResolve, name, t }: {
  conversation: Conversation; context: ReturnContext; tickets: Ticket[]; remaining: number; busy: boolean; onResolve: (id: string) => void; name: string; t: T;
}) {
  const kindLabel: Record<string, string> = { HUMAN: t("Asked for a person", "طلب موظفًا"), COMPLAINT: t("Complaint", "شكوى"), QUESTION: t("Question", "سؤال") };
  return (
    <div className="divide-y divide-border text-sm">
      <div className="flex items-center gap-3 p-4">
        <Initial name={name} className="size-11 text-base" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">+{conversation.whatsapp_contacts?.wa_id}</p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-muted px-2 py-0.5">{conversation.language === "ar" ? "العربية" : "English"}</span>
          </p>
        </div>
      </div>

      {tickets.length > 0 && (
        <Block title={t("Needs you", "بانتظارك")}>
          <AnimatePresence initial={false}>
            {tickets.map((k) => (
              <motion.div key={k.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={QUICK} className="overflow-hidden rounded-xl border border-review/25 bg-review-muted/40 p-3">
                <p className="text-[11px] font-semibold text-review">{kindLabel[k.kind] ?? k.kind} · RL-{k.id.slice(0, 8).toUpperCase()}</p>
                <p dir="auto" className="mt-1 line-clamp-4 whitespace-pre-wrap text-[13px] leading-5">{k.message}</p>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onResolve(k.id)} className="mt-2.5 h-8 w-full rounded-lg bg-background transition-transform active:scale-[.98]"><Check className="size-3.5" />{t("Mark as resolved", "تم الحل")}</Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </Block>
      )}

      {context && (
        <Block title={t("Return", "الإرجاع")} icon={Package}>
          <Row label={t("Order", "الطلب")} value={<bdi>{context.order}</bdi>} />
          <Row label={t("Item", "المنتج")} value={context.item} />
          <Row label={t("Decision", "القرار")} value={<OutcomeBadge outcome={context.outcome} size="sm" />} />
          <Row label={t("Status", "الحالة")} value={context.status} />
          <Link href="/app/cases" className="mt-1 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">{t("Open return cases", "فتح طلبات الإرجاع")}</Link>
        </Block>
      )}

      <Block title={t("Reply window", "مهلة الرد")} icon={Clock}>
        {remaining > 0
          ? <><WindowRing remaining={remaining} t={t} /><p className="text-xs leading-5 text-muted-foreground">{t("WhatsApp lets you reply freely for 24 hours after the customer's last message.", "يسمح واتساب بالرد بحرية لمدة 24 ساعة بعد آخر رسالة من العميل.")}</p></>
          : <p className="text-xs leading-5 text-muted-foreground">{t("Closed. It reopens when the customer writes again.", "مغلقة. تُفتح من جديد عند وصول رسالة من العميل.")}</p>}
      </Block>
    </div>
  );
}

function Block({ title, icon: Icon, children }: { title: string; icon?: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="space-y-2 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{Icon && <Icon className="size-3.5" />}{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <p className="flex items-start justify-between gap-3 text-[13px]"><span className="shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 text-end font-medium" dir="auto">{value}</span></p>;
}

/** No conversations yet: the store's own WhatsApp link and QR, so the first chat is one scan away. */
function EmptyInbox({ link, t }: { link: string | null; t: T }) {
  const qr = useMemo(() => (link ? createBrandQr(link) : null), [link]);
  return (
    <div className="px-3 py-6 text-center">
      {qr ? (
        <div className="mx-auto w-40 rounded-2xl border border-black/10 bg-[#f8f7f4] p-3 [&>svg]:block [&>svg]:w-full" role="img" aria-label={t("Your WhatsApp QR code", "رمز واتساب لمتجرك")} dangerouslySetInnerHTML={{ __html: qr.svg("ink", { transparent: true }) }} />
      ) : (
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground"><MessageSquare className="size-5" /></span>
      )}
      <p className="mt-4 text-sm font-medium">{t("No conversations yet", "لا توجد محادثات بعد")}</p>
      <p className="mx-auto mt-1 max-w-[230px] text-xs leading-5 text-muted-foreground">
        {link ? t("Scan this with your phone to start the first one, or share your link with customers.", "امسح الرمز بجوالك لبدء أول محادثة، أو شارك الرابط مع عملائك.") : t("Turn on WhatsApp in Integrations to get your store's link and QR code.", "فعّل واتساب من التكاملات للحصول على رابط ورمز متجرك.")}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {link
          ? <Button asChild size="sm" variant="outline" className="rounded-xl"><a href={link} target="_blank" rel="noopener noreferrer">{t("Open my WhatsApp link", "فتح رابط واتساب")}</a></Button>
          : <Button asChild size="sm" variant="outline" className="rounded-xl"><Link href="/app/integrations">{t("Go to Integrations", "الذهاب إلى التكاملات")}</Link></Button>}
      </div>
    </div>
  );
}
