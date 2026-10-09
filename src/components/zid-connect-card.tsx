"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, ClipboardPaste, Copy, KeyRound, Link2, Loader2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { ConnectStepper, ProgressChecklist, SuccessMark } from "@/components/integrations/connect-stepper";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QUICK } from "@/components/desk/primitives";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/*
 * Connect a Zid store through Zid's official, free "AI Connector | MCP" app.
 * The merchant installs it, copies their store's private link and pastes it
 * here. The link is verified against the store, stored encrypted and never
 * shown again. Reload only uses it to read orders and create returns.
 * Rendered inside the integrations side panel.
 */

const ZID_APP_URL = "https://apps.zid.sa/en/application/4820";
const LINK_PATTERN = /^https:\/\/zam-mcp-server\.zid\.sa\/mcp\/[A-Za-z0-9+/=_-]{16,}$/;
const ZID = "#7c3aed";

type ZidConnection = { external_store_name: string | null; status: "CONNECTING" | "CONNECTED" | "EXPIRED" | "REVOKED" | "ERROR" };
type Phase = "steps" | "connecting" | "success";

export function ZidConnectCard({ onChange, onDone }: { onChange?: () => void; onDone?: () => void }) {
  const { workspace } = useAuth();
  const { t } = useLanguage();
  const [connection, setConnection] = useState<ZidConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("steps");
  const [ticks, setTicks] = useState(0);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ storeName: string | null } | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState<"test" | "disconnect" | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!supabase || !workspace) return setLoading(false);
    const { data } = await supabase.from("commerce_connections").select("external_store_name, status")
      .eq("store_id", workspace.storeId).eq("platform", "zid").maybeSingle();
    setConnection(data as ZidConnection | null);
    setLoading(false);
  }, [workspace]);
  useEffect(() => { void load(); }, [load]);

  // Put focus in the paste field when step 3 opens.
  useEffect(() => { if (step === 2 && phase === "steps") window.setTimeout(() => inputRef.current?.focus(), 320); }, [step, phase]);

  const connected = connection?.status === "CONNECTED";
  const needsAttention = connection?.status === "EXPIRED" || connection?.status === "ERROR";
  const trimmed = link.trim();
  const linkState: "empty" | "valid" | "invalid" = !trimmed ? "empty" : LINK_PATTERN.test(trimmed) ? "valid" : "invalid";

  const invoke = async (body: Record<string, unknown>) => {
    if (!supabase || !workspace) throw new Error("no_workspace");
    const { data, error: fnError } = await supabase.functions.invoke("zid-connection", { body: { storeId: workspace.storeId, ...body } });
    if (fnError) {
      const context = (fnError as { context?: Response }).context;
      const payload = context ? await context.json().catch(() => ({})) : {};
      throw new Error(payload.error ?? "zid_connection_failed");
    }
    return data as { storeName?: string | null };
  };

  const errorText = (code: string) => ({
    zid_link_invalid: t("That link didn't work. Copy it again from the AI Connector app in Zid.", "الرابط لم يعمل. انسخه مرة أخرى من تطبيق AI Connector في زد."),
    zid_store_already_connected: t("This Zid store is already connected to another Reload workspace.", "متجر زد هذا مربوط بمساحة عمل أخرى في ريلود."),
    insufficient_permission: t("Only the workspace owner can connect a store.", "مالك مساحة العمل فقط يمكنه ربط المتجر."),
  } as Record<string, string>)[code] ?? t("Zid didn't respond. Please try again in a moment.", "لم يستجب زد. حاول مرة أخرى بعد قليل.");

  const connect = async () => {
    if (linkState !== "valid") { inputRef.current?.focus(); return; }
    setError(""); setPhase("connecting"); setTicks(0);
    // The checklist mirrors what the server does: reach the store, read an
    // order, encrypt and save. The last tick waits for the real answer.
    const timers = [window.setTimeout(() => setTicks(1), 650), window.setTimeout(() => setTicks(2), 1350)];
    try {
      const data = await invoke({ action: "connect", link: trimmed });
      timers.forEach(window.clearTimeout);
      setTicks(3);
      await new Promise((resolve) => window.setTimeout(resolve, 380));
      setResult({ storeName: data.storeName ?? null });
      setLink(""); setReplacing(false); setPhase("success");
      await load(); onChange?.();
    } catch (cause) {
      timers.forEach(window.clearTimeout);
      setPhase("steps");
      setError(errorText(cause instanceof Error ? cause.message : ""));
    }
  };

  const check = async () => {
    setBusy("test");
    try { await invoke({ action: "test" }); toast.success(t("Your Zid store is connected and responding.", "متجرك في زد مربوط ويستجيب.")); }
    catch (cause) { toast.error(errorText(cause instanceof Error ? cause.message : "")); }
    finally { await load(); onChange?.(); setBusy(null); }
  };

  const disconnect = async () => {
    setConfirmDisconnect(false); setBusy("disconnect");
    try {
      await invoke({ action: "disconnect" });
      toast.success(t("Zid disconnected. The link was deleted from Reload.", "تم فصل زد وحذف الرابط من ريلود."));
      setStep(0); setPhase("steps");
    } catch { toast.error(t("Couldn't disconnect. Please try again.", "تعذّر فصل الربط. حاول مرة أخرى.")); }
    finally { await load(); onChange?.(); setBusy(null); }
  };

  const paste = async () => {
    try { setLink((await navigator.clipboard.readText()).trim()); setError(""); }
    catch { inputRef.current?.focus(); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-12 rounded-2xl" /></div>;

  /* ── Just connected ── */
  if (phase === "success") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={QUICK} className="flex flex-col items-center py-6 text-center">
        <SuccessMark />
        <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{t("Zid is connected", "تم ربط زد")}</h3>
        <p className="mt-1.5 max-w-xs text-sm leading-6 text-muted-foreground" dir="auto">
          {t(`Reload can now check returns against orders in ${result?.storeName ?? "your Zid store"}.`, `يستطيع ريلود الآن التحقق من طلبات الإرجاع مقابل طلبات ${result?.storeName ?? "متجرك في زد"}.`)}
        </p>
        <div className="mt-6 grid w-full gap-2 text-start">
          {[t("Orders found and readable", "الطلبات موجودة وقابلة للقراءة"), t("Link encrypted and saved", "الرابط مشفّر ومحفوظ"), t("Returns can be created in Zid", "يمكن إنشاء المرتجعات في زد")].map((line, index) => (
            <motion.p key={line} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ ...QUICK, delay: 0.35 + index * 0.08 }}
              className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm"><Check className="size-4 text-eligible" />{line}</motion.p>
          ))}
        </div>
        <Button className="mt-6 h-11 w-full rounded-xl" onClick={() => { setPhase("steps"); onDone?.(); }}>{t("Done", "تم")}</Button>
      </motion.div>
    );
  }

  /* ── Connected ── */
  if (connected && !replacing) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{t("What Reload can do", "ما يستطيع ريلود فعله")}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[t("Find an order by number, phone or email", "إيجاد الطلب برقمه أو بالجوال أو البريد"), t("Read items, prices, status and delivery date", "قراءة المنتجات والأسعار والحالة وتاريخ التوصيل"), t("Create a return in Zid", "إنشاء طلب إرجاع في زد")].map((line) => (
              <li key={line} className="flex items-center gap-2.5"><Check className="size-4 shrink-0 text-eligible" />{line}</li>
            ))}
            <li className="flex items-center gap-2.5 text-muted-foreground"><span className="grid size-4 shrink-0 place-items-center text-xs">✕</span>{t("Never products, prices, coupons or settings", "لا يصل أبدًا للمنتجات أو الأسعار أو الكوبونات أو الإعدادات")}</li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void check()} disabled={busy !== null} className="rounded-xl">{busy === "test" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{t("Check connection", "فحص الربط")}</Button>
          <Button variant="ghost" onClick={() => { setReplacing(true); setStep(2); }} disabled={busy !== null} className="rounded-xl text-muted-foreground">{t("Replace link", "استبدال الرابط")}</Button>
          <Button variant="ghost" className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ms-auto" onClick={() => setConfirmDisconnect(true)} disabled={busy !== null}>{busy === "disconnect" ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4 rtl:-scale-x-100" />}{t("Disconnect", "فصل الربط")}</Button>
        </div>
        <Promises t={t} />
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
      </div>
    );
  }

  /* ── Guided connect ── */
  return (
    <div className="space-y-6">
      {needsAttention && !replacing && (
        <p className="flex items-start gap-2.5 rounded-2xl border border-review/25 bg-review-muted/50 p-3.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-review" />{t("Zid stopped accepting the saved link (it may have been reset). Paste a fresh one to reconnect.", "توقف زد عن قبول الرابط المحفوظ (ربما أُعيد إنشاؤه). الصق رابطًا جديدًا لإعادة الربط.")}
        </p>
      )}
      <ConnectStepper
        current={step} busy={phase === "connecting"} accent={ZID} backLabel={t("Change", "تعديل")}
        onBack={(index) => { if (phase !== "connecting") { setStep(index); setError(""); } }}
        steps={[
          {
            title: t("Install the AI Connector", "ثبّت تطبيق AI Connector"),
            summary: t("Installed from the Zid App Market", "مثبّت من سوق تطبيقات زد"),
            content: (
              <div className="space-y-3">
                <AppMarketMock t={t} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild className="rounded-xl"><a href={ZID_APP_URL} target="_blank" rel="noopener noreferrer">{t("Open Zid App Market", "افتح سوق تطبيقات زد")}<ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></a></Button>
                  <Button className="rounded-xl" onClick={() => setStep(1)}>{t("I've installed it", "تم التثبيت")}<ArrowRight className="size-3.5 rtl:-scale-x-100" /></Button>
                </div>
              </div>
            ),
          },
          {
            title: t("Copy your store's link", "انسخ رابط متجرك"),
            summary: t("Link copied from the AI Connector", "تم نسخ الرابط من AI Connector"),
            content: (
              <div className="space-y-3">
                <LinkMock t={t} />
                <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><KeyRound className="mt-0.5 size-3.5 shrink-0" />{t("Treat it like a password. Don't send it on WhatsApp or email; paste it straight into Reload.", "تعامل معه ككلمة مرور. لا ترسله عبر واتساب أو البريد، والصقه مباشرة في ريلود.")}</p>
                <Button className="rounded-xl" onClick={() => setStep(2)}>{t("I've copied it", "تم النسخ")}<ArrowRight className="size-3.5 rtl:-scale-x-100" /></Button>
              </div>
            ),
          },
          {
            title: t("Paste it here", "الصقه هنا"),
            content: phase === "connecting"
              ? <ProgressChecklist done={ticks} items={[t("Reaching your Zid store", "الوصول إلى متجرك في زد"), t("Reading your latest order", "قراءة آخر طلب"), t("Encrypting and saving the link", "تشفير الرابط وحفظه")]} />
              : (
                <form onSubmit={(event) => { event.preventDefault(); void connect(); }} className="space-y-3">
                  <div className={cn("flex items-center gap-2 rounded-2xl border bg-background p-1.5 ps-3.5 transition-[border-color,box-shadow] duration-200 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_18%,transparent)]",
                    linkState === "invalid" || error ? "border-destructive/50" : linkState === "valid" ? "border-eligible/50" : "border-border")}>
                    <Link2 className="size-4 shrink-0 text-muted-foreground" />
                    <input ref={inputRef} type="password" autoComplete="off" spellCheck={false} dir="ltr" value={link}
                      onChange={(event) => { setLink(event.target.value); setError(""); }}
                      placeholder="https://zam-mcp-server.zid.sa/mcp/…" aria-label={t("Zid AI Connector link", "رابط AI Connector من زد")}
                      className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground/70" />
                    <AnimatePresence initial={false} mode="popLayout">
                      {linkState === "valid"
                        ? <motion.span key="ok" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={QUICK} className="me-1 grid size-8 place-items-center rounded-full bg-eligible-muted text-eligible"><Check className="size-4" /></motion.span>
                        : <motion.button key="paste" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK} onClick={() => void paste()}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs font-medium transition-colors hover:bg-muted/70 active:scale-[.98]"><ClipboardPaste className="size-3.5" />{t("Paste", "لصق")}</motion.button>}
                    </AnimatePresence>
                  </div>
                  <AnimatePresence initial={false}>
                    {(error || linkState === "invalid") && (
                      <motion.p key="err" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={QUICK} className="overflow-hidden text-xs text-destructive">
                        {error || t("That's not an AI Connector link. It starts with https://zam-mcp-server.zid.sa/mcp/", "هذا ليس رابط AI Connector. يبدأ بـ https://zam-mcp-server.zid.sa/mcp/")}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <Button type="submit" disabled={linkState !== "valid"} className="h-11 w-full rounded-xl transition-transform active:scale-[.99]">{t("Connect Zid", "ربط زد")}</Button>
                  {replacing && <button type="button" onClick={() => { setReplacing(false); setLink(""); setError(""); }} className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{t("Keep the current link", "إبقاء الرابط الحالي")}</button>}
                </form>
              ),
          },
        ]}
      />
      <Promises t={t} />
    </div>
  );
}

type T = (en: string, ar: string) => string;

function Promises({ t }: { t: T }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" style={{ color: ZID }} />{t("Encrypted, never shown again", "مشفّر ولا يُعرض مرة أخرى")}</span>
      <span className="inline-flex items-center gap-1.5"><Link2 className="size-3.5" style={{ color: ZID }} />{t("Orders and returns only", "الطلبات والمرتجعات فقط")}</span>
      <span className="inline-flex items-center gap-1.5"><Unplug className="size-3.5" style={{ color: ZID }} />{t("Disconnect anytime", "فصل في أي وقت")}</span>
    </div>
  );
}

/** A small likeness of the app's card in the Zid App Market. */
function AppMarketMock({ t }: { t: T }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3">
      <Image src="/zid-logo.png" alt="" width={44} height={44} className="size-11 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" dir="ltr">Zid AI Connector | MCP</p>
        <p className="text-xs text-muted-foreground">{t("By Zid · Free App", "من زد · تطبيق مجاني")}</p>
      </div>
      <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: ZID }}>{t("Subscribe", "اشترك")}</span>
    </div>
  );
}

/** Where the link appears once the app is open in Zid. */
function LinkMock({ t }: { t: T }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{t("In Zid → Apps → AI Connector", "في زد ← التطبيقات ← AI Connector")}</p>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" dir="ltr">https://zam-mcp-server.zid.sa/mcp/••••••••••••</span>
        <span className="grid size-7 place-items-center rounded-lg text-white" style={{ background: ZID }}><Copy className="size-3.5" /></span>
      </div>
    </div>
  );
}
