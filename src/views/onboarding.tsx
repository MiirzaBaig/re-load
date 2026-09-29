"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReloadLogo } from "@/components/reload-logo";
import { Spinner } from "@/components/ui/spinner";
import { services } from "@/lib/services";
import { toast } from "sonner";
import { Check, Store, Plug, FileText, ArrowRight, ArrowLeft, ShieldCheck, Package, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

export function OnboardingPage() {
  const router = useRouter();
  const { t, isArabic } = useLanguage();
  const STEPS = [
    t("Store details", "بيانات المتجر"),
    t("Connect store", "ربط المتجر"),
    t("Set up policy", "إعداد السياسة"),
    t("Test a return", "تجربة إرجاع"),
  ];
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    await services.connectPlatform("salla");
    setConnecting(false);
    setConnected(true);
    toast.success(t("Salla connected (simulated)", "تم ربط سلة (تجريبي)"));
  };

  const handleFinish = () => {
    if (storeName) services.setStoreName(storeName);
    services.setOnboarded(true);
    toast.success(t("Workspace ready", "مساحة العمل جاهزة"));
    router.push("/app");
  };

  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-5 py-4">
          <ReloadLogo />
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-[640px] px-5 py-12">
          <div className="mb-3">
            <div className="text-xs font-medium uppercase tracking-wider text-primary">{t("Workspace setup", "إعداد مساحة العمل")}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t("Get your first return decision ready in four steps.", "جهّز أول قرار إرجاع في أربع خطوات.")}</p>
          </div>
          <div className="mb-8 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    i < step && "bg-eligible text-eligible-foreground",
                    i === step && "bg-primary text-primary-foreground",
                    i > step && "bg-muted text-muted-foreground",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span className={cn("text-xs", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
                {i < STEPS.length - 1 && <div className="mx-1 h-px w-6 bg-border" />}
              </div>
            ))}
          </div>

          {step === 0 && (
            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Store className="size-5" />
                </div>
                <CardTitle className="font-display text-xl">{t("Store details", "بيانات المتجر")}</CardTitle>
                <CardDescription>{t("Tell us about your store to set up your workspace.", "عرّفنا على متجرك لإعداد مساحة العمل.")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="store">{t("Store name", "اسم المتجر")}</Label>
                    <Input id="store" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder={t("Nova Store", "متجر نوفا")} />
                  </div>
                  <Button onClick={() => setStep(1)} disabled={!storeName}>
                    {t("Continue", "متابعة")}
                    <ArrowRight className={cn("size-4", isArabic && "rotate-180")} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Plug className="size-5" />
                </div>
                <CardTitle className="font-display text-xl">{t("Connect your store", "اربط متجرك")}</CardTitle>
                <CardDescription>{t("Connect your commerce platform to sync orders.", "اربط منصة متجرك لمزامنة الطلبات.")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">Salla</div>
                        <div className="text-xs text-muted-foreground">{t("Simulated connection", "ربط تجريبي")}</div>
                      </div>
                      {connected ? (
                        <span className="rounded-full bg-eligible-muted px-2.5 py-0.5 text-xs font-medium text-eligible">{t("Connected", "متصل")}</span>
                      ) : (
                        <Button size="sm" onClick={handleConnect} disabled={connecting}>
                          {connecting && <Spinner className="me-1" />}
                          {connecting ? t("Connecting...", "جارٍ الربط...") : t("Connect", "ربط")}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border p-4 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">Zid</div>
                        <div className="text-xs text-muted-foreground">{t("Coming later", "قريبًا")}</div>
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{t("Soon", "قريبًا")}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(0)}>
                      <ArrowLeft className={cn("size-4", isArabic && "rotate-180")} />
                      {t("Back", "رجوع")}
                    </Button>
                    <Button onClick={() => setStep(2)} disabled={!connected} className="flex-1">
                      {t("Continue", "متابعة")}
                      <ArrowRight className={cn("size-4", isArabic && "rotate-180")} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <CardTitle className="font-display text-xl">{t("Set up your policy", "إعداد سياستك")}</CardTitle>
                <CardDescription>{t("A sample policy is ready. Review and approve the first rule next.", "جهّزنا لك سياسة نموذجية. راجع القاعدة الأولى واعتمدها.")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                    {t("We've prepared a sample returns policy based on common ecommerce practices. You can edit it or paste your own text in the policy workspace.", "أعددنا سياسة إرجاع نموذجية مبنية على الممارسات الشائعة في التجارة الإلكترونية. يمكنك تعديلها أو لصق نص سياستك في مساحة عمل السياسات.")}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-eligible-muted text-eligible">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{t("Policy v1.0 is published", "تم نشر السياسة v1.0")}</div>
                        <div className="text-xs text-muted-foreground">{t("5 rules active · ready for returns", "5 قواعد مفعّلة · جاهزة لاستقبال طلبات الإرجاع")}</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => router.push("/app/policies")} className="self-start">
                      {t("Review policy rules", "مراجعة قواعد السياسة")}
                      <ArrowRight className={cn("size-3.5", isArabic && "rotate-180")} />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className={cn("size-4", isArabic && "rotate-180")} />
                      {t("Back", "رجوع")}
                    </Button>
                    <Button onClick={() => setStep(3)} className="flex-1">
                      {t("Continue", "متابعة")}
                      <ArrowRight className={cn("size-4", isArabic && "rotate-180")} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="size-5" />
                </div>
                <CardTitle className="font-display text-xl">{t("Test a return", "تجربة إرجاع")}</CardTitle>
                <CardDescription>{t("See how a customer experiences a return decision.", "شاهد كيف يستقبل العميل قرار الإرجاع.")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                    {t("Try the customer return flow with demo order", "جرّب رحلة إرجاع العميل باستخدام الطلب التجريبي")} <span className="font-mono font-medium text-foreground">SA-10492</span> {t("and email", "والبريد الإلكتروني")} <span className="font-mono font-medium text-foreground">sara.ahmed@example.com</span>{t(". You'll see the eligibility decision and the rules that produced it.", ". سترى قرار الأهلية والقواعد التي أدّت إليه.")}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" onClick={() => router.push("/return")} className="justify-start">
                      <Zap className="size-4 text-saffron" />
                      {t("Open customer return flow", "فتح رحلة إرجاع العميل")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => router.push("/app/cases")} className="self-start">
                      {t("Or view existing cases", "أو استعرض الحالات الحالية")}
                      <ArrowRight className={cn("size-3.5", isArabic && "rotate-180")} />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      <ArrowLeft className={cn("size-4", isArabic && "rotate-180")} />
                      {t("Back", "رجوع")}
                    </Button>
                    <Button onClick={handleFinish} className="flex-1">
                      {t("Enter workspace", "الدخول إلى مساحة العمل")}
                      <ArrowRight className={cn("size-4", isArabic && "rotate-180")} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
