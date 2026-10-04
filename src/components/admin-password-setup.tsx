"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { ReloadLogo } from "@/components/reload-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminPasswordSetup() {
  const router = useRouter();
  const { t } = useLanguage();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => {
      if (data.user?.email?.toLowerCase() === "admin@reload.sa") setReady(true);
      else router.replace("/admin/login");
    });
  }, [router]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 12 || password !== confirm) { setError(t("Use at least 12 characters and make sure both passwords match.", "استخدم 12 حرفًا على الأقل وتأكد من تطابق كلمتي المرور.")); return; }
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true); setError("");
    const { error: updateError } = await client.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(t("We couldn't save the password. Please try again.", "تعذّر حفظ كلمة المرور. حاول مرة أخرى."));
    router.replace("/admin"); router.refresh();
  };

  return <main className="grid min-h-svh place-items-center bg-background px-5 py-12"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-[0_24px_70px_-45px_rgba(15,15,18,.35)] sm:p-9"><ReloadLogo className="mb-10" /><span className="grid size-11 place-items-center rounded-xl bg-muted"><KeyRound className="size-5" /></span><h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("Set your team password", "أنشئ كلمة مرور الفريق")}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Choose a password for admin@reload.sa. You can return here with a secure email link whenever you need to change it.", "اختر كلمة مرور لحساب admin@reload.sa. يمكنك العودة إلى هنا عبر رابط آمن من البريد لتغييرها لاحقًا.")}</p>{ready ? <form onSubmit={(event) => void save(event)} className="mt-7 space-y-4"><label className="block text-sm font-medium">{t("New password", "كلمة المرور الجديدة")}<Input className="mt-2" type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></label><label className="block text-sm font-medium">{t("Confirm password", "تأكيد كلمة المرور")}<Input className="mt-2" type="password" minLength={12} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{t("Save password", "حفظ كلمة المرور")}</Button></form> : <p className="mt-7 text-sm text-muted-foreground">{t("Checking your secure link…", "جارٍ التحقق من الرابط الآمن…")}</p>}</div></main>;
}
