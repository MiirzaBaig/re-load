"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { ReloadMark } from "@/components/reload-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/components/language-provider";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
}

export function AuthDialog({ open, onOpenChange, redirectTo = "/app" }: AuthDialogProps) {
  const { t } = useLanguage();
  const googleAuthEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => {
        setError("");
        setSent(false);
        setLoading(null);
      }, 200);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const signInWithGoogle = async () => {
    if (!supabase || !googleAuthEnabled) {
      setError(t("Google sign-in is not available yet. Use the secure email link instead.", "تسجيل الدخول عبر Google غير متاح الآن. استخدم رابط البريد الإلكتروني الآمن."));
      return;
    }
    setError("");
    setLoading("google");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(null);
    }
  };

  const requestMagicLink = async () => {
    if (!supabase) return setError(t("Authentication is temporarily unavailable.", "خدمة تسجيل الدخول غير متاحة مؤقتًا."));
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return setError(t("Enter your work email.", "أدخل بريد العمل الإلكتروني."));
    if (cooldown) return;

    setError("");
    setLoading("email");
    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        shouldCreateUser: true,
        data: { store_name: "My Store" },
      },
    });
    setLoading(null);
    if (magicLinkError) return setError(magicLinkError.message);
    setSent(true);
    setCooldown(60);
  };

  const sendMagicLink = (event: React.FormEvent) => {
    event.preventDefault();
    void requestMagicLink();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="auth-dialog overflow-hidden border-border/80 bg-card p-0 shadow-[0_32px_100px_-24px_rgba(0,0,0,0.42)] sm:max-w-[400px]">
        <div className="px-7 pb-7 pt-9">
          <DialogHeader className="items-center text-center sm:text-center">
            <ReloadMark className="mb-5 size-9 text-primary" />
            <DialogTitle className="font-display text-[23px] leading-tight tracking-[-0.02em]">
              {t("Sign in to Reload", "تسجيل الدخول إلى ريلود")}
            </DialogTitle>
            <DialogDescription className="mt-1.5 leading-relaxed">
              {t("No password needed.", "لا تحتاج إلى كلمة مرور.")}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-5 animate-in fade-in slide-in-from-top-1">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {sent ? (
            <div className="mt-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-6 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0_/0.08)]">
                  <Check className="size-5" strokeWidth={2.5} />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold">
                  {t("Check your inbox", "تحقق من بريدك الإلكتروني")}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t("We sent a sign-in link to", "أرسلنا رابط تسجيل الدخول إلى")}{" "}
                  <span className="font-medium text-foreground">
                    {email.trim()}
                  </span>
                  {t(". It expires in 10 minutes.", ". تنتهي صلاحيته خلال 10 دقائق.")}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => void requestMagicLink()}
                  disabled={loading === "email" || cooldown > 0}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {cooldown ? t(`Resend in ${cooldown}s`, `إعادة الإرسال خلال ${cooldown} ث`) : t("Resend link", "إعادة إرسال الرابط")}
                </button>
                <span aria-hidden className="text-border">
                  |
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setError("");
                  }}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("Use a different email", "استخدام بريد إلكتروني آخر")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              {googleAuthEnabled && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="nav-cta h-11 w-full justify-center gap-2.5 bg-background font-medium"
                    onClick={() => void signInWithGoogle()}
                    disabled={loading !== null}
                  >
                    {loading === "google" ? <Spinner /> : <GoogleMark />}
                    {t("Continue with Google", "المتابعة باستخدام Google")}
                  </Button>

                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground">{t("or", "أو")}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              <form onSubmit={sendMagicLink} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="auth-email" className="text-xs font-medium">
                    {t("Work email", "بريد العمل الإلكتروني")}
                  </Label>
                  <Input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="h-11"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  className="nav-cta h-11 w-full"
                  disabled={loading !== null}
                >
                  {loading === "email" ? <Spinner /> : null}
                  {t("Continue with email", "المتابعة بالبريد الإلكتروني")}
                </Button>
              </form>

              <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                {t("We'll email a one-time sign-in link. No password, no marketing.", "سنرسل رابط دخول صالحًا لمرة واحدة. دون كلمة مرور أو رسائل تسويقية.")}
                <br />
                {t("By continuing you agree to our", "بمتابعتك، فإنك توافق على")}{" "}
                <Link
                  href="/terms"
                  onClick={() => onOpenChange(false)}
                  className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
                >
                  {t("Terms", "الشروط")}
                </Link>{" "}
                {t("and", "و")}{" "}
                <Link
                  href="/privacy"
                  onClick={() => onOpenChange(false)}
                  className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
                >
                  {t("Privacy Policy", "سياسة الخصوصية")}
                </Link>
                .
              </p>

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.19-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.97-3.39.97-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.51H3.04A10 10 0 0 0 2 12c0 1.61.39 3.13 1.04 4.49l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.62C7.18 7.76 9.39 6 12 6Z" />
    </svg>
  );
}
