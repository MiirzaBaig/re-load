"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { QUICK, TWEEN } from "@/components/desk/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

/**
 * Shown when someone is signed in but has no store yet (older accounts from
 * before sign-up created one automatically). One field, one button, and they
 * land in their workspace. The database function never creates a second store.
 */
export function CreateWorkspace() {
  const { user, refreshWorkspace } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_my_store_workspace", { p_store_name: name.trim() });
    if (error) {
      setBusy(false);
      toast.error(t("Couldn't create your workspace. Please try again.", "تعذّر إنشاء مساحة العمل. حاول مرة أخرى."));
      return;
    }
    await refreshWorkspace();
    toast.success(t("Your store workspace is ready.", "مساحة عمل متجرك جاهزة."));
  };

  return (
    <div className="mx-auto flex min-h-[70svh] w-full max-w-md flex-col justify-center py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={TWEEN}
        className="rounded-3xl border border-border bg-card p-7 shadow-[0_24px_70px_-45px_rgba(15,15,18,.35)] sm:p-9">
        <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...QUICK, delay: 0.1 }}
          className="grid size-12 place-items-center rounded-2xl border border-border bg-muted/50"><Store className="size-5" /></motion.span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">{t("Create your store workspace", "أنشئ مساحة عمل متجرك")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("This is where you connect your store, set your return policy and see every return. It takes a few seconds.", "هنا تربط متجرك وتضبط سياسة الإرجاع وتتابع كل طلب إرجاع. يستغرق ثوانٍ فقط.")}
        </p>
        <form onSubmit={(event) => void create(event)} className="mt-7 space-y-4">
          <label className="block text-sm font-medium" htmlFor="store-name">{t("Store name", "اسم المتجر")}</label>
          <Input id="store-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus
            placeholder={t("e.g. Nova Store", "مثال: متجر نوفا")} className="h-11 rounded-xl" dir="auto" />
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl transition-transform active:scale-[.99]">
            {busy ? <><Loader2 className="size-4 animate-spin" />{t("Creating…", "جارٍ الإنشاء…")}</> : <>{t("Create workspace", "إنشاء مساحة العمل")}<ArrowRight className="size-4 rtl:-scale-x-100" /></>}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {user?.email && t(`Signed in as ${user.email}. You can rename the store later.`, `مسجّل باسم ${user.email}. يمكنك تغيير الاسم لاحقًا.`)}
          </p>
        </form>
      </motion.div>
    </div>
  );
}
