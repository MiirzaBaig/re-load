"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { supabase } from "@/lib/supabase";

type Attempt = { code: string; expiresAt: string; installationUrl: string };

export function SallaEasyConnect({ storeId, onChange }: { storeId: string | null; onChange: () => void }) {
  const { t } = useLanguage();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);
  const scope = useRef(storeId);
  const mounted = useRef(true);
  const lock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    scope.current = storeId; setAttempt(null); setError(""); setCopied(false); setExpired(false);
  }, [storeId]);
  useEffect(() => {
    if (!attempt) return;
    const check = () => setExpired(Date.parse(attempt.expiresAt) <= Date.now());
    check(); const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [attempt]);

  async function start() {
    if (!storeId || !supabase || lock.current) return;
    const current = storeId; lock.current = true; setBusy(true); setError("");
    try {
      const { data, error: failure } = await supabase.functions.invoke("salla-oauth-start", { body: { storeId: current } });
      if (!mounted.current || scope.current !== current) return;
      if (failure || data?.mode !== "easy") {
        setError(t("Salla setup is not available for this workspace yet. Your current store connection has not changed.", "ربط سلة غير متاح لهذه المساحة بعد. لم يتغير ربط متجرك الحالي."));
        return;
      }
      const link = new URL(data.installationUrl);
      if (link.origin !== "https://s.salla.sa" || !/^\/apps\/install\/\d+$/.test(link.pathname) ||
        !/^RL-S-[A-F0-9]{32}$/.test(data.code) || !Number.isFinite(Date.parse(data.expiresAt))) throw Error("invalid_response");
      setAttempt({ code: data.code, expiresAt: data.expiresAt, installationUrl: link.href });
      setCopied(false); setExpired(Date.parse(data.expiresAt) <= Date.now());
    } catch {
      if (mounted.current && scope.current === current)
        setError(t("We couldn’t start the connection. Please try again.", "تعذّر بدء الربط. حاول مرة أخرى."));
    } finally {
      lock.current = false;
      if (mounted.current && scope.current === current) setBusy(false);
    }
  }
  async function copy() {
    if (!attempt || expired) return;
    try { await navigator.clipboard.writeText(attempt.code); setCopied(true); }
    catch { setError(t("Copy the code below manually, then paste it in Salla.", "انسخ الرمز أدناه يدويًا، ثم الصقه في سلة.")); }
  }
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">{t("Connect your Salla store", "اربط متجرك في سلة")}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Use a one-time code to link your Salla store to this Reload workspace. You’ll approve access in Salla.", "استخدم رمزًا لمرة واحدة لربط متجرك بمساحة ريلود هذه. ستوافق على الوصول من داخل سلة.")}</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-6 text-foreground">{error}</p>}
      {!attempt ? (
        <Button className="h-11 w-full rounded-xl" disabled={busy || !storeId} onClick={() => void start()}>
          {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          {busy ? t("Preparing your connection…", "جارٍ تجهيز الربط…") : t("Get connection code", "الحصول على رمز الربط")}
        </Button>
      ) : (
        <ol className="space-y-5 text-sm">
          <li className="space-y-2">
            <p className="font-medium">{t("1. Copy your connection code", "١. انسخ رمز الربط")}</p>
            <div className="rounded-xl border bg-muted/40 p-3">
              <code dir="ltr" className="block select-all break-all text-center text-xs leading-6">{attempt.code}</code>
              <Button variant="outline" className="mt-2 w-full rounded-lg" disabled={expired} onClick={() => void copy()}>
                <Copy className="size-4" />{copied ? t("Copied", "تم النسخ") : t("Copy code", "نسخ الرمز")}
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground" role="status">{expired ? t("This code has expired. Get a new code below.", "انتهت صلاحية الرمز. احصل على رمز جديد أدناه.") : t("Valid for 30 minutes. Keep it private.", "صالح لمدة ٣٠ دقيقة. احتفظ به لنفسك.")}</p>
          </li>
          <li className="space-y-2">
            <p className="font-medium">{t("2. Open Reload in Salla", "٢. افتح ريلود في سلة")}</p>
            <p className="leading-6 text-muted-foreground">{t("Install or open the app, approve access, then paste this code into “Reload connection code” in the app settings and save.", "ثبّت التطبيق أو افتحه، ووافق على الوصول، ثم الصق الرمز في حقل «رمز ربط ريلود» ضمن إعدادات التطبيق واحفظه.")}</p>
            {!expired && <Button asChild variant="outline" className="rounded-xl"><a href={attempt.installationUrl} target="_blank" rel="noopener noreferrer">{t("Open Salla", "فتح سلة")}<ExternalLink className="size-4" /></a></Button>}
          </li>
          <li className="space-y-2">
            <p className="font-medium">{t("3. Come back and check", "٣. ارجع وتحقق من الربط")}</p>
            <p className="leading-6 text-muted-foreground">{t("Your store appears here once Salla confirms the connection. If it hasn’t appeared yet, save the code in Salla and check again.", "سيظهر متجرك هنا بعد تأكيد سلة للربط. إذا لم يظهر بعد، احفظ الرمز في سلة وتحقق مرة أخرى.")}</p>
            <Button variant="outline" className="rounded-xl" onClick={onChange}><RefreshCw className="size-4" />{t("Check connection", "التحقق من الربط")}</Button>
          </li>
          <li><Button variant="ghost" className="rounded-xl" disabled={busy} onClick={() => void start()}>{busy ? t("Preparing…", "جارٍ التجهيز…") : t("Get a new code", "الحصول على رمز جديد")}</Button></li>
        </ol>
      )}
    </div>
  );
}
