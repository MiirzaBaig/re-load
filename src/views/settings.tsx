"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollReveal } from "@/components/scroll-reveal";
import { toast } from "sonner";
import { Users, Globe, Settings, Shield, User } from "lucide-react";
import { PageHeader } from "@/components/desk/page-header";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/components/language-provider";
import { Spinner } from "@/components/ui/spinner";
import { StoreMark } from "@/components/store-identity";
import { useDelayedLoad } from "@/hooks/use-delayed-load";
import { SettingsPageSkeleton } from "@/components/merchant-skeletons";

export function SettingsPage() {
  const auth = useAuth();
  const { t, locale, setLocale } = useLanguage();
  const loaded = useDelayedLoad(260);
  const [storeName, setStoreName] = useState(auth.workspace?.storeName ?? "");
  const [saving, setSaving] = useState(false);
  const canEditStore = auth.workspace?.role === "owner" || auth.workspace?.role === "admin";
  const name = storeName.trim();
  const nameValid = name.length > 0 && name.length <= 120;
  const nameChanged = name !== auth.workspace?.storeName;

  useEffect(() => {
    setStoreName(auth.workspace?.storeName ?? "");
  }, [auth.workspace?.storeId, auth.workspace?.storeName]);

  const handleSaveStore = async () => {
    if (!supabase || !auth.workspace || !canEditStore || !nameValid || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("stores")
        .update({ name }).eq("id", auth.workspace.storeId).select("id").single();
      if (error || !data) throw new Error("save_failed");
      await auth.refreshWorkspace();
      toast.success(t("Store settings saved", "تم حفظ إعدادات المتجر"));
    } catch {
      toast.error(t("Could not save your store name. Please try again.", "تعذّر حفظ اسم المتجر. يرجى المحاولة مرة أخرى."));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 animate-fade-in">
      <PageHeader icon={Settings} title={t("Settings", "الإعدادات")}>
        {t("Your store name, language and who can open this workspace.", "اسم متجرك، واللغة، ومن يستطيع فتح مساحة العمل.")}
      </PageHeader>

      <ScrollReveal delay={100}>
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Shield className="size-3.5 text-primary" />
          <span>{t(`Signed in as ${auth.user?.email}. Store access is scoped by membership.`, `تم تسجيل الدخول باسم ${auth.user?.email}. الوصول مقيد بعضوية المتجر.`)}</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Store profile */}
          <Card className="h-full rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <StoreMark size="md" />
                <CardTitle className="text-base">{t("Store profile", "ملف المتجر")}</CardTitle>
              </div>
              <CardDescription>{t("The name shown across your workspace.", "الاسم الذي يظهر في مساحة عملك.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSaveStore(); }}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="store-name">{t("Store name", "اسم المتجر")}</Label>
                  <Input id="store-name" required maxLength={120} disabled={!canEditStore || saving} aria-describedby="store-name-help" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="store-email">{t("Account email", "بريد الحساب")}</Label>
                  <Input id="store-email" type="email" dir="ltr" value={auth.user?.email ?? ""} readOnly className="bg-muted/40 text-muted-foreground" />
                </div>
                <p id="store-name-help" className="text-xs leading-5 text-muted-foreground">{canEditStore
                  ? t("Use 1–120 characters. Your account email is read-only.", "استخدم من 1 إلى 120 حرفًا. لا يمكن تعديل بريد الحساب هنا.")
                  : t("Only store owners and admins can change the store name.", "يمكن لمالك المتجر والمسؤولين فقط تعديل اسم المتجر.")}</p>
                <Button type="submit" size="sm" disabled={!canEditStore || !nameValid || !nameChanged || saving} className="self-start">
                  {saving && <Spinner />}
                  {saving ? t("Saving…", "جارٍ الحفظ…") : t("Save changes", "حفظ التغييرات")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Team access */}
          <Card className="h-full rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("Team access", "صلاحيات الفريق")}</CardTitle>
              </div>
              <CardDescription>{t("Your current access to this store.", "صلاحياتك الحالية في هذا المتجر.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{auth.user?.email}</div>
                    <div className="text-xs text-muted-foreground">{auth.workspace?.role === "owner" ? t("Owner", "المالك") : auth.workspace?.role === "admin" ? t("Admin", "مسؤول") : t("Member", "عضو")}</div>
                  </div>
                  <span className="rounded-full bg-eligible-muted px-2 py-0.5 text-[11px] font-medium text-eligible">{t("Active", "نشط")}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t("Team invitations will be available in a future release.", "ستتوفر دعوات الفريق في إصدار لاحق.")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card className="h-full rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("Language", "اللغة")}</CardTitle>
              </div>
              <CardDescription>{t("Display language for your workspace.", "لغة عرض مساحة العمل.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Select dir={locale === "ar" ? "rtl" : "ltr"} value={locale} onValueChange={(value) => setLocale(value as "en" | "ar")}>
                  <SelectTrigger aria-label={t("Workspace language", "لغة مساحة العمل")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("Language preference is saved on this device.", "يُحفظ اختيار اللغة على هذا الجهاز.")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Account */}
          <Card className="h-full rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("Account", "الحساب")}</CardTitle>
              </div>
              <CardDescription>{t("Your authenticated workspace account.", "حساب مساحة العمل المسجل.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="text-sm text-muted-foreground">
                  {t(`Signed in as ${auth.user?.email}.`, `تم تسجيل الدخول باسم ${auth.user?.email}.`)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollReveal>
    </div>
  );
}
