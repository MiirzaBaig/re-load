"use client";

import { LogOut, ShieldX } from "lucide-react";
import { ReloadLogo } from "@/components/reload-logo";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Signed in, but not on the team (and no invite for this email). */
export function AdminNoAccess({ email }: { email: string }) {
  const { t } = useLanguage();
  const signOut = async () => {
    await getSupabaseBrowserClient()?.auth.signOut();
    window.location.replace("/admin/login");
  };
  return <main className="grid min-h-svh place-items-center bg-background px-5 py-12">
    <div className="w-full max-w-md animate-fade-in">
      <div className="mb-7"><ReloadLogo /></div>
      <div className="rounded-3xl border border-border bg-card p-7 sm:p-9">
        <span className="grid size-11 place-items-center rounded-xl bg-muted"><ShieldX className="size-5" /></span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("This account isn't on the team yet", "هذا الحساب ليس ضمن الفريق بعد")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("You're signed in as ", "أنت مسجّل باسم ")}<bdi className="font-medium text-foreground">{email}</bdi>{t(". Ask a team owner to invite this email, then sign in again.", ". اطلب من مالك الفريق دعوة هذا البريد، ثم سجّل الدخول مجددًا.")}</p>
        <Button variant="outline" className="mt-7 h-11 w-full rounded-xl" onClick={() => void signOut()}><LogOut className="size-4 rtl:-scale-x-100" />{t("Use a different account", "استخدم حسابًا آخر")}</Button>
      </div>
    </div>
  </main>;
}
