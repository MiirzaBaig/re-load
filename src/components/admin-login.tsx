"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { ReloadLogo } from "@/components/reload-logo";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const ADMIN_EMAIL = "admin@reload.sa";

export function AdminLogin() {
  const router = useRouter();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"login" | "link" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) return setError(t("Sign-in is unavailable right now.", "تسجيل الدخول غير متاح حاليًا."));
    setBusy("login"); setError("");
    const { error: loginError } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
    setBusy(null);
    if (loginError) return setError(t("That password didn't work. You can request a secure setup link below.", "كلمة المرور غير صحيحة. يمكنك طلب رابط آمن لإعدادها أدناه."));
    router.replace("/admin"); router.refresh();
  };

  const sendLink = async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return setError(t("Sign-in is unavailable right now.", "تسجيل الدخول غير متاح حاليًا."));
    setBusy("link"); setError("");
    const { error: linkError } = await client.auth.signInWithOtp({ email: ADMIN_EMAIL, options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fadmin%2Fsetup`,
      shouldCreateUser: true,
      data: { store_name: "Reload Team" },
    } });
    setBusy(null);
    if (linkError) return setError(t("We couldn't send the link yet. Try again shortly.", "تعذّر إرسال الرابط حاليًا. حاول بعد قليل."));
    setSent(true);
  };

  return <main className="grid min-h-svh place-items-center bg-background px-5 py-12"><div className="w-full max-w-md"><div className="mb-7 flex items-center justify-between"><ReloadLogo /><div className="flex gap-1"><LanguageToggle compact /><ModeToggle /></div></div><div className="rounded-2xl border border-border bg-card p-7 shadow-[0_24px_70px_-45px_rgba(15,15,18,.35)] sm:p-9"><span className="grid size-11 place-items-center rounded-xl bg-muted"><KeyRound className="size-5" /></span><h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("Team sign in", "دخول الفريق")}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Your private workspace for merchant follow-ups and product activity.", "مساحتك الخاصة لمتابعة التجار ونشاط المنتج.")}</p><form className="mt-7 space-y-4" onSubmit={(event) => void signIn(event)}><label className="block text-sm font-medium">{t("Email", "البريد الإلكتروني")}<Input className="mt-2" value={ADMIN_EMAIL} readOnly dir="ltr" autoComplete="username" /></label><label className="block text-sm font-medium">{t("Password", "كلمة المرور")}<Input className="mt-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={!!busy}>{busy === "login" ? <Loader2 className="size-4 animate-spin" /> : null}{t("Open team desk", "افتح مساحة الفريق")}<ArrowRight className="size-4 rtl:rotate-180" /></Button></form><div className="mt-7 border-t border-border pt-5"><button type="button" onClick={() => void sendLink()} disabled={!!busy || sent} className="text-sm font-medium underline-offset-4 transition-colors hover:text-[var(--brand-accent)] hover:underline disabled:opacity-60">{sent ? t("Check admin@reload.sa for your link", "تحقق من بريد admin@reload.sa") : t("First time or forgot your password? Send a setup link", "أول مرة أو نسيت كلمة المرور؟ أرسل رابط الإعداد")}</button><p className="mt-2 text-xs leading-5 text-muted-foreground">{t("The link goes only to the team email. Two-factor verification is still required after sign-in.", "يُرسل الرابط إلى بريد الفريق فقط. وسيُطلب التحقق بخطوتين بعد الدخول.")}</p></div></div></div></main>;
}
