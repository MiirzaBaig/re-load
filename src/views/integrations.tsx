"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Check, ChevronRight, Copy, Download, ExternalLink, FileText, Link2, Loader2,
  Lock, QrCode, RefreshCw, ShieldCheck, ShoppingBag, Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { IntegrationsPageSkeleton } from "@/components/merchant-skeletons";
import { WhatsAppLogo } from "@/components/phone-frame";
import { WhatsAppLinkPreview } from "@/components/whatsapp-link-preview";
import { ZidConnectCard } from "@/components/zid-connect-card";
import { ConnectStepper } from "@/components/integrations/connect-stepper";
import { ProgressRing } from "@/components/desk/progress-ring";
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
  const { workspace } = useAuth();
  const { t, locale, isArabic } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [salla, setSalla] = useState<Connection | null>(null);
  const [zid, setZid] = useState<Connection | null>(null);
  const [whatsApp, setWhatsApp] = useState<WhatsAppConnection | null>(null);
  const [policyReady, setPolicyReady] = useState(false);
  const [returnCode, setReturnCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelBusy, setChannelBusy] = useState(false);
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
  const whatsAppLink = whatsAppConnected && whatsAppNumber && returnCode ? getWhatsAppStartUrl(whatsAppNumber, returnCode) : null;
  const toneOf = (connection: Connection | null): Tone =>
    connection?.status === "CONNECTED" ? "connected" : connection?.status === "EXPIRED" || connection?.status === "ERROR" ? "attention" : "idle";
  const date = (value: string | null, withTime = false) => value
    ? withTime
      ? formatDateTimeString(value, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, locale)
      : formatDateString(value, { year: "numeric", month: "short", day: "numeric" }, locale)
    : null;

  const activateWhatsApp = async () => {
    if (!supabase || !workspace || channelBusy) return;
    setChannelBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connection", { body: { storeId: workspace.storeId, action: "connect" } });
      if (error || !data?.connected) throw new Error("channel_not_connected");
      toast.success(t("WhatsApp is ready. Share your store’s link with customers.", "واتساب جاهز. شارك رابط متجرك مع العملاء."));
      await load();
    } catch { toast.error(t("Couldn’t activate WhatsApp. Check your store connection and published policy, then try again.", "تعذّر تفعيل واتساب. تأكد من ربط المتجر ونشر السياسة، ثم حاول مرة ثانية.")); }
    finally { setChannelBusy(false); }
  };

  if (loading) return <IntegrationsPageSkeleton />;

  const steps = [
    { key: "store", done: storeConnected, label: t("Store", "المتجر"), icon: <ShoppingBag className="size-3.5" /> },
    { key: "policy", done: policyReady, label: t("Policy", "السياسة"), icon: <FileText className="size-3.5" /> },
    { key: "live", done: storeConnected && Boolean(returnPath), label: t("Return page", "صفحة الإرجاع"), icon: <Link2 className="size-3.5" /> },
    { key: "whatsapp", done: whatsAppConnected, label: t("WhatsApp", "واتساب"), icon: <WhatsAppLogo className="size-3.5" /> },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const currentStep = steps.findIndex((step) => !step.done);
  const next = !storeConnected
    ? { key: "store", title: t("Connect your store", "اربط متجرك"), text: t("Pick your platform below. Reload checks every return against the real order.", "اختر منصتك بالأسفل. يتحقق ريلود من كل إرجاع مقابل الطلب الفعلي."), cta: null }
    : !policyReady
      ? { key: "policy", title: t("Publish your return policy", "انشر سياسة الإرجاع"), text: t("Reload uses it to approve or decline each return.", "يستخدمها ريلود لقبول أو رفض كل طلب إرجاع."), cta: t("Publish policy", "نشر السياسة"), href: "/app/policies" }
      : !whatsAppConnected
        ? { key: "whatsapp", title: t("Returns are live", "الإرجاع مفعّل"), text: t("Share your return page. WhatsApp is next, and the Reload team activates it with you.", "شارك صفحة الإرجاع. واتساب هو التالي ويفعّله فريق ريلود معك."), cta: null }
        : { key: "done", title: t("Everything is connected", "كل شيء مربوط"), text: t("Share your return link with customers.", "شارك رابط الإرجاع مع عملائك."), cta: null };
  // The store that's connected, or one that needs fixing.
  const primary: Platform | null = sallaConnected ? "salla" : zidConnected ? "zid" : toneOf(zid) === "attention" ? "zid" : toneOf(salla) === "attention" ? "salla" : null;
  const platformCopy = {
    salla: { name: t("Salla", "سلة"), tagline: t("Public app setup and review in progress", "إعداد التطبيق العام ومراجعته قيد التنفيذ"), meta: t("Under development", "قيد التطوير") },
    zid: { name: t("Zid", "زد"), tagline: t("Free through Zid's AI Connector", "مجانًا عبر AI Connector من زد"), meta: t("About 2 minutes", "دقيقتان تقريبًا") },
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 pb-6">
      {/* ── Header + progress ── */}
      <section>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={TWEEN}>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]">{t("Integrations", "التكاملات")}</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">{t("Connect your store once. Every return is checked against the real order, and customers start returns from one link.", "اربط متجرك مرة واحدة. يُتحقق من كل إرجاع مقابل الطلب الفعلي، ويبدأ العملاء الإرجاع من رابط واحد.")}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.06 }}
          className="mt-6 rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-4 p-4 sm:p-5">
            <ProgressRing done={doneCount} total={steps.length} label={t(`${doneCount} of ${steps.length} ready`, `${doneCount} من ${steps.length} جاهزة`)} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={next.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={QUICK}
                className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{next.key === "done" || next.key === "whatsapp" ? t("Status", "الحالة") : t("Next step", "الخطوة التالية")}</p>
                  <p className="mt-0.5 text-[15px] font-semibold tracking-tight">{next.title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{next.text}</p>
                </div>
                {next.cta && next.href && <Button asChild size="sm" className="shrink-0 self-start rounded-xl sm:self-auto"><Link href={next.href}>{next.cta}<ArrowRight className="size-3.5 rtl:-scale-x-100" /></Link></Button>}
              </motion.div>
            </AnimatePresence>
          </div>
          <ol className="flex flex-wrap gap-1.5 border-t border-border px-4 py-3 sm:gap-2 sm:px-5">
            {steps.map((step, index) => {
              const current = index === currentStep;
              return (
                <motion.li key={step.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ ...QUICK, delay: 0.15 + index * 0.06 }}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-300",
                    step.done ? "border-eligible/25 bg-eligible-muted text-eligible"
                      : current ? "border-foreground/20 bg-foreground/[.06] text-foreground"
                        : "border-transparent text-muted-foreground")}>
                  {step.done
                    ? <Check className="size-3.5" strokeWidth={2.75} />
                    : current
                      ? <span className="relative grid size-3.5 place-items-center"><span className="absolute size-2 animate-ping rounded-full bg-foreground/40 motion-reduce:hidden" /><span className="size-1.5 rounded-full bg-foreground" /></span>
                      : <span className="opacity-60">{step.icon}</span>}
                  {step.label}
                </motion.li>
              );
            })}
          </ol>
        </motion.div>
      </section>

      {/* ── Your store ── */}
      <section id="your-store" className="scroll-mt-20">
        <SectionHeading title={t("Your store", "متجرك")} subtitle={primary ? t("Reload reads order and product details, and can create returns.", "يقرأ ريلود بيانات الطلبات والمنتجات، ويمكنه إنشاء المرتجعات.") : t("Where do you sell? Choose your platform to connect.", "أين تبيع؟ اختر منصتك للربط.")} />
        <div className="mt-4">
          {primary ? (
            <ConnectedStore
              platform={primary} name={platformCopy[primary].name} tone={toneOf(primary === "zid" ? zid : salla)}
              storeName={(primary === "zid" ? zid : salla)?.external_store_name ?? null}
              connectedAt={date((primary === "zid" ? zid : salla)?.connected_at ?? null)}
              lastChecked={date((primary === "zid" ? zid : salla)?.last_synced_at ?? null, true)}
              t={t} onOpen={() => setPanel(primary)} />
          ) : (
            <div className="desk-stagger overflow-hidden rounded-2xl border border-border bg-card">
              {(["zid", "salla"] as const).map((platform) => (
                <PlatformRow key={platform} logo={<PlatformLogo platform={platform} size={44} />} name={platformCopy[platform].name}
                  tagline={platformCopy[platform].tagline} meta={platformCopy[platform].meta} free={platform === "zid"} t={t} onOpen={() => setPanel(platform)} />
              ))}
              <PlatformRow logo={<span className="grid size-11 place-items-center rounded-xl bg-[#95bf47]/15"><ShoppingBag className="size-5 text-[#5e8e3e]" /></span>}
                name="Shopify" tagline={t("We'll let you know when it's ready", "سنبلغك عند التوفر")} soon t={t} />
            </div>
          )}
        </div>
      </section>

      {/* ── Channels ── */}
      <section>
        <SectionHeading title={t("Customer channels", "قنوات العملاء")} subtitle={t("Where customers start a return.", "حيث يبدأ عملاؤك طلب الإرجاع.")} />
        <div className="desk-stagger mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2" style={{ ["--desk-base" as string]: "120ms" }}>
          <ReturnPageCard returnPath={storeConnected ? returnPath : null} t={t} />
          <WhatsAppCard
            onActivate={() => void activateWhatsApp()} busy={channelBusy} canActivate={workspace?.role === "owner" || workspace?.role === "admin"}
            connected={whatsAppConnected} link={whatsAppLink} storeConnected={storeConnected} policyReady={policyReady}
            connectedAt={date(whatsApp?.connected_at ?? null)} lastMessage={date(whatsApp?.last_webhook_at ?? null, true)} t={t} />
        </div>
      <WhatsAppLinkPreview />
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
                  ? <ZidConnectCard onChange={() => void load()} onDone={() => setPanel(null)} />
                  : <SallaPanel connected={sallaConnected} storeId={workspace?.storeId ?? null} t={t} onChange={() => void load()} />}
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

