"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { ADMIN_WELCOME_KEY } from "@/components/admin/welcome-script";
import { QUICK } from "@/components/desk/primitives";
import { ReloadLogo } from "@/components/reload-logo";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/*
 * Team sign-in: personal accounts, no authenticator app. Google in one click,
 * or an email link / code. Access is still invite-only: an owner adds the
 * email in Team, and the desk grants access on first sign-in.
 * The shared password stays available (tucked away) while the team moves over.
 */

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
const SHARED_EMAIL = "admin@reload.sa";
const CALLBACK = "/auth/callback?next=%2Fadmin";

type Step = "choose" | "code" | "password";

export function AdminLogin() {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | "code" | "password" | null>(null);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => { if (step === "code") window.setTimeout(() => codeRef.current?.focus(), 250); }, [step]);

  const markWelcome = () => { try { sessionStorage.setItem(ADMIN_WELCOME_KEY, "1"); } catch { /* no welcome */ } };
  // A full load, so the welcome's pre-paint check runs before the desk draws.
  const enterDesk = () => { markWelcome(); window.location.replace("/admin"); };

  const google = async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return setError(t("Sign-in is unavailable right now.", "تسجيل الدخول غير متاح حاليًا."));
    setBusy("google"); setError("");
    markWelcome();
    const { error: oauthError } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}${CALLBACK}` } });
    if (oauthError) { setBusy(null); setError(t("Google sign-in didn't start. Try again, or use your email.", "تعذّر بدء الدخول عبر Google. حاول مجددًا أو استخدم بريدك.")); }
  };

  const sendEmail = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError(t("Enter your work email.", "أدخل بريدك الإلكتروني."));
    const client = getSupabaseBrowserClient();
    if (!client) return setError(t("Sign-in is unavailable right now.", "تسجيل الدخول غير متاح حاليًا."));
    setBusy("email"); setError("");
    const { error: otpError } = await client.auth.signInWithOtp({ email: address, options: { emailRedirectTo: `${window.location.origin}${CALLBACK}`, shouldCreateUser: true } });
    setBusy(null);
    if (otpError) return setError(/rate|seconds|many/i.test(otpError.message)
      ? t("Too many emails just now. Wait a minute and try again.", "طلبات كثيرة الآن. انتظر دقيقة وحاول مجددًا.")
      : t("We couldn't send the email. Try again shortly.", "تعذّر إرسال البريد. حاول بعد قليل."));
    setCooldown(60);
    setStep("code");
  };

  const verify = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy("code"); setError("");
    const { error: verifyError } = await client.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "email" });
    if (verifyError) { setBusy(null); return setError(t("That code didn't work. Check the latest email, or use its link.", "الرمز غير صحيح. تحقق من أحدث بريد أو استخدم الرابط.")); }
    enterDesk();
  };

  const signInWithPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy("password"); setError("");
    const { error: loginError } = await client.auth.signInWithPassword({ email: SHARED_EMAIL, password });
    if (loginError) { setBusy(null); return setError(t("That password didn't work.", "كلمة المرور غير صحيحة.")); }
    enterDesk();
  };

  const go = (next: Step) => { setError(""); setStep(next); };

  return <main className="grid min-h-svh place-items-center bg-background px-5 py-12">
    <div className="w-full max-w-md">
      <div className="mb-7 flex items-center justify-between"><ReloadLogo /><div className="flex gap-1"><LanguageToggle compact /><ModeToggle /></div></div>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-7 shadow-[0_24px_70px_-45px_rgba(15,15,18,.35)] sm:p-9">
        <AnimatePresence mode="wait" initial={false}>
          {step === "choose" && <motion.div key="choose" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={QUICK}>
            <span className="grid size-11 place-items-center rounded-xl bg-muted"><KeyRound className="size-5" /></span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("Team sign in", "دخول الفريق")}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Use your own account. Access is by invitation from a team owner.", "ادخل بحسابك الشخصي. الوصول بدعوة من مالك الفريق.")}</p>

            {GOOGLE_ENABLED && <>
              <Button type="button" onClick={() => void google()} disabled={!!busy} variant="outline" className="mt-7 h-12 w-full gap-3 rounded-xl text-[15px] font-medium transition-[background-color,transform] active:scale-[.99]">
                {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
                {t("Continue with Google", "المتابعة عبر Google")}
              </Button>
              <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[.14em] text-muted-foreground"><span className="h-px flex-1 bg-border" />{t("or", "أو")}<span className="h-px flex-1 bg-border" /></div>
            </>}

            <form onSubmit={(event) => void sendEmail(event)} className={GOOGLE_ENABLED ? "" : "mt-7"}>
              <label className="block text-sm font-medium" htmlFor="team-email">{t("Work email", "البريد الإلكتروني")}</label>
              <div className="mt-2 flex gap-2">
                <Input id="team-email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="h-11 rounded-xl" />
                <Button type="submit" disabled={!!busy || !email.trim()} className="h-11 shrink-0 rounded-xl px-4" aria-label={t("Email me a sign-in code", "أرسل رمز الدخول")}>
                  {busy === "email" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4 rtl:rotate-180" />}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("We'll email you a sign-in link and code. No password needed.", "سنرسل لك رابط ورمز الدخول. لا حاجة لكلمة مرور.")}</p>
            </form>

            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" />{t("Invite-only access", "الوصول بالدعوة فقط")}</span>
              <button type="button" onClick={() => go("password")} className="underline-offset-4 transition-colors hover:text-foreground hover:underline">{t("Shared team password", "كلمة مرور الفريق المشتركة")}</button>
            </div>
          </motion.div>}

          {step === "code" && <motion.div key="code" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={QUICK}>
            <button type="button" onClick={() => go("choose")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-3.5 rtl:rotate-180" />{t("Back", "رجوع")}</button>
            <span className="mt-5 grid size-11 place-items-center rounded-xl bg-muted"><Mail className="size-5" /></span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("Check your email", "تحقق من بريدك")}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("We sent a sign-in email to ", "أرسلنا بريد الدخول إلى ")}<bdi className="font-medium text-foreground">{email.trim().toLowerCase()}</bdi>{t(". Click its link, or enter the code from it here.", ". انقر الرابط فيه، أو أدخل الرمز هنا.")}</p>
            <form onSubmit={(event) => void verify(event)} className="mt-6">
              <Input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={10} value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="••••••" className="h-14 rounded-xl text-center font-mono text-2xl tracking-[.4em]" aria-label={t("Sign-in code", "رمز الدخول")} />
              <Button type="submit" disabled={!!busy || code.length < 6} className="mt-3 h-11 w-full rounded-xl">{busy === "code" && <Loader2 className="size-4 animate-spin" />}{t("Sign in", "دخول")}</Button>
            </form>
            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
            <button type="button" disabled={cooldown > 0 || !!busy} onClick={() => void sendEmail()} className="mt-5 text-xs text-muted-foreground underline-offset-4 transition-colors enabled:hover:text-foreground enabled:hover:underline disabled:opacity-60">
              {cooldown ? t(`Send again in ${cooldown}s`, `إعادة الإرسال بعد ${cooldown} ث`) : t("Send a new email", "أرسل بريدًا جديدًا")}
            </button>
          </motion.div>}

          {step === "password" && <motion.div key="password" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={QUICK}>
            <button type="button" onClick={() => go("choose")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-3.5 rtl:rotate-180" />{t("Back", "رجوع")}</button>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("Shared team password", "كلمة مرور الفريق")}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("For the shared account while everyone moves to personal sign-in.", "للحساب المشترك حتى ينتقل الجميع إلى الدخول الشخصي.")}</p>
            <form className="mt-6 space-y-4" onSubmit={(event) => void signInWithPassword(event)}>
              <Input value={SHARED_EMAIL} readOnly dir="ltr" autoComplete="username" className="h-11 rounded-xl text-muted-foreground" />
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus placeholder={t("Password", "كلمة المرور")} className="h-11 rounded-xl" />
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button className="h-11 w-full rounded-xl" disabled={!!busy}>{busy === "password" && <Loader2 className="size-4 animate-spin" />}{t("Open team desk", "افتح مساحة الفريق")}<ArrowRight className="size-4 rtl:rotate-180" /></Button>
            </form>
          </motion.div>}
        </AnimatePresence>
      </div>
    </div>
  </main>;
}

function GoogleMark() {
  return <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>;
}
