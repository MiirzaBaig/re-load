"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, Check, ChevronRight, Copy, Download, ExternalLink, FileText, Link2, Loader2,
  QrCode, RefreshCw, ShieldCheck, ShoppingBag, Sparkles, Store, Unplug, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { IntegrationsPageSkeleton } from "@/components/merchant-skeletons";
import { WhatsAppLogo } from "@/components/phone-frame";
import { ZidConnectCard } from "@/components/zid-connect-card";
import { QUICK, TWEEN } from "@/components/desk/primitives";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { createBrandQr } from "@/lib/brand-qr";
import { renderQrPng } from "@/lib/event-poster";
import { formatDateString, formatDateTimeString } from "@/lib/numerals";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { getWhatsAppStartUrl } from "@/lib/whatsapp";

/*
 * Integrations hub: where a merchant connects their store and shares returns.
 *   1. Journey: store → policy → WhatsApp → live, so the next step is obvious.
 *   2. Your store: one tile per platform; setup and management open in a side
 *      panel so the page itself stays short.
 *   3. Channels: WhatsApp, and the customer return page (link + QR).
 */

type Status = "CONNECTING" | "CONNECTED" | "EXPIRED" | "REVOKED" | "ERROR";
type Connection = { external_store_name: string | null; status: Status; connected_at: string | null; last_synced_at: string | null };
type WhatsAppConnection = {
  status: "CONNECTING" | "CONNECTED" | "RESTRICTED" | "DISCONNECTED" | "ERROR";
  display_phone_number: string | null;
  connected_at: string | null;
  last_webhook_at: string | null;
};
type Platform = "salla" | "zid";
type Tone = "connected" | "attention" | "idle";