function PlatformLogo({ platform, size }: { platform: Platform; size: number }) {
  return platform === "zid"
    ? <Image src="/zid-logo.png" alt="" width={size} height={size} className="shrink-0 rounded-xl" style={{ width: size, height: size }} />
    : <span className="grid shrink-0 place-items-center rounded-xl bg-[#004d5a]" style={{ width: size, height: size }}><Image src="/salla-logo.png" alt="" width={size * 0.62} height={size * 0.62} className="rounded-md" /></span>;
}

/** One platform in the "choose your platform" list. */
function PlatformRow({ logo, name, tagline, meta, free, soon, t, onOpen }: {
  logo: ReactNode; name: string; tagline: string; meta?: string; free?: boolean; soon?: boolean; t: T; onOpen?: () => void;
}) {
  const content = (
    <>
      {logo}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-display text-[15px] font-semibold">
          {name}
          {free && <span className="rounded-full bg-eligible-muted px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-eligible">{t("Free", "مجاني")}</span>}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:truncate">{tagline}</p>
      </div>
      {soon
        ? <span className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{t("Coming soon", "قريبًا")}</span>
        : <span className="store-tile-cta flex shrink-0 items-center gap-3">
            {meta && <span className="hidden text-xs text-muted-foreground sm:inline">{meta}</span>}
            <span className="inline-flex h-9 items-center gap-1 rounded-xl bg-foreground px-3.5 text-sm font-medium text-background">{t("Connect", "ربط")}<ChevronRight className="size-4 rtl:rotate-180" /></span>
          </span>}
    </>
  );
  const cls = "store-tile flex w-full items-center gap-4 border-b border-border px-4 py-4 text-start last:border-b-0 sm:px-5";
  return soon
    ? <div className={cn(cls, "opacity-60")} aria-disabled="true">{content}</div>
    : <button type="button" onClick={onOpen} className={cn(cls, "hover:bg-muted/40")}>{content}</button>;
}

