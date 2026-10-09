"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Copy, ExternalLink, Link2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { IntegrationsPageSkeleton } from "@/components/merchant-skeletons";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/components/language-provider";
import { formatDateString, formatDateTimeString } from "@/lib/numerals";
import { WhatsAppLogo } from "@/components/phone-frame";
import { getWhatsAppStartUrl } from "@/lib/whatsapp";
import { ZidConnectCard } from "@/components/zid-connect-card";

interface SallaConnection {
  external_store_name: string | null;
  status: "CONNECTING" | "CONNECTED" | "EXPIRED" | "REVOKED" | "ERROR";
  connected_at: string | null;
  last_synced_at: string | null;
}

interface WhatsAppConnection {
  status: "CONNECTING" | "CONNECTED" | "RESTRICTED" | "DISCONNECTED" | "ERROR";
  display_phone_number: string | null;
  connected_at: string | null;
  last_webhook_at: string | null;
}

export function IntegrationsPage() {
  const { user, workspace } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<SallaConnection | null>(null);
  const [whatsApp, setWhatsApp] = useState<WhatsAppConnection | null>(null);
  const [policyReady, setPolicyReady] = useState(false);
  const [zidConnected, setZidConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"connect" | "test" | "disconnect" | null>(null);
  const [returnCode, setReturnCode] = useState<string | null>(null);

  const loadConnection = useCallback(async () => {
    if (!supabase || !workspace) return setLoading(false);
    const [commerceResult, whatsAppResult, policyResult] = await Promise.all([
      supabase.from("commerce_connections").select("external_store_name, status, connected_at, last_synced_at")
        .eq("store_id", workspace.storeId).eq("platform", "salla").maybeSingle(),
      supabase.from("whatsapp_connections").select("status, display_phone_number, connected_at, last_webhook_at")
        .eq("store_id", workspace.storeId).maybeSingle(),
      supabase.from("policy_versions").select("id").eq("store_id", workspace.storeId).limit(1).maybeSingle(),
    ]);
    const { data, error } = commerceResult;
    if (error) toast.error(t("Could not load the Salla connection.", "تعذّر تحميل ربط سلة."));
    setConnection(data as SallaConnection | null);
    if (whatsAppResult.error) toast.error(t("Could not load the WhatsApp channel.", "تعذّر تحميل قناة واتساب."));
    setWhatsApp(whatsAppResult.data as WhatsAppConnection | null);
    setPolicyReady(Boolean(policyResult.data));
    const { data: zid } = await supabase.from("commerce_connections").select("status")
      .eq("store_id", workspace.storeId).eq("platform", "zid").maybeSingle();
    setZidConnected(zid?.status === "CONNECTED");
    const { data: store } = await supabase.from("stores").select("return_code").eq("id", workspace.storeId).maybeSingle();
    setReturnCode(typeof store?.return_code === "string" ? store.return_code : null);
    setLoading(false);
  }, [workspace]);

  useEffect(() => { void loadConnection(); }, [loadConnection]);
  useEffect(() => {
    const result = searchParams.get("salla");
    if (!result) return;
    if (result === "connected") toast.success(t("Salla store connected successfully.", "تم ربط متجر سلة بنجاح."));
    else if (result === "cancelled") toast.info(t("Salla connection was cancelled.", "تم إلغاء ربط سلة."));
    else toast.error(t("Salla could not be connected. Please try again.", "تعذّر ربط سلة. يرجى المحاولة مرة أخرى."));
    router.replace("/app/integrations");
    void loadConnection();
  }, [loadConnection, router, searchParams, t]);

  const connect = async () => {
    if (!supabase || !user) {
      toast.error(t("Sign in before connecting a store.", "سجّل الدخول قبل ربط المتجر."));
      return;
    }
    if (!workspace) {
      toast.error(t("No store workspace is linked to this account.", "لا توجد مساحة عمل لمتجر مرتبطة بهذا الحساب."));
      return;
    }
    setAction("connect");
    const { data, error } = await supabase.functions.invoke("salla-oauth-start", {
      body: {
        storeId: workspace.storeId,
        redirectPath: "/app/integrations",
      },
    });
    if (error || !data?.authorizationUrl) {
      toast.error(t("Could not start Salla authorization.", "تعذّر بدء عملية التفويض مع سلة."));
      setAction(null);
      return;
    }
    window.location.assign(data.authorizationUrl);
  };

  const runAction = async (nextAction: "test" | "disconnect") => {
    if (!supabase || !workspace) return;
    setAction(nextAction);
    const { error } = await supabase.functions.invoke("salla-connection", {
      body: { storeId: workspace.storeId, action: nextAction },
    });
    if (error) toast.error(nextAction === "test" ? t("Salla did not accept the stored connection.", "لم تقبل سلة بيانات الربط المحفوظة.") : t("Could not disconnect Salla.", "تعذّر فصل الربط مع سلة."));
    else toast.success(nextAction === "test" ? t("Salla connection is healthy.", "الربط مع سلة يعمل بشكل سليم.") : t("Salla credentials removed from Reload.", "تم حذف بيانات سلة من ريلود."));
    await loadConnection();
    setAction(null);
  };

  const connected = connection?.status === "CONNECTED";
  const whatsAppConnected = whatsApp?.status === "CONNECTED";
  const returnPath = returnCode ? `/return?store=${encodeURIComponent(returnCode)}` : null;
  const whatsAppNumber = whatsApp?.display_phone_number?.replace(/\D/g, "") ?? "";
  const whatsAppLink = whatsAppConnected && whatsAppNumber ? getWhatsAppStartUrl(whatsAppNumber) : null;

  const copyReturnLink = async () => {
    if (!returnPath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${returnPath}`);
    toast.success(t("Customer return link copied.", "تم نسخ رابط إرجاع العملاء."));
  };

  const copyWhatsAppLink = async () => {
    if (!whatsAppLink) return;
    try {
      await navigator.clipboard.writeText(whatsAppLink);
      toast.success(t("Customer WhatsApp link copied.", "تم نسخ رابط واتساب للعملاء."));
    } catch {
      toast.error(t("Could not copy the link. Please try again.", "تعذّر نسخ الرابط. حاول مرة أخرى."));
    }
  };

  if (loading) {
    return <IntegrationsPageSkeleton />;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 animate-fade-in">
      <ScrollReveal>
        <div>
          <Badge variant="outline" className="mb-3">{t("Commerce", "التجارة الإلكترونية")}</Badge>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t("Store integrations", "تكاملات المتجر")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("Connect your Salla or Zid store so Reload can verify orders against real merchant data.", "اربط متجرك في سلة أو زد ليتمكن ريلود من التحقق من الطلبات ببيانات متجرك الفعلية.")}</p>
        </div>
      </ScrollReveal>
      <ScrollReveal delay={80}>
        <Card className="overflow-hidden rounded-3xl border-border/70 shadow-[0_22px_70px_-42px_hsl(var(--foreground)/0.28)]">
          <CardContent className="p-0">
            <div className="flex flex-col gap-7 p-5 sm:p-8">
              {user && !workspace && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">{t("This account has no store workspace. Restore its workspace before connecting Salla.", "لا توجد مساحة عمل لمتجر في هذا الحساب. استعد مساحة العمل قبل ربط سلة.")}</p>}
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-2xl bg-[#004d5a] p-2 shadow-sm"><Image src="/salla-logo.png" alt="" width={44} height={44} className="rounded-xl" /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-semibold">{t("Salla", "سلة")}</h2>
                    {connected ? (
                      <Badge className="border-eligible/20 bg-eligible-muted text-eligible"><Check className="size-3" /> {t("Connected", "متصل")}</Badge>
                    ) : <Badge variant="outline">{t("Not connected", "غير متصل")}</Badge>}
                  </div>
                  <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                    {connected ? t(`Store authorization is active for ${connection.external_store_name ?? "your store"}.`, `تفويض الوصول إلى ${connection.external_store_name ?? "متجرك"} مفعّل.`) : t("Authorize read-only order access through Salla. Reload never receives your merchant password.", "امنح صلاحية قراءة الطلبات فقط عبر سلة. لن يطّلع ريلود على كلمة مرور متجرك إطلاقًا.")}
                  </p>
                  {connected && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{t(
                      `Connected ${connection.connected_at ? formatDateString(connection.connected_at, { year: "numeric", month: "short", day: "numeric" }, locale) : "today"}`,
                      `تم الربط ${connection.connected_at ? formatDateString(connection.connected_at, { year: "numeric", month: "short", day: "numeric" }, locale) : "اليوم"}`,
                    )}</span>
                    <span>{t(
                      `Last checked ${connection.last_synced_at ? formatDateTimeString(connection.last_synced_at, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, locale) : "not yet"}`,
                      `آخر تحقق ${connection.last_synced_at ? formatDateTimeString(connection.last_synced_at, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, locale) : "لم يتم بعد"}`,
                    )}</span>
                  </div>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-5" aria-busy={action !== null}>
                {connected ? <>
                  <Button variant="outline" onClick={() => void runAction("test")} disabled={action !== null}>{action === "test" ? <Spinner /> : <RefreshCw className="size-4" />} {t("Check connection", "فحص الربط")}</Button>
                  <Button variant="ghost" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ms-auto" onClick={() => void runAction("disconnect")} disabled={action !== null}>{action === "disconnect" ? <Spinner /> : <Unplug className="size-4" />} {t("Disconnect", "فصل الربط")}</Button>
                </> : <Button onClick={() => void connect()} disabled={loading || action !== null}>{action === "connect" ? <Spinner /> : <Link2 className="size-4" />} {t("Connect Salla", "ربط سلة")}</Button>}
              </div>
            </div>
            <div className="grid border-t border-border/60 bg-muted/20 sm:grid-cols-3">
              <div className="flex items-center gap-3 p-4 text-sm"><ShieldCheck className="size-4 text-primary" /><span>{t("Encrypted credentials", "بيانات اعتماد مشفّرة")}</span></div>
              <div className="flex items-center gap-3 border-y border-border/60 p-4 text-sm sm:border-x sm:border-y-0"><Link2 className="size-4 text-primary" /><span>{t("Orders read only", "قراءة الطلبات فقط")}</span></div>
              <div className="flex items-center gap-3 p-4 text-sm"><Clock className="size-4 text-primary" /><span>{t("Disconnect anytime", "إمكانية فصل الربط في أي وقت")}</span></div>
            </div>
            {connected && returnPath && <div className="border-t border-border/60 p-5 sm:p-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-semibold">{t("Customer return page", "صفحة إرجاع العملاء")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Customers can use their order number and the email or mobile saved on the order.", "يقدر العميل يستخدم رقم طلبه والبريد أو الجوال المسجل فيه.")}</p></div>
                <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void copyReturnLink()}><Copy className="size-4" />{t("Copy link", "نسخ الرابط")}</Button><Button size="sm" asChild><a href={returnPath} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />{t("Open page", "فتح الصفحة")}</a></Button></div>
              </div>
            </div>}
          </CardContent>
        </Card>
      </ScrollReveal>
      <ScrollReveal delay={100}>
        <ZidConnectCard onChange={() => void loadConnection()} />
      </ScrollReveal>
      <ScrollReveal delay={120}>
        <Card className="overflow-hidden rounded-3xl border-border/70 shadow-[0_22px_70px_-42px_hsl(var(--foreground)/0.22)]">
          <CardContent className="p-0">
            <div className="flex flex-col gap-7 p-5 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="grid size-[60px] shrink-0 place-items-center rounded-2xl bg-[#25D366]/12 text-[#128C7E] dark:text-[#25D366]">
                  <WhatsAppLogo className="size-8" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-semibold">WhatsApp</h2>
                    {whatsAppConnected
                      ? <Badge className="border-eligible/20 bg-eligible-muted text-eligible"><Check className="size-3" /> {t("Connected", "متصل")}</Badge>
                      : <Badge variant="outline">{t("Awaiting activation", "بانتظار التفعيل")}</Badge>}
                  </div>
                  <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                    {whatsAppConnected
                      ? t("Customers can start a return directly in WhatsApp. Their requests and photos appear in your return cases.", "يقدر عملاؤك يبدؤون طلب الإرجاع من واتساب مباشرة، وتظهر طلباتهم وصورهم ضمن حالات الإرجاع هنا.")
                      : t("Once your store is connected and its return policy is published, the Reload team can activate this channel with you.", "بعد ربط متجرك ونشر سياسة الإرجاع، يفعّل فريق ريلود هذه القناة معك.")}
                  </p>
                  {!whatsAppConnected && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-3 py-1.5 ${connected || zidConnected ? "bg-eligible-muted text-eligible" : "bg-muted text-muted-foreground"}`}>{connected || zidConnected ? "✓ " : "1 · "}{t("Store connected", "ربط المتجر")}</span>
                    <span className={`rounded-full px-3 py-1.5 ${policyReady ? "bg-eligible-muted text-eligible" : "bg-muted text-muted-foreground"}`}>{policyReady ? "✓ " : "2 · "}{t("Policy published", "نشر السياسة")}</span>
                    <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">3 · {t("Channel activation", "تفعيل القناة")}</span>
                  </div>}
                  {whatsAppConnected && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{t(
                      `Connected ${whatsApp?.connected_at ? formatDateString(whatsApp.connected_at, { year: "numeric", month: "short", day: "numeric" }, locale) : "today"}`,
                      `تم الربط ${whatsApp?.connected_at ? formatDateString(whatsApp.connected_at, { year: "numeric", month: "short", day: "numeric" }, locale) : "اليوم"}`,
                    )}</span>
                    <span>{t(
                      `Last message ${whatsApp?.last_webhook_at ? formatDateTimeString(whatsApp.last_webhook_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, locale) : "not yet"}`,
                      `آخر رسالة ${whatsApp?.last_webhook_at ? formatDateTimeString(whatsApp.last_webhook_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, locale) : "لم تصل بعد"}`,
                    )}</span>
                  </div>}
                </div>
              </div>
              <div className="border-t border-border/60 pt-5">
                {whatsAppConnected ? <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
                  <p className="text-sm font-semibold text-foreground">{t("Your customer return link", "رابط إرجاع العملاء")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Share this link with customers from this store. They’ll verify their order in the chat before submitting a return.", "شارك هذا الرابط مع عملاء متجرك. يتحقق ريلود من طلبهم داخل المحادثة قبل تقديم طلب الإرجاع.")}</p>
                  {whatsAppLink ? <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void copyWhatsAppLink()}><Copy className="size-4" />{t("Copy WhatsApp link", "نسخ رابط واتساب")}</Button>
                    <Button variant="ghost" size="sm" asChild><a href={whatsAppLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{t("Open chat", "فتح المحادثة")}</a></Button>
                  </div> : <p className="mt-3 text-xs text-muted-foreground">{t("The channel is active, but its phone number is unavailable. Contact Reload before sharing a link.", "القناة مفعّلة لكن رقمها غير متوفر. تواصل مع ريلود قبل مشاركة الرابط.")}</p>}
                </div> : <p className="text-sm text-muted-foreground">{t("WhatsApp will appear here after activation. Your store and policy remain available in this workspace.", "سيظهر رابط واتساب هنا بعد التفعيل. متجرك وسياسته متاحان في مساحة العمل.")}</p>}
              </div>
            </div>
            <div className="grid border-t border-border/60 bg-muted/20 sm:grid-cols-3">
              <div className="flex items-center gap-3 p-4 text-sm"><ShieldCheck className="size-4 text-[#128C7E] dark:text-[#25D366]" /><span>{t("Signed webhooks", "خطافات موقّعة")}</span></div>
              <div className="flex items-center gap-3 border-y border-border/60 p-4 text-sm sm:border-x sm:border-y-0"><Clock className="size-4 text-[#128C7E] dark:text-[#25D366]" /><span>{t("24-hour service window", "نافذة خدمة 24 ساعة")}</span></div>
              <div className="flex items-center gap-3 p-4 text-sm"><Link2 className="size-4 text-[#128C7E] dark:text-[#25D366]" /><span>{t("Salla-aware returns", "إرجاع مرتبط بسلة")}</span></div>
            </div>
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  );
}