export function IntegrationsPage() {
  const { user, workspace } = useAuth();
  const { t, locale, isArabic } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [salla, setSalla] = useState<Connection | null>(null);
  const [zid, setZid] = useState<Connection | null>(null);
  const [whatsApp, setWhatsApp] = useState<WhatsAppConnection | null>(null);
  const [policyReady, setPolicyReady] = useState(false);
  const [returnCode, setReturnCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Platform | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !workspace) return setLoading(false);
    const [commerce, whatsAppResult, policy, store] = await Promise.all([
      supabase.from("commerce_connections").select("platform, external_store_name, status, connected_at, last_synced_at").eq("store_id", workspace.storeId),
      supabase.from("whatsapp_connections").select("status, display_phone_number, connected_at, last_webhook_at").eq("store_id", workspace.storeId).maybeSingle(),
      supabase.from("policy_versions").select("id").eq("store_id", workspace.storeId).limit(1).maybeSingle(),
      supabase.from("stores").select("return_code").eq("id", workspace.storeId).maybeSingle(),
    ]);
    if (commerce.error) toast.error(t("Could not load your store connections.", "تعذّر تحميل ربط المتجر."));
    const rows = (commerce.data ?? []) as Array<Connection & { platform: string }>;
    setSalla(rows.find((row) => row.platform === "salla") ?? null);
    setZid(rows.find((row) => row.platform === "zid") ?? null);
    if (whatsAppResult.error) toast.error(t("Could not load the WhatsApp channel.", "تعذّر تحميل قناة واتساب."));
    setWhatsApp(whatsAppResult.data as WhatsAppConnection | null);
    setPolicyReady(Boolean(policy.data));
    setReturnCode(typeof store.data?.return_code === "string" ? store.data.return_code : null);
    setLoading(false);
  }, [workspace, t]);

  useEffect(() => { void load(); }, [load]);

  // Back from Salla's authorization screen.
  useEffect(() => {
    const result = searchParams.get("salla");
    if (!result) return;
    if (result === "connected") toast.success(t("Salla store connected successfully.", "تم ربط متجر سلة بنجاح."));
    else if (result === "cancelled") toast.info(t("Salla connection was cancelled.", "تم إلغاء ربط سلة."));
    else toast.error(t("Salla could not be connected. Please try again.", "تعذّر ربط سلة. يرجى المحاولة مرة أخرى."));
    router.replace("/app/integrations");
    void load();
  }, [load, router, searchParams, t]);

  const sallaConnected = salla?.status === "CONNECTED";
  const zidConnected = zid?.status === "CONNECTED";
  const storeConnected = sallaConnected || zidConnected;
  const whatsAppConnected = whatsApp?.status === "CONNECTED";
  const returnPath = returnCode ? `/return?store=${encodeURIComponent(returnCode)}` : null;
  const whatsAppNumber = whatsApp?.display_phone_number?.replace(/\D/g, "") ?? "";
  const whatsAppLink = whatsAppConnected && whatsAppNumber ? getWhatsAppStartUrl(whatsAppNumber) : null;
  const toneOf = (connection: Connection | null): Tone =>
    connection?.status === "CONNECTED" ? "connected" : connection?.status === "EXPIRED" || connection?.status === "ERROR" ? "attention" : "idle";
  const date = (value: string | null, withTime = false) => value
    ? withTime
      ? formatDateTimeString(value, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, locale)
      : formatDateString(value, { year: "numeric", month: "short", day: "numeric" }, locale)
    : null;

  if (loading) return <IntegrationsPageSkeleton />;

  if (user && !workspace) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center py-16 text-center animate-fade-in">
        <span className="grid size-14 place-items-center rounded-2xl border border-border bg-muted/50"><Store className="size-6" /></span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">{t("No store workspace on this account", "لا توجد مساحة متجر في هذا الحساب")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Sign in with the account that owns your store, or contact Reload to set up a workspace for it.", "سجّل الدخول بالحساب المالك لمتجرك، أو تواصل مع ريلود لإعداد مساحة عمل له.")}</p>
        <Button asChild className="mt-6 rounded-xl"><a href="mailto:info@reload.sa">{t("Contact Reload", "تواصل مع ريلود")}</a></Button>
      </div>
    );
  }

  const steps = [
    { key: "store", done: storeConnected, label: t("Store connected", "ربط المتجر") },
    { key: "policy", done: policyReady, label: t("Policy published", "نشر السياسة") },
    { key: "whatsapp", done: whatsAppConnected, label: t("WhatsApp channel", "قناة واتساب") },
    { key: "live", done: storeConnected && policyReady, label: t("Returns live", "الإرجاع مفعّل") },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  // The line fills up to the last step finished in order.
  const leadingDone = steps.findIndex((step) => !step.done) === -1 ? steps.length : steps.findIndex((step) => !step.done);
  const next = !storeConnected
    ? { text: t("Connect your store to start verifying real orders.", "اربط متجرك لبدء التحقق من الطلبات الفعلية."), cta: t("Choose your platform", "اختر منصتك"), action: () => document.getElementById("your-store")?.scrollIntoView({ behavior: "smooth", block: "start" }) }
    : !policyReady
      ? { text: t("Publish your return policy so Reload can decide returns.", "انشر سياسة الإرجاع ليتمكن ريلود من البت في الطلبات."), cta: t("Publish policy", "نشر السياسة"), href: "/app/policies" }
      : !whatsAppConnected
        ? { text: t("Returns are live on your return page. WhatsApp is next, and the Reload team activates it with you.", "الإرجاع مفعّل في صفحة الإرجاع. واتساب هو الخطوة التالية ويفعّله فريق ريلود معك."), cta: null }
        : { text: t("Everything is connected. Share your return link with customers.", "كل شيء مربوط. شارك رابط الإرجاع مع عملائك."), cta: null };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 pb-6">
      {/* ── Header + journey ── */}
      <section className="integrations-hero relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 sm:p-8">
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"><Zap className="size-3" />{t("Integrations", "التكاملات")}</span>
          <h1 className="mt-4 font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">{t("Connect once. Returns run themselves.", "اربط مرة واحدة، والإرجاع يعمل تلقائيًا.")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("Link your store so every return is checked against the real order, then share one link with your customers.", "اربط متجرك ليتحقق ريلود من كل طلب إرجاع مقابل الطلب الفعلي، ثم شارك رابطًا واحدًا مع عملائك.")}</p>

          <div className="mt-8" aria-label={t(`${doneCount} of ${steps.length} steps done`, `${doneCount} من ${steps.length} خطوات مكتملة`)}>
            <div className="relative grid grid-cols-4">
              <div className="absolute inset-x-[12.5%] top-[13px] h-[2px] rounded-full bg-border" aria-hidden="true" />
              <motion.div className="absolute start-[12.5%] top-[13px] h-[2px] rounded-full bg-foreground" aria-hidden="true"
                initial={{ width: 0 }} animate={{ width: `${(Math.max(0, leadingDone - 1) / 3) * 75}%` }}
                transition={{ ...TWEEN, duration: 0.9, delay: 0.15 }} />
              {steps.map((step, index) => (
                <div key={step.key} className="relative flex flex-col items-center gap-2 text-center">
                  <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...QUICK, delay: 0.1 + index * 0.08 }}
                    className={cn("relative z-[1] grid size-7 place-items-center rounded-full border-2 text-[11px] font-semibold transition-colors duration-300",
                      step.done ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground")}>
                    {step.done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                  </motion.span>
                  <span className={cn("text-[11px] font-medium leading-4 sm:text-xs", step.done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2.5 text-sm"><Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{next.text}</span></p>
              {next.cta && ("href" in next && next.href
                ? <Button asChild size="sm" className="shrink-0 rounded-xl"><Link href={next.href}>{next.cta}<ArrowRight className="size-3.5 rtl:-scale-x-100" /></Link></Button>
                : <Button size="sm" className="shrink-0 rounded-xl" onClick={"action" in next ? next.action : undefined}>{next.cta}<ArrowRight className="size-3.5 rtl:-scale-x-100" /></Button>)}
            </div>
          </div>
        </div>
      </section>

      {/* ── Your store ── */}
      <section id="your-store" className="scroll-mt-20">
        <SectionHeading title={t("Your store", "متجرك")} subtitle={t("Where your orders live. Reload reads orders and creates returns, nothing else.", "حيث توجد طلباتك. يقرأ ريلود الطلبات وينشئ المرتجعات فقط.")} />
        <div className="desk-stagger mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
          <StoreTile
            name={t("Salla", "سلة")} logo={<Image src="/salla-logo.png" alt="" width={30} height={30} className="rounded-lg" />} logoBg="bg-[#004d5a]"
            tone={toneOf(salla)} detail={sallaConnected ? salla?.external_store_name ?? t("Your store", "متجرك") : t("Official Salla app", "تطبيق سلة الرسمي")}
            labels={labelsFor(t)} onOpen={() => setPanel("salla")} />
          <StoreTile
            name={t("Zid", "زد")} logo={<Image src="/zid-logo.png" alt="" width={48} height={48} className="size-12 rounded-xl" />} logoBg=""
            tone={toneOf(zid)} detail={zidConnected ? zid?.external_store_name ?? t("Your store", "متجرك") : t("Free via Zid's AI Connector", "مجانًا عبر AI Connector من زد")}
            labels={labelsFor(t)} onOpen={() => setPanel("zid")} />
          <StoreTile
            name="Shopify" logo={<ShoppingBag className="size-6 text-[#5e8e3e]" />} logoBg="bg-[#95bf47]/15"
            tone="idle" detail={t("We'll let you know", "سنبلغك عند التوفر")} soon labels={labelsFor(t)} />
        </div>
      </section>

      {/* ── Channels ── */}
      <section>
        <SectionHeading title={t("Customer channels", "قنوات العملاء")} subtitle={t("Where customers start a return.", "حيث يبدأ عملاؤك طلب الإرجاع.")} />
        <div className="desk-stagger mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2" style={{ ["--desk-base" as string]: "120ms" }}>
          <ReturnPageCard returnPath={storeConnected ? returnPath : null} t={t} />
          <WhatsAppCard
            connected={whatsAppConnected} link={whatsAppLink} storeConnected={storeConnected} policyReady={policyReady}
            connectedAt={date(whatsApp?.connected_at ?? null)} lastMessage={date(whatsApp?.last_webhook_at ?? null, true)} t={t} />
        </div>
      </section>

      {/* ── Platform side panel ── */}
      <Sheet open={panel !== null} onOpenChange={(open) => { if (!open) setPanel(null); }}>
        <SheetContent side={isArabic ? "left" : "right"} showCloseButton={false} className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
          <SheetTitle className="sr-only">{panel === "zid" ? t("Zid", "زد") : t("Salla", "سلة")}</SheetTitle>
          <SheetDescription className="sr-only">{t("Connect or manage your store", "اربط متجرك أو أدره")}</SheetDescription>
          {panel && (
            <div key={panel} className="admin-fade">
              <PanelHeader
                platform={panel} tone={toneOf(panel === "zid" ? zid : salla)} connection={panel === "zid" ? zid : salla}
                connectedAt={date((panel === "zid" ? zid : salla)?.connected_at ?? null)}
                lastChecked={date((panel === "zid" ? zid : salla)?.last_synced_at ?? null, true)}
                t={t} onClose={() => setPanel(null)} />
              <div className="px-6 pb-8 pt-6">
                {panel === "zid"
                  ? <ZidConnectCard embedded onChange={() => void load()} />
                  : <SallaPanel connected={sallaConnected} storeId={workspace?.storeId ?? null} signedIn={Boolean(user)} t={t} onChange={() => void load()} />}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

type T = (en: string, ar: string) => string;

function labelsFor(t: T) {
  return {
    connected: t("Connected", "متصل"),
    attention: t("Needs attention", "يحتاج انتباهًا"),
    idle: t("Not connected", "غير متصل"),
    connect: t("Connect", "ربط"),
    manage: t("Manage", "إدارة"),
    fix: t("Fix", "إصلاح"),
    soon: t("Coming soon", "قريبًا"),
  };
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors duration-300",
      tone === "connected" ? "bg-eligible-muted text-eligible" : tone === "attention" ? "bg-review-muted text-review" : "bg-muted text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", tone === "connected" ? "bg-eligible" : tone === "attention" ? "bg-review" : "bg-muted-foreground/50")} />
      {label}
    </span>
  );
}

function StoreTile({ name, logo, logoBg, tone, detail, soon, labels, onOpen }: {
  name: string; logo: ReactNode; logoBg: string; tone: Tone; detail: string; soon?: boolean;
  labels: ReturnType<typeof labelsFor>; onOpen?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn("relative grid size-12 place-items-center overflow-hidden rounded-xl", logoBg)}>
          {logo}
        </span>
        {soon
          ? <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{labels.soon}</span>
          : <StatusPill tone={tone} label={labels[tone]} />}
      </div>
      <div className="mt-5 min-w-0">
        <p className="font-display text-base font-semibold">{name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="auto">{detail}</p>
      </div>
      {!soon && <span className={cn("store-tile-cta mt-5 inline-flex items-center gap-1 text-sm font-medium",
        tone === "attention" ? "text-review" : "text-foreground")}>
        {tone === "connected" ? labels.manage : tone === "attention" ? labels.fix : labels.connect}
        <ChevronRight className="size-4 rtl:rotate-180" />
      </span>}
      <AnimatePresence>
        {tone === "connected" && <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ ...QUICK, delay: 0.25 }}
          className="absolute start-[52px] top-[52px] grid size-5 place-items-center rounded-full border-2 border-card bg-eligible text-white"><Check className="size-3" strokeWidth={3} /></motion.span>}
      </AnimatePresence>
    </>
  );
  const cls = cn("store-tile admin-card group relative flex min-h-[188px] flex-col rounded-2xl border bg-card p-5 text-start",
    soon ? "border-dashed border-border/80 opacity-70" : "admin-lift border-border",
    tone === "connected" && "border-eligible/30");
  return soon
    ? <div className={cls} aria-disabled="true">{content}</div>
    : <button type="button" onClick={onOpen} className={cls}>{content}</button>;
}

function PanelHeader({ platform, tone, connection, connectedAt, lastChecked, t, onClose }: {
  platform: Platform; tone: Tone; connection: Connection | null; connectedAt: string | null; lastChecked: string | null; t: T; onClose: () => void;
}) {
  const labels = labelsFor(t);
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 pb-5 pt-5 backdrop-blur">
      <div className="flex items-start gap-4">
        {platform === "zid"
          ? <Image src="/zid-logo.png" alt="" width={52} height={52} className="size-[52px] rounded-2xl" />
          : <span className="grid size-[52px] place-items-center rounded-2xl bg-[#004d5a]"><Image src="/salla-logo.png" alt="" width={34} height={34} className="rounded-lg" /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-semibold">{platform === "zid" ? t("Zid", "زد") : t("Salla", "سلة")}</h2>
            <StatusPill tone={tone} label={labels[tone]} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground" dir="auto">
            {tone === "connected"
              ? connection?.external_store_name ?? t("Your store", "متجرك")
              : platform === "zid" ? t("Connect with Zid's free AI Connector app.", "اربط عبر تطبيق AI Connector المجاني من زد.") : t("Connect with Reload's Salla app.", "اربط عبر تطبيق ريلود في سلة.")}
          </p>
          {tone === "connected" && <p className="mt-1 text-xs text-muted-foreground">
            {connectedAt && t(`Connected ${connectedAt}`, `تم الربط ${connectedAt}`)}{connectedAt && " · "}{t(`Last checked ${lastChecked ?? "not yet"}`, `آخر تحقق ${lastChecked ?? "لم يتم بعد"}`)}
          </p>}
        </div>
        <button type="button" onClick={onClose} aria-label={t("Close", "إغلاق")} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <span aria-hidden="true" className="text-lg leading-none">×</span>
        </button>
      </div>
    </div>
  );
}

function SallaPanel({ connected, storeId, signedIn, t, onChange }: { connected: boolean; storeId: string | null; signedIn: boolean; t: T; onChange: () => void }) {
  const [action, setAction] = useState<"connect" | "test" | "disconnect" | null>(null);
  const [confirm, setConfirm] = useState(false);

  const connect = async () => {
    if (!supabase || !signedIn || !storeId) { toast.error(t("Sign in before connecting a store.", "سجّل الدخول قبل ربط المتجر.")); return; }
    setAction("connect");
    const { data, error } = await supabase.functions.invoke("salla-oauth-start", { body: { storeId, redirectPath: "/app/integrations" } });
    if (error || !data?.authorizationUrl) { toast.error(t("Could not start Salla authorization.", "تعذّر بدء عملية التفويض مع سلة.")); setAction(null); return; }
    window.location.assign(data.authorizationUrl);
  };
  const run = async (next: "test" | "disconnect") => {
    if (!supabase || !storeId) return;
    setConfirm(false); setAction(next);
    const { error } = await supabase.functions.invoke("salla-connection", { body: { storeId, action: next } });
    if (error) toast.error(next === "test" ? t("Salla did not accept the stored connection.", "لم تقبل سلة بيانات الربط المحفوظة.") : t("Could not disconnect Salla.", "تعذّر فصل الربط مع سلة."));
    else toast.success(next === "test" ? t("Salla connection is healthy.", "الربط مع سلة يعمل بشكل سليم.") : t("Salla credentials removed from Reload.", "تم حذف بيانات سلة من ريلود."));
    onChange(); setAction(null);
  };

  return (
    <div className="space-y-6">
      {connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => void run("test")} disabled={action !== null}>{action === "test" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{t("Check connection", "فحص الربط")}</Button>
          <Button variant="ghost" className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ms-auto" onClick={() => setConfirm(true)} disabled={action !== null}>{action === "disconnect" ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4 rtl:-scale-x-100" />}{t("Disconnect", "فصل الربط")}</Button>
        </div>
      ) : (
        <>
          <ol className="space-y-3">
            {[
              t("Click Connect. You'll go to Salla to approve access.", "اضغط ربط. ستنتقل إلى سلة للموافقة على الوصول."),
              t("Sign in to Salla and approve Reload.", "سجّل الدخول إلى سلة ووافق على ريلود."),
              t("You come back here, connected.", "تعود هنا وقد تم الربط."),
            ].map((text, index) => (
              <li key={text} className="flex gap-3.5 rounded-2xl border border-border/60 p-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{index + 1}</span>
                <p className="pt-1 text-sm">{text}</p>
              </li>
            ))}
          </ol>
          <Button className="h-11 w-full rounded-xl" onClick={() => void connect()} disabled={action !== null}>
            {action === "connect" ? <><Loader2 className="size-4 animate-spin" />{t("Opening Salla…", "جارٍ فتح سلة…")}</> : <><Link2 className="size-4" />{t("Connect Salla", "ربط سلة")}</>}
          </Button>
        </>
      )}
      <div className="grid overflow-hidden rounded-2xl border border-border/60 bg-muted/20 sm:grid-cols-3">
        <div className="flex items-center gap-3 p-4 text-sm"><ShieldCheck className="size-4 text-[#004d5a] dark:text-[#5ec6c6]" />{t("Encrypted access", "وصول مشفّر")}</div>
        <div className="flex items-center gap-3 border-y border-border/60 p-4 text-sm sm:border-x sm:border-y-0"><FileText className="size-4 text-[#004d5a] dark:text-[#5ec6c6]" />{t("Orders read only", "قراءة الطلبات فقط")}</div>
        <div className="flex items-center gap-3 p-4 text-sm"><Unplug className="size-4 text-[#004d5a] dark:text-[#5ec6c6]" />{t("Disconnect anytime", "فصل في أي وقت")}</div>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Disconnect Salla?", "فصل الربط مع سلة؟")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Reload removes its access and stops checking Salla orders. Past cases stay.", "سيحذف ريلود صلاحية الوصول ويتوقف عن التحقق من طلبات سلة. تبقى الحالات السابقة.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep connected", "إبقاء الربط")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void run("disconnect")}>{t("Disconnect", "فصل الربط")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChannelCard({ icon, iconBg, title, tone, toneLabel, children }: { icon: ReactNode; iconBg: string; title: string; tone: Tone; toneLabel: string; children: ReactNode }) {
  return (
    <div className="admin-card flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid size-11 place-items-center rounded-xl", iconBg)}>{icon}</span>
        <StatusPill tone={tone} label={toneLabel} />
      </div>
      <p className="mt-4 font-display text-base font-semibold">{title}</p>
      <div className="mt-1 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function ReturnPageCard({ returnPath, t }: { returnPath: string | null; t: T }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" && returnPath ? `${window.location.origin}${returnPath}` : "";
  const qr = useMemo(() => (url ? createBrandQr(url) : null), [url]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { toast.error(t("Couldn't copy the link.", "تعذّر نسخ الرابط.")); }
  };
  const downloadQr = async () => {
    if (!qr) return;
    try {
      const blob = await renderQrPng(qr.svg("ink"));
      const href = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href, download: "reload-return-qr.png" });
      document.body.append(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch { toast.error(t("Couldn't create the QR code.", "تعذّر إنشاء رمز QR.")); }
  };

  return (
    <ChannelCard icon={<Link2 className="size-5" />} iconBg="bg-muted" title={t("Customer return page", "صفحة إرجاع العملاء")}
      tone={returnPath ? "connected" : "idle"} toneLabel={returnPath ? t("Live", "مفعّلة") : t("After connecting", "بعد الربط")}>
      <p className="text-sm leading-6 text-muted-foreground">{returnPath
        ? t("Customers enter their order number and the phone or email on the order. Reload checks it against your store.", "يدخل العميل رقم طلبه والجوال أو البريد المسجل. يتحقق ريلود منه مقابل متجرك.")
        : t("Connect your store and this link goes live.", "اربط متجرك وسيُفعّل هذا الرابط.")}</p>
      {returnPath && (
        <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" dir="ltr">{url.replace(/^https?:\/\//, "")}</span>
            <button type="button" onClick={() => void copy()} aria-label={t("Copy link", "نسخ الرابط")} className="relative grid size-7 shrink-0 place-items-center rounded-lg transition-colors hover:bg-muted">
              <AnimatePresence initial={false} mode="wait">
                {copied
                  ? <motion.span key="ok" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK}><Check className="size-3.5 text-eligible" /></motion.span>
                  : <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK}><Copy className="size-3.5" /></motion.span>}
              </AnimatePresence>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-xl" asChild><a href={returnPath} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />{t("Open page", "فتح الصفحة")}</a></Button>
            {qr && (
              <Popover>
                <PopoverTrigger asChild><Button size="sm" variant="outline" className="rounded-xl"><QrCode className="size-4" />{t("QR code", "رمز QR")}</Button></PopoverTrigger>
                <PopoverContent align="start" className="w-64 rounded-2xl p-4">
                  <div className="qr-preview overflow-hidden rounded-xl bg-[#f8f7f4] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr.svg("ink") }} />
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("Print it on packing slips or invoices so customers can start a return in seconds.", "اطبعه على الفواتير أو بطاقات الطلب ليبدأ العميل الإرجاع في ثوانٍ.")}</p>
                  <Button size="sm" variant="outline" className="mt-3 w-full rounded-xl" onClick={() => void downloadQr()}><Download className="size-4" />{t("Download PNG", "تنزيل PNG")}</Button>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      )}
    </ChannelCard>
  );
}

function WhatsAppCard({ connected, link, storeConnected, policyReady, connectedAt, lastMessage, t }: {
  connected: boolean; link: string | null; storeConnected: boolean; policyReady: boolean; connectedAt: string | null; lastMessage: string | null; t: T;
}) {
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast.success(t("Customer WhatsApp link copied.", "تم نسخ رابط واتساب للعملاء.")); }
    catch { toast.error(t("Could not copy the link. Please try again.", "تعذّر نسخ الرابط. حاول مرة أخرى.")); }
  };
  return (
    <ChannelCard icon={<WhatsAppLogo className="size-6" />} iconBg="bg-[#25D366]/12 text-[#128C7E] dark:text-[#25D366]" title="WhatsApp"
      tone={connected ? "connected" : "idle"} toneLabel={connected ? t("Connected", "متصل") : t("Awaiting activation", "بانتظار التفعيل")}>
      <p className="text-sm leading-6 text-muted-foreground">{connected
        ? t("Customers start a return in WhatsApp. Their requests and photos appear in your return cases.", "يبدأ عملاؤك الإرجاع من واتساب، وتظهر طلباتهم وصورهم ضمن حالات الإرجاع.")
        : t("The Reload team activates this with you once your store is connected and your policy is published.", "يفعّل فريق ريلود هذه القناة معك بعد ربط متجرك ونشر سياستك.")}</p>
      {connected ? (
        <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
          <p className="text-xs text-muted-foreground">{connectedAt && t(`Connected ${connectedAt}`, `تم الربط ${connectedAt}`)}{connectedAt && " · "}{t(`Last message ${lastMessage ?? "not yet"}`, `آخر رسالة ${lastMessage ?? "لم تصل بعد"}`)}</p>
          {link ? <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void copy()}><Copy className="size-4" />{t("Copy WhatsApp link", "نسخ رابط واتساب")}</Button>
            <Button size="sm" variant="ghost" className="rounded-xl" asChild><a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{t("Open chat", "فتح المحادثة")}</a></Button>
          </div> : <p className="flex items-center gap-1.5 text-xs text-review"><AlertTriangle className="size-3.5" />{t("Active, but its number is unavailable. Contact Reload before sharing.", "مفعّلة لكن رقمها غير متوفر. تواصل مع ريلود قبل المشاركة.")}</p>}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 items-end">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { done: storeConnected, label: t("Store connected", "ربط المتجر") },
              { done: policyReady, label: t("Policy published", "نشر السياسة") },
              { done: false, label: t("Activation", "التفعيل") },
            ].map((item, index) => (
              <span key={item.label} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors duration-300", item.done ? "bg-eligible-muted text-eligible" : "bg-muted text-muted-foreground")}>
                {item.done ? <Check className="size-3" /> : <span className="tabular-nums">{index + 1}</span>}{item.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </ChannelCard>
  );
}