/** The store that's connected (or needs fixing), shown wide. */
function ConnectedStore({ platform, name, tone, storeName, connectedAt, lastChecked, t, onOpen }: {
  platform: Platform; name: string; tone: Tone; storeName: string | null; connectedAt: string | null; lastChecked: string | null; t: T; onOpen: () => void;
}) {
  const labels = labelsFor(t);
  return (
    <button type="button" onClick={onOpen}
      className={cn("store-tile admin-card admin-lift group flex w-full flex-col gap-4 rounded-2xl border bg-card p-5 text-start sm:flex-row sm:items-center sm:p-6",
        tone === "attention" ? "border-review/40" : "border-eligible/30")}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="relative">
          <PlatformLogo platform={platform} size={52} />
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...QUICK, delay: 0.3 }}
            className={cn("absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full border-2 border-card text-white", tone === "attention" ? "bg-review" : "bg-eligible")}>
            {tone === "attention" ? <AlertTriangle className="size-2.5" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
          </motion.span>
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2"><span className="font-display text-base font-semibold">{name}</span><StatusPill tone={tone} label={labels[tone]} /></p>
          <p className="mt-0.5 truncate text-sm" dir="auto">{storeName ?? t("Your store", "متجرك")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tone === "attention"
              ? t("Reload can't reach your store. Reconnect to keep returns working.", "لا يستطيع ريلود الوصول لمتجرك. أعد الربط ليستمر الإرجاع.")
              : <>{connectedAt && t(`Connected ${connectedAt}`, `تم الربط ${connectedAt}`)}{connectedAt && " · "}{t(`Last checked ${lastChecked ?? "not yet"}`, `آخر تحقق ${lastChecked ?? "لم يتم بعد"}`)}</>}
          </p>
        </div>
      </div>
      <span className={cn("store-tile-cta inline-flex h-9 shrink-0 items-center justify-center gap-1 self-start rounded-xl border px-3.5 text-sm font-medium sm:self-auto",
        tone === "attention" ? "border-review/40 text-review" : "border-border")}>
        {tone === "attention" ? labels.fix : labels.manage}<ChevronRight className="size-4 rtl:rotate-180" />
      </span>
    </button>
  );
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

