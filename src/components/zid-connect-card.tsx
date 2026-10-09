"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Check, ClipboardPaste, Clock, Copy, ExternalLink, KeyRound, Link2, Loader2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QUICK } from "@/components/desk/primitives";
import { formatDateString, formatDateTimeString } from "@/lib/numerals";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/*
 * Zid stores connect through Zid's official, free "AI Connector | MCP" app.
 * The merchant installs it, copies their store's private link, and pastes it
 * here. The link is sent once to our server, verified against the store,
 * stored encrypted, and never shown again. Reload only uses it to read orders
 * and create returns.
 */

const ZID_APP_URL = "https://apps.zid.sa/en/application/4820";
const LINK_PATTERN = /^https:\/\/zam-mcp-server\.zid\.sa\/mcp\/[A-Za-z0-9+/=_-]{16,}$/;

type ZidConnection = {
  external_store_name: string | null;
  status: "CONNECTING" | "CONNECTED" | "EXPIRED" | "REVOKED" | "ERROR";
  connected_at: string | null;
  last_synced_at: string | null;
  last_error_code: string | null;
};

type Action = "connect" | "test" | "disconnect" | null;

export function ZidConnectCard({ onChange }: { onChange?: () => void }) {
  const { workspace } = useAuth();
  const { t, locale } = useLanguage();
  const [connection, setConnection] = useState<ZidConnection | null>(null);
  const [returnCode, setReturnCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<Action>(null);
  const [link, setLink] = useState("");
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState("");
  const [justConnected, setJustConnected] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!supabase || !workspace) return setLoading(false);
    const [{ data }, { data: store }] = await Promise.all([
      supabase.from("commerce_connections").select("external_store_name, status, connected_at, last_synced_at, last_error_code")
        .eq("store_id", workspace.storeId).eq("platform", "zid").maybeSingle(),
      supabase.from("stores").select("return_code").eq("id", workspace.storeId).maybeSingle(),
    ]);
    setConnection(data as ZidConnection | null);
    setReturnCode(typeof store?.return_code === "string" ? store.return_code : null);
    setLoading(false);
  }, [workspace]);

  useEffect(() => { void load(); }, [load]);

  const connected = connection?.status === "CONNECTED";
  const needsAttention = connection?.status === "EXPIRED" || connection?.status === "ERROR";
  const showForm = !connected || replacing;
  const trimmed = link.trim();
  const linkState: "empty" | "valid" | "invalid" = !trimmed ? "empty" : LINK_PATTERN.test(trimmed) ? "valid" : "invalid";
  const step = !installed && !trimmed ? 1 : linkState !== "valid" ? 2 : 3;
  const returnPath = returnCode ? `/return?store=${encodeURIComponent(returnCode)}` : null;

  const invoke = async (body: Record<string, unknown>) => {
    if (!supabase || !workspace) throw new Error("no_workspace");
    const { data, error: fnError } = await supabase.functions.invoke("zid-connection", { body: { storeId: workspace.storeId, ...body } });
    if (fnError) {
      const context = (fnError as { context?: Response }).context;
      const payload = context ? await context.json().catch(() => ({})) : {};
      throw new Error(payload.error ?? "zid_connection_failed");
    }
    return data as { storeName?: string | null; latestOrderAt?: string | null };
  };

  const errorText = (code: string) => ({
    zid_link_invalid: t("That link didn't work. Copy it again from the AI Connector app in Zid.", "الرابط لم يعمل. انسخه مرة أخرى من تطبيق AI Connector في زد."),
    zid_store_already_connected: t("This Zid store is already connected to another Reload workspace.", "متجر زد هذا مربوط بمساحة عمل أخرى في ريلود."),
    insufficient_permission: t("Only the workspace owner can connect a store.", "مالك مساحة العمل فقط يمكنه ربط المتجر."),
  } as Record<string, string>)[code] ?? t("Zid didn't respond. Please try again in a moment.", "لم يستجب زد. حاول مرة أخرى بعد قليل.");

  const connect = async () => {
    if (linkState !== "valid") {
      setError(t("Paste the full link from the AI Connector app. It starts with https://zam-mcp-server.zid.sa", "الصق الرابط كاملًا من تطبيق AI Connector. يبدأ بـ https://zam-mcp-server.zid.sa"));
      inputRef.current?.focus();
      return;
    }
    setAction("connect"); setError("");
    try {
      const result = await invoke({ action: "connect", link: trimmed });
      setLink(""); setReplacing(false); setJustConnected(true);
      toast.success(t(`Connected to ${result.storeName ?? "your Zid store"}.`, `تم الربط مع ${result.storeName ?? "متجرك في زد"}.`));
      await load(); onChange?.();
      window.setTimeout(() => setJustConnected(false), 2400);
    } catch (cause) {
      setError(errorText(cause instanceof Error ? cause.message : ""));
    } finally { setAction(null); }
  };

  const check = async () => {
    setAction("test");
    try {
      await invoke({ action: "test" });
      toast.success(t("Your Zid store is connected and responding.", "متجرك في زد مربوط ويستجيب."));
    } catch (cause) {
      toast.error(errorText(cause instanceof Error ? cause.message : ""));
    } finally { await load(); onChange?.(); setAction(null); }
  };

  const disconnect = async () => {
    setConfirmDisconnect(false); setAction("disconnect");
    try {
      await invoke({ action: "disconnect" });
      toast.success(t("Zid disconnected. The link was deleted from Reload.", "تم فصل زد وحذف الرابط من ريلود."));
      setInstalled(false);
    } catch {
      toast.error(t("Couldn't disconnect. Please try again.", "تعذّر فصل الربط. حاول مرة أخرى."));
    } finally { await load(); onChange?.(); setAction(null); }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setLink(text.trim()); setError(""); setInstalled(true);
    } catch {
      inputRef.current?.focus();
    }
  };

  const copyReturnLink = async () => {
    if (!returnPath) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}${returnPath}`); toast.success(t("Customer return link copied.", "تم نسخ رابط إرجاع العملاء.")); }
    catch { toast.error(t("Couldn't copy the link.", "تعذّر نسخ الرابط.")); }
  };

  const date = (value: string | null, withTime = false) => value
    ? (withTime ? formatDateTimeString(value, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, locale) : formatDateString(value, { year: "numeric", month: "short", day: "numeric" }, locale))
    : null;

  if (loading) return <Card className="rounded-3xl border-border/70"><CardContent className="space-y-4 p-6 sm:p-8"><div className="flex gap-4"><Skeleton className="size-[60px] rounded-2xl" /><div className="flex-1 space-y-2 pt-1"><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-2/3" /></div></div><Skeleton className="h-28 rounded-2xl" /></CardContent></Card>;

  return (
    <Card className="zid-card overflow-hidden rounded-3xl border-border/70 shadow-[0_22px_70px_-42px_hsl(var(--foreground)/0.25)]">
      <CardContent className="p-0">
        <div className="flex flex-col gap-7 p-5 sm:p-8">
          {/* Header */}
          <div className="flex items-start gap-4">
            <motion.div className="relative shrink-0" animate={justConnected ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}>
              <Image src="/zid-logo.png" alt="" width={60} height={60} className="size-[60px] rounded-2xl shadow-sm" />
              <AnimatePresence>
                {connected && <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={QUICK} className="absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full border-2 border-card bg-eligible text-white"><Check className="size-3" strokeWidth={3} /></motion.span>}
              </AnimatePresence>
            </motion.div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-semibold">{t("Zid", "زد")}</h2>
                {connected
                  ? <Badge className="border-eligible/20 bg-eligible-muted text-eligible"><Check className="size-3" /> {t("Connected", "متصل")}</Badge>
                  : needsAttention
                    ? <Badge className="border-review/25 bg-review-muted text-review"><AlertTriangle className="size-3" /> {t("Needs a new link", "يحتاج رابطًا جديدًا")}</Badge>
                    : <Badge variant="outline">{t("Not connected", "غير متصل")}</Badge>}
                <Badge variant="outline" className="font-normal text-muted-foreground">{t("via AI Connector", "عبر AI Connector")}</Badge>
              </div>
              <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                {connected
                  ? t(`Reload is connected to ${connection?.external_store_name ?? "your Zid store"} and checks each return against the real order.`, `ريلود مربوط بـ ${connection?.external_store_name ?? "متجرك في زد"} ويتحقق من كل طلب إرجاع مقابل الطلب الفعلي.`)
                  : needsAttention
                    ? t("Zid stopped accepting the saved link (it may have been reset). Paste a fresh link to reconnect.", "توقف زد عن قبول الرابط المحفوظ (ربما أُعيد إنشاؤه). الصق رابطًا جديدًا لإعادة الربط.")
                    : t("Connect with Zid's official, free AI Connector app. Three quick steps, no password shared.", "اربط عبر تطبيق AI Connector الرسمي والمجاني من زد. ثلاث خطوات سريعة دون مشاركة كلمة المرور.")}
              </p>
              {connected && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {connection?.connected_at && <span>{t(`Connected ${date(connection.connected_at)}`, `تم الربط ${date(connection.connected_at)}`)}</span>}
                <span>{t(`Last checked ${date(connection?.last_synced_at ?? null, true) ?? "not yet"}`, `آخر تحقق ${date(connection?.last_synced_at ?? null, true) ?? "لم يتم بعد"}`)}</span>
              </div>}
            </div>
          </div>

          {/* Guided connect */}
          <AnimatePresence initial={false} mode="wait">
            {showForm ? (
              <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={QUICK} className="space-y-3">
                <ol className="space-y-3">
                  <StepRow index={1} active={step === 1} done={step > 1} title={t("Install the AI Connector in Zid", "ثبّت تطبيق AI Connector في زد")}
                    body={t("Free and made by Zid. In your Zid dashboard: App Market → \"Zid AI Connector | MCP\".", "مجاني ومن زد. من لوحة زد: سوق التطبيقات ← \"Zid AI Connector | MCP\".")}>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild className="rounded-xl"><a href={ZID_APP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setInstalled(true)}>{t("Open in Zid App Market", "افتح في سوق تطبيقات زد")}<ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></a></Button>
                      {!installed && step === 1 && <Button size="sm" variant="ghost" className="rounded-xl text-muted-foreground" onClick={() => setInstalled(true)}>{t("Already installed", "مثبّت بالفعل")}</Button>}
                    </div>
                  </StepRow>
                  <StepRow index={2} active={step === 2} done={step > 2} title={t("Copy your store's MCP link", "انسخ رابط MCP لمتجرك")}
                    body={t("Open the AI Connector app in Zid and copy the link it shows. Treat it like a password: don't send it on WhatsApp or email.", "افتح تطبيق AI Connector في زد وانسخ الرابط الظاهر. تعامل معه ككلمة مرور: لا ترسله عبر واتساب أو البريد.")} />
                  <StepRow index={3} active={step === 3} done={false} title={t("Paste it here", "الصقه هنا")}>
                    <form onSubmit={(event) => { event.preventDefault(); void connect(); }} className="mt-3">
                      <div className={cn("zid-link-field flex items-center gap-2 rounded-2xl border bg-background p-1.5 ps-3 transition-[border-color,box-shadow] duration-200",
                        linkState === "invalid" || error ? "border-destructive/50" : linkState === "valid" ? "border-eligible/50" : "border-border")}>
                        <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                        <input ref={inputRef} type="password" autoComplete="off" spellCheck={false} dir="ltr" value={link} disabled={action === "connect"}
                          onChange={(event) => { setLink(event.target.value); setError(""); if (event.target.value) setInstalled(true); }}
                          placeholder="https://zam-mcp-server.zid.sa/mcp/…" aria-label={t("Zid AI Connector link", "رابط AI Connector من زد")}
                          className="h-10 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground/70" />
                        <AnimatePresence initial={false} mode="popLayout">
                          {linkState === "valid"
                            ? <motion.span key="ok" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={QUICK} className="grid size-7 place-items-center rounded-full bg-eligible-muted text-eligible"><Check className="size-4" /></motion.span>
                            : <motion.button key="paste" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK} onClick={() => void pasteFromClipboard()} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ClipboardPaste className="size-3.5" />{t("Paste", "لصق")}</motion.button>}
                        </AnimatePresence>
                        <Button type="submit" size="sm" disabled={action === "connect" || linkState !== "valid"} className="h-9 rounded-xl px-4">
                          {action === "connect" ? <><Loader2 className="size-4 animate-spin" /><span className="hidden sm:inline">{t("Checking your store…", "جارٍ التحقق من متجرك…")}</span><span className="sm:hidden">{t("Checking…", "جارٍ التحقق…")}</span></> : <><Link2 className="size-4" />{t("Connect", "ربط")}</>}
                        </Button>
                      </div>
                      <AnimatePresence initial={false}>
                        {(error || linkState === "invalid") && <motion.p key="err" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={QUICK} className="overflow-hidden px-1 pt-2 text-xs text-destructive">
                          {error || t("This doesn't look like an AI Connector link. It should start with https://zam-mcp-server.zid.sa/mcp/", "هذا لا يبدو رابط AI Connector. يجب أن يبدأ بـ https://zam-mcp-server.zid.sa/mcp/")}
                        </motion.p>}
                      </AnimatePresence>
                      <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 shrink-0" />{t("Encrypted on our side and never shown again. You can disconnect anytime from Zid or here.", "يُشفَّر لدينا ولا يُعرض مرة أخرى. يمكنك فصل الربط في أي وقت من زد أو من هنا.")}</p>
                    </form>
                  </StepRow>
                </ol>
                {replacing && <button type="button" onClick={() => { setReplacing(false); setLink(""); setError(""); }} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{t("Cancel", "إلغاء")}</button>}
              </motion.div>
            ) : (
              <motion.div key="connected" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={QUICK}
                className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-5" aria-busy={action !== null}>
                <Button variant="outline" onClick={() => void check()} disabled={action !== null} className="rounded-xl">{action === "test" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{t("Check connection", "فحص الربط")}</Button>
                <Button variant="ghost" onClick={() => setReplacing(true)} disabled={action !== null} className="rounded-xl text-muted-foreground">{t("Replace link", "استبدال الرابط")}</Button>
                <Button variant="ghost" className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ms-auto" onClick={() => setConfirmDisconnect(true)} disabled={action !== null}>{action === "disconnect" ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4 rtl:-scale-x-100" />}{t("Disconnect", "فصل الربط")}</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Promises */}
        <div className="grid border-t border-border/60 bg-muted/20 sm:grid-cols-3">
          <div className="flex items-center gap-3 p-4 text-sm"><ShieldCheck className="size-4 text-[#7c3aed] dark:text-[#b070ff]" /><span>{t("Encrypted link", "رابط مشفّر")}</span></div>
          <div className="flex items-center gap-3 border-y border-border/60 p-4 text-sm sm:border-x sm:border-y-0"><Link2 className="size-4 text-[#7c3aed] dark:text-[#b070ff]" /><span>{t("Orders and returns only", "الطلبات والمرتجعات فقط")}</span></div>
          <div className="flex items-center gap-3 p-4 text-sm"><Clock className="size-4 text-[#7c3aed] dark:text-[#b070ff]" /><span>{t("Disconnect anytime", "إمكانية فصل الربط في أي وقت")}</span></div>
        </div>

        {/* Return link, once connected */}
        <AnimatePresence initial={false}>
          {connected && returnPath && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={QUICK} className="overflow-hidden border-t border-border/60">
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-[#7c3aed]/15 bg-[#7c3aed]/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-semibold">{t("Customer return page", "صفحة إرجاع العملاء")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Customers enter their Zid order number and the phone or email on the order.", "يدخل العميل رقم طلبه في زد والجوال أو البريد المسجل في الطلب.")}</p></div>
                <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="rounded-xl" onClick={() => void copyReturnLink()}><Copy className="size-4" />{t("Copy link", "نسخ الرابط")}</Button><Button size="sm" className="rounded-xl" asChild><a href={returnPath} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />{t("Open page", "فتح الصفحة")}</a></Button></div>
              </div>
            </div>
          </motion.div>}
        </AnimatePresence>
      </CardContent>

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Disconnect Zid?", "فصل الربط مع زد؟")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Reload deletes the saved link and stops checking Zid orders. Customers won't be able to start returns until you connect again. Past cases stay.", "سيحذف ريلود الرابط المحفوظ ويتوقف عن التحقق من طلبات زد. لن يتمكن العملاء من بدء الإرجاع حتى تعيد الربط. تبقى الحالات السابقة.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep connected", "إبقاء الربط")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void disconnect()}>{t("Disconnect", "فصل الربط")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** One step of the guided connect: number → check when done, highlighted when current. */
function StepRow({ index, active, done, title, body, children }: { index: number; active: boolean; done: boolean; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <li className={cn("zid-step relative flex gap-3.5 rounded-2xl border p-4 transition-[background-color,border-color,opacity] duration-300",
      active ? "border-[#7c3aed]/30 bg-[#7c3aed]/[0.035]" : done ? "border-border/60 bg-muted/20" : "border-border/60 opacity-70")}>
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-300",
        done ? "bg-eligible text-white" : active ? "bg-[#7c3aed] text-white dark:bg-[#b070ff] dark:text-[#1d0b33]" : "bg-muted text-muted-foreground")}>
        <AnimatePresence initial={false} mode="wait">
          {done
            ? <motion.span key="done" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={QUICK}><Check className="size-3.5" strokeWidth={3} /></motion.span>
            : <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={QUICK}>{index}</motion.span>}
        </AnimatePresence>
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={cn("text-sm font-semibold", done && "text-muted-foreground")}>{title}</p>
        {body && <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>}
        {children}
      </div>
    </li>
  );
}
