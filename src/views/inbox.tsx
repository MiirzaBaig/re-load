"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Headphones,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { formatDateTimeString } from "@/lib/numerals";

type Conversation = {
  id: string;
  state: string;
  language: string;
  service_window_expires_at: string | null;
  last_message_at: string;
  whatsapp_contacts: { display_name: string | null; wa_id: string } | null;
};
type Message = {
  id: string;
  direction: string;
  body: string | null;
  message_type: string;
  status: string;
  occurred_at: string;
};
type Ticket = {
  id: string;
  conversation_id: string;
  kind: string;
  message: string;
  status: string;
};
type Delivery = {
  external_event_id: string;
  status: string;
  last_error: string | null;
};
export function InboxPage() {
  const { workspace } = useAuth();
  const { t, locale } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState(false);
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
          "id,state,language,service_window_expires_at,last_message_at,whatsapp_contacts(display_name,wa_id)",
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
      setConversations(c.data as unknown as Conversation[]);
      setTickets(k.data ?? []);
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
  }, [messages]);
  const current = conversations.find((c) => c.id === selected);
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
    if (
      await act("reply", {
        message: request.current.body,
        requestId: request.current.id,
      })
    ) {
      setText("");
      request.current = null;
      toast.success(
        t(
          "Reply queued. Delivery status will update here.",
          "تمت إضافة الرد للإرسال. ستظهر حالة الإرسال هنا.",
        ),
      );
    }
  }
  const visible = conversations.filter(
    (c) =>
      !filter ||
      c.state === "HANDED_TO_HUMAN" ||
      tickets.some(
        (k) => k.conversation_id === c.id && k.status !== "RESOLVED",
      ),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6 motion-safe:animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {t("Every conversation, in one place", "كل محادثة، في مكان واحد")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            {t("Customer inbox", "محادثات العملاء")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "Read the context, take over when needed, and keep your customer informed.",
              "اطّلع على التفاصيل، وتولَّ المحادثة عند الحاجة، وخلّ العميل على اطلاع.",
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" />
          {t("Refresh", "تحديث")}
        </Button>
      </header>
      <div className="grid min-h-[600px] overflow-hidden rounded-2xl border bg-card md:grid-cols-[300px_1fr]">
        <aside className={cn("border-e", selected && "hidden md:block")}>
          <div className="flex gap-2 border-b p-3">
            <Button
              size="sm"
              variant={!filter ? "default" : "ghost"}
              onClick={() => setFilter(false)}
            >
              {t("All", "الكل")}
            </Button>
            <Button
              size="sm"
              variant={filter ? "default" : "ghost"}
              onClick={() => setFilter(true)}
            >
              {t("Needs attention", "يحتاج متابعة")}
            </Button>
          </div>
          <div className="max-h-[660px] overflow-auto p-2">
            {loading ? (
              <div className="grid h-36 place-items-center">
                <Spinner />
              </div>
            ) : !visible.length ? (
              <div className="px-4 py-12 text-center">
                <MessageSquare className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-4 text-sm">
                  {t("No conversations yet", "ما فيه محادثات بعد")}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t(
                    "Share your store's WhatsApp link from Integrations to begin.",
                    "شارك رابط واتساب الخاص بمتجرك من صفحة التكاملات.",
                  )}
                </p>
              </div>
            ) : (
              visible.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "mb-1 w-full rounded-xl p-3 text-start transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                    c.id === selected && "bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {c.whatsapp_contacts?.display_name ||
                        t("Customer", "عميل")}
                    </span>
                    {c.state === "HANDED_TO_HUMAN" && (
                      <Headphones className="size-4 shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    +{c.whatsapp_contacts?.wa_id}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {formatDateTimeString(
                        c.last_message_at,
                        { dateStyle: "short", timeStyle: "short" },
                        locale,
                      )}
                    </span>
                    {tickets.some(
                      (k) =>
                        k.conversation_id === c.id && k.status !== "RESOLVED",
                    ) && (
                      <span className="text-foreground">
                        {t("Open ticket", "تذكرة مفتوحة")}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
        {!current ? (
          <div className="hidden place-items-center p-12 text-center md:grid">
            <div>
              <MessageSquare className="mx-auto size-9 text-muted-foreground/50" />
              <p className="mt-4 font-medium">
                {t("Choose a conversation", "اختر محادثة")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(
                  "Your assistant and team share the same history.",
                  "المساعد وفريقك يتابعون نفس سجل المحادثة.",
                )}
              </p>
            </div>
          </div>
        ) : (
          <section className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSelected(null)}
                aria-label={t("Back to conversations", "العودة للمحادثات")}
              >
                <ArrowLeft className="size-4 rtl:rotate-180" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {current.whatsapp_contacts?.display_name ||
                    t("Customer", "عميل")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {current.state === "HANDED_TO_HUMAN"
                    ? t(
                        "Your team is replying · assistant paused",
                        "فريقك يتولى الرد · المساعد متوقف",
                      )
                    : t("Assistant active", "المساعد يعمل")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void act(
                    current.state === "HANDED_TO_HUMAN" ? "resume" : "takeover",
                  )
                }
              >
                {current.state === "HANDED_TO_HUMAN" ? (
                  <Sparkles className="size-4" />
                ) : (
                  <Headphones className="size-4" />
                )}
                {current.state === "HANDED_TO_HUMAN"
                  ? t("Resume assistant", "تشغيل المساعد")
                  : t("Take over", "تولّي المحادثة")}
              </Button>
            </div>
            {tickets
              .filter(
                (k) =>
                  k.conversation_id === selected && k.status !== "RESOLVED",
              )
              .map((k) => (
                <div
                  key={k.id}
                  className="flex items-start gap-3 border-b bg-muted/40 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">
                      {t("Ticket", "تذكرة")} · RL-
                      {k.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p
                      dir="auto"
                      className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm"
                    >
                      {k.message}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void act("ticket_status", {
                        ticketId: k.id,
                        status: "RESOLVED",
                      })
                    }
                  >
                    <Check className="size-4" />
                    {t("Resolve", "تم الحل")}
                  </Button>
                </div>
              ))}
            <div
              className="flex h-[380px] flex-col gap-3 overflow-auto p-4 sm:h-[440px] sm:p-6"
              aria-live="polite"
            >
              {threadLoading ? (
                <Spinner />
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[88%] rounded-2xl px-4 py-3 motion-safe:animate-fade-in",
                      m.direction === "OUTBOUND"
                        ? "ms-auto bg-foreground text-background"
                        : "me-auto border bg-background",
                    )}
                  >
                    <p
                      dir="auto"
                      className="whitespace-pre-wrap break-words text-sm leading-6"
                    >
                      {m.body ||
                        (m.message_type === "IMAGE"
                          ? t(
                              "Customer photo · evidence is available in the return case",
                              "صورة العميل · تظهر في تفاصيل طلب الإرجاع",
                            )
                          : t("Attachment", "مرفق"))}
                    </p>
                    <p className="mt-2 text-[10px] opacity-60">
                      {formatDateTimeString(
                        m.occurred_at,
                        { timeStyle: "short" },
                        locale,
                      )}{" "}
                      ·{" "}
                      {m.direction === "OUTBOUND"
                        ? m.status === "READ"
                          ? t("Read", "مقروء")
                          : m.status === "DELIVERED"
                            ? t("Delivered", "تم التسليم")
                            : m.status === "FAILED"
                              ? t("Failed", "تعذّر الإرسال")
                              : t("Sent", "تم الإرسال")
                        : t("Received", "مستلم")}
                    </p>
                  </div>
                ))
              )}
              <div ref={end} />
            </div>
            <div className="mt-auto space-y-3 border-t p-4">
              {deliveries
                .filter((d) => d.status !== "PROCESSED")
                .slice(0, 3)
                .map((d) => (
                  <p
                    key={d.external_event_id}
                    className="text-xs text-muted-foreground"
                  >
                    {d.status === "FAILED"
                      ? t(
                          "A team reply needs checking. Refresh to see whether delivery recovers.",
                          "أحد ردود الفريق يحتاج متابعة. حدّث الصفحة للتحقق من حالة الإرسال.",
                        )
                      : t(
                          "A team reply is queued for delivery.",
                          "أحد ردود الفريق بانتظار الإرسال.",
                        )}
                  </p>
                ))}
              {!windowOpen && (
                <p className="rounded-lg bg-muted p-3 text-xs leading-5">
                  {t(
                    "The 24-hour reply window has closed. The customer needs to message again, or an approved template must be used. Free-text replies are disabled.",
                    "انتهت مهلة الرد خلال 24 ساعة. نحتاج رسالة جديدة من العميل أو قالبًا معتمدًا. الرد النصي غير متاح الآن.",
                  )}
                </p>
              )}
              <label className="sr-only" htmlFor="team-reply">
                {t("Your reply", "ردك")}
              </label>
              <Textarea
                id="team-reply"
                dir="auto"
                maxLength={4096}
                disabled={!windowOpen || busy}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("Write a thoughtful reply…", "اكتب ردك للعميل…")}
                className="min-h-20"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Sending pauses the assistant. Resume it when you're ready.",
                    "إرسال الرد يوقف المساعد. شغّله مرة ثانية متى ما انتهيت.",
                  )}
                </p>
                <Button
                  disabled={busy || !windowOpen || !text.trim()}
                  onClick={() => void reply()}
                >
                  {busy ? <Spinner /> : <Send className="size-4" />}
                  {t("Send", "إرسال")}
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
