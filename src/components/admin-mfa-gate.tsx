"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { ReloadLogo } from "@/components/reload-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";

export function AdminMfaGate() {
  const router = useRouter();
  const { t } = useLanguage();
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.auth.mfa.listFactors().then(({ data, error: loadError }: { data: { totp: { id: string; status: string }[] } | null; error: { message: string } | null }) => {
      if (loadError) setError(loadError.message);
      else setFactorId(data?.totp.find((factor: { id: string; status: string }) => factor.status === "verified")?.id ?? "");
    });
  }, []);

  const enroll = async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true); setError("");
    const { data, error: enrollError } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Reload admin" });
    if (enrollError) setError(enrollError.message);
    else if (data) { setFactorId(data.id); setQrCode(data.totp.qr_code); }
    setBusy(false);
  };

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || !factorId) return;
    setBusy(true); setError("");
    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) { setError(challengeError?.message ?? "Could not start verification."); setBusy(false); return; }
    const { error: verifyError } = await client.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (verifyError) { setError(verifyError.message); setBusy(false); return; }
    router.refresh();
  };

  return <main className="grid min-h-svh place-items-center bg-background px-5 py-12">
    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-[0_24px_70px_-45px_rgba(15,15,18,.35)] sm:p-9">
      <ReloadLogo className="mb-10" />
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent"><ShieldCheck className="size-5" /></span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("One more step for the team desk", "خطوة أخيرة لمساحة الفريق")}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Use your authenticator app to protect merchant and customer information.", "استخدم تطبيق المصادقة لحماية بيانات التجار والعملاء.")}</p>
      {!factorId && <Button className="mt-7 w-full" onClick={() => void enroll()} disabled={busy}><KeyRound className="size-4" />{t("Set up authenticator", "إعداد تطبيق المصادقة")}</Button>}
      {qrCode && <div className="mt-6 rounded-2xl border border-border p-5 text-center"><p className="mb-4 text-sm text-muted-foreground">{t("Scan this code in your authenticator app", "امسح الرمز بتطبيق المصادقة")}</p><img className="mx-auto size-44 rounded-lg bg-white p-2" src={qrCode} alt={t("Authenticator QR code", "رمز إعداد المصادقة")} /></div>}
      {factorId && <form onSubmit={(event) => void verify(event)} className="mt-6 space-y-3"><label htmlFor="admin-mfa-code" className="text-sm font-medium">{t("Six-digit code", "رمز من ستة أرقام")}</label><Input id="admin-mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /><Button className="w-full" disabled={busy || code.length !== 6}>{t("Open team desk", "افتح مساحة الفريق")}</Button></form>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  </main>;
}