const SALLA = "#004d5a";

function SallaPanel({ connected, storeId, t, onChange }: { connected: boolean; storeId: string | null; t: T; onChange: () => void }) {
  const [action, setAction] = useState<"connect" | "test" | "disconnect" | null>(null);
  const [confirm, setConfirm] = useState(false);

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
        <>
          <div className="rounded-2xl border border-border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{t("What Reload can do", "ما يستطيع ريلود فعله")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {[t("Find an order by number, phone or email", "إيجاد الطلب برقمه أو بالجوال أو البريد"), t("Read items, prices, status and delivery date", "قراءة المنتجات والأسعار والحالة وتاريخ التوصيل")].map((line) => (
                <li key={line} className="flex items-center gap-2.5"><Check className="size-4 shrink-0 text-eligible" />{line}</li>
              ))}
              <li className="flex items-center gap-2.5 text-muted-foreground"><span className="grid size-4 shrink-0 place-items-center text-xs">✕</span>{t("Never edits orders, products, coupons or settings", "لا يعدّل الطلبات أو المنتجات أو الكوبونات أو الإعدادات")}</li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => void run("test")} disabled={action !== null}>{action === "test" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{t("Check connection", "فحص الربط")}</Button>
            <Button variant="ghost" className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ms-auto" onClick={() => setConfirm(true)} disabled={action !== null}>{action === "disconnect" ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4 rtl:-scale-x-100" />}{t("Disconnect", "فصل الربط")}</Button>
          </div>
        </>
      ) : (
        <ConnectStepper
          current={0} busy={action === "connect"} accent={SALLA}
          steps={[
            {
              title: t("Approve Reload in Salla", "وافق على ريلود في سلة"),
              content: (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-muted-foreground">{t("We’re preparing Reload’s public Salla app. New connections will open after testing and Salla approval.", "نعمل على تجهيز تطبيق ريلود العام في سلة. سيتاح الربط بعد الاختبار وموافقة سلة.")}</p>
                  <Button className="h-11 w-full rounded-xl transition-transform active:scale-[.99]" disabled>
                    {action === "connect" ? <><Loader2 className="size-4 animate-spin" />{t("Opening Salla…", "جارٍ فتح سلة…")}</> : <>{t("Under development", "قيد التطوير")}<ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></>}
                  </Button>
                </div>
              ),
            },
            { title: t("Come back connected", "عُد وقد تم الربط") },
            { title: t("Customers can start returns", "يبدأ العملاء طلبات الإرجاع") },
          ]}
        />
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-[#004d5a] dark:text-[#5ec6c6]" />{t("Encrypted access", "وصول مشفّر")}</span>
        <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5 text-[#004d5a] dark:text-[#5ec6c6]" />{t("Orders read only", "قراءة الطلبات فقط")}</span>
        <span className="inline-flex items-center gap-1.5"><Unplug className="size-3.5 text-[#004d5a] dark:text-[#5ec6c6]" />{t("Disconnect anytime", "فصل في أي وقت")}</span>
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

function ChannelCard({ icon, iconBg, title, tone, toneLabel, locked, children }: { icon: ReactNode; iconBg: string; title: string; tone: Tone; toneLabel: string; locked?: boolean; children: ReactNode }) {
  return (
    <div className={cn("admin-card flex min-w-0 flex-col rounded-2xl border bg-card p-5 sm:p-6", locked ? "border-dashed border-border" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid size-11 place-items-center rounded-xl transition-[filter,opacity] duration-300", iconBg, locked && "opacity-60 grayscale")}>{icon}</span>
        {locked
          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"><Lock className="size-3" />{toneLabel}</span>
          : <StatusPill tone={tone} label={toneLabel} />}
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
      tone={returnPath ? "connected" : "idle"} toneLabel={returnPath ? t("Live", "مفعّلة") : t("Locked", "مقفلة")} locked={!returnPath}>
      <p className="text-sm leading-6 text-muted-foreground">{returnPath
        ? t("Customers enter their order number and the phone or email on the order. Reload checks it against your store.", "يدخل العميل رقم طلبه والجوال أو البريد المسجل. يتحقق ريلود منه مقابل متجرك.")
        : t("One link and a QR code for your customers. It goes live as soon as your store is connected.", "رابط واحد ورمز QR لعملائك. يُفعّل فور ربط متجرك.")}</p>
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

function WhatsAppCard({ onActivate, busy, canActivate, connected, link, storeConnected, policyReady, connectedAt, lastMessage, t }: {
  onActivate: () => void; busy: boolean; canActivate: boolean; connected: boolean; link: string | null; storeConnected: boolean; policyReady: boolean; connectedAt: string | null; lastMessage: string | null; t: T;
}) {
  const qr = useMemo(() => link ? createBrandQr(link) : null, [link]);
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast.success(t("Customer WhatsApp link copied.", "تم نسخ رابط واتساب للعملاء.")); }
    catch { toast.error(t("Could not copy the link. Please try again.", "تعذّر نسخ الرابط. حاول مرة أخرى.")); }
  };
  return (
    <ChannelCard icon={<WhatsAppLogo className="size-6" />} iconBg="bg-[#25D366]/12 text-[#128C7E] dark:text-[#25D366]" title="WhatsApp"
      tone={connected ? "connected" : "idle"} toneLabel={connected ? t("Connected", "متصل") : storeConnected ? t("Awaiting activation", "بانتظار التفعيل") : t("Locked", "مقفلة")} locked={!connected && !storeConnected}>
      <p className="text-sm leading-6 text-muted-foreground">{connected
        ? t("Customers start a return in WhatsApp. Their requests and photos appear in your return cases.", "يبدأ عملاؤك الإرجاع من واتساب، وتظهر طلباتهم وصورهم ضمن حالات الإرجاع.")
        : t("Activate the shared Reload number for your store. Your unique link tells us which store the customer is contacting.", "فعّل رقم ريلود الموحد لمتجرك. رابطك الخاص يحدد لنا المتجر الذي يتواصل معه العميل.")}</p>
      {connected ? (
        <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
          <p className="text-xs text-muted-foreground">{connectedAt && t(`Connected ${connectedAt}`, `تم الربط ${connectedAt}`)}{connectedAt && " · "}{t(`Last message ${lastMessage ?? "not yet"}`, `آخر رسالة ${lastMessage ?? "لم تصل بعد"}`)}</p>
          {link ? <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void copy()}><Copy className="size-4" />{t("Copy WhatsApp link", "نسخ رابط واتساب")}</Button>
            {qr && <Popover><PopoverTrigger asChild><Button size="sm" variant="outline" className="rounded-xl"><QrCode className="size-4" />{t("QR code", "رمز QR")}</Button></PopoverTrigger><PopoverContent align="start" className="w-64 rounded-2xl p-4"><div className="qr-preview overflow-hidden rounded-xl bg-[#f8f7f4] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr.svg("ink") }} /><p className="mt-3 text-xs leading-5 text-muted-foreground">{t("Customers scan this to open your store’s return chat. They must send the prefilled message to begin.", "يمسح العميل الرمز لفتح محادثة الإرجاع الخاصة بمتجرك، ثم يرسل الرسالة الجاهزة للبدء.")}</p></PopoverContent></Popover>}
            <Button size="sm" variant="ghost" className="rounded-xl" asChild><a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{t("Open chat", "فتح المحادثة")}</a></Button>
          </div> : <p className="flex items-center gap-1.5 text-xs text-review"><AlertTriangle className="size-3.5" />{t("Active, but its number is unavailable. Contact Reload before sharing.", "مفعّلة لكن رقمها غير متوفر. تواصل مع ريلود قبل المشاركة.")}</p>}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
          {storeConnected && policyReady && canActivate && <Button size="sm" className="self-start rounded-xl" disabled={busy} onClick={onActivate}>{busy && <Loader2 className="size-4 animate-spin" />}{t("Activate WhatsApp", "تفعيل واتساب")}</Button>}
          <p className="text-xs text-muted-foreground">
          {!storeConnected ? t("Unlocks after you connect your store.", "يُفتح بعد ربط متجرك.") : !policyReady ? t("Next: publish your return policy.", "التالي: انشر سياسة الإرجاع.") : t("Share this store’s link, rather than just the number, so customers reach the right store.", "شارك رابط المتجر ليصل العملاء إلى المتجر الصحيح.")}
        </p></div>
      )}
    </ChannelCard>
  );
}
