"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";

/** The estimate the merchant was looking at when they asked. */
export interface FinancingSnapshot {
  monthlyReturns: number;
  orderValue: number;
  processingMinutes: number;
  resolutionDays: number;
  hourlyCost: number;
  tiedUp: number;
  operatingCost: number;
}

type Status = "idle" | "sending" | "sent" | "error";

export function FinancingRequestForm({
  snapshot,
}: {
  snapshot: FinancingSnapshot;
}) {
  const { t, isArabic } = useLanguage();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    const form = new FormData(event.currentTarget);
    const metric = (key: string) => String(form.get(key) ?? "").trim() === "" ? null : Number(form.get(key));
    setStatus("sending");
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      // The figures go in with the contact details: the estimate on screen is
      // what the merchant is asking about, and recomputing it later from
      // inputs they may have changed would not be the same request.
      const { error: insertError } = await supabase
        .from("financing_requests")
        .insert({
          store_name: String(form.get("store") ?? "").trim(),
          contact_name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          phone: String(form.get("phone") ?? "").trim() || null,
          store_platform: String(form.get("platform") ?? "").trim(),
          monthly_sales: metric("monthly_sales"),
          monthly_orders: metric("monthly_orders"),
          return_rate: metric("return_rate"),
          average_refund_amount: metric("average_refund_amount"),
          monthly_refund_volume: metric("monthly_refund_volume"),
          refund_processing_days: metric("refund_processing_days"),
          desired_financing_days: metric("desired_financing_days"),
          contact_consent: form.get("consent") === "on",
          monthly_returns: Math.round(snapshot.monthlyReturns),
          average_order_value: snapshot.orderValue,
          processing_minutes: Math.round(snapshot.processingMinutes),
          resolution_days: snapshot.resolutionDays,
          hourly_cost: snapshot.hourlyCost,
          tied_up_amount: Math.round(snapshot.tiedUp),
          operating_cost: Math.round(snapshot.operatingCost),
          locale: isArabic ? "ar" : "en",
        });

      if (insertError) throw insertError;
      setStatus("sent");
    } catch {
      // Never strand the merchant on a dead form: show the failure and leave
      // their input in place so they can retry without retyping.
      setStatus("error");
      setError(t("We couldn’t save your interest. Please try again; your details are still here.", "تعذّر حفظ طلبك. حاول مرة أخرى، بياناتك ما زالت موجودة."));
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && status === "sent") {
      setStatus("idle");
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="financing-cta group h-12 w-full rounded-xl text-[15px] font-semibold">
          {t("Register financing interest", "سجّل اهتمامك بالتمويل")}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Button>
      </DialogTrigger>

      <DialogContent dir={isArabic ? "rtl" : "ltr"} className="max-h-[85dvh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        {status === "sent" ? (
          <div className="py-6 text-center">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-eligible-muted text-eligible">
              <CheckCircle2 className="size-6" />
            </span>
            <DialogTitle className="text-xl">
              {t("Request received", "تم استلام طلبك")}
            </DialogTitle>
            <DialogDescription className="mt-2">
              {t(
                "Your interest is saved. The Reload team may contact you about future options with licensed financing partners.",
                "سجّلنا اهتمامك. قد يتواصل معك فريق ريلود بخصوص الخيارات المستقبلية مع شركاء تمويل مرخّصين.",
              )}
            </DialogDescription>
            <Button
              onClick={() => handleOpenChange(false)}
              variant="outline"
              className="mt-6 rounded-xl"
            >
              {t("Close", "إغلاق")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("Register financing interest", "سجّل اهتمامك بالتمويل")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "Tell us about your store so we can understand your needs for future licensed financing partners. Estimates are welcome.",
                  "عرّفنا بمتجرك لنفهم احتياجاتك استعدادًا للتعاون مع شركاء تمويل مرخّصين مستقبلًا. يمكنك إدخال أرقام تقديرية.",
                )}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="fin-store">
                  {t("Store name", "اسم المتجر")}
                </Label>
                <Input id="fin-store" name="store" required autoComplete="organization" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="fin-name">
                    {t("Your name", "اسمك")}
                  </Label>
                  <Input id="fin-name" name="name" required autoComplete="name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fin-phone">
                    {t("Phone", "رقم الجوال")}
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      {t("(optional)", "(اختياري)")}
                    </span>
                  </Label>
                  <Input
                    id="fin-phone"
                    name="phone"
                    type="tel"
                    dir="ltr"
                    autoComplete="tel"
                    className="text-start"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fin-email">
                  {t("Work email", "البريد الإلكتروني")}
                </Label>
                <Input
                  id="fin-email"
                  name="email"
                  type="email"
                  required
                  dir="ltr"
                  autoComplete="email"
                  className="text-start"
                />
              </div>

              <fieldset className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4">
                <legend className="px-1 text-sm font-semibold">{t("About your store", "عن متجرك")}</legend>
                <div className="grid gap-2">
                  <Label htmlFor="fin-platform">{t("Commerce platform", "منصة المتجر")}</Label>
                  <Input id="fin-platform" name="platform" required maxLength={120} placeholder={t("Salla, Zid, Shopify, custom store…", "سلة، زد، شوبيفاي، متجر خاص…")} />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{t("Business figures are optional. Your calculator estimate will be attached separately.", "الأرقام التشغيلية اختيارية. سنرفق تقدير الحاسبة بشكل منفصل.")}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { key: "monthly_sales", label: t("Monthly sales (SAR)", "المبيعات الشهرية (ر.س)"), max: 9999999999, step: "0.01" },
                    { key: "monthly_orders", label: t("Monthly orders", "عدد الطلبات شهريًا"), max: 100000000, step: "1" },
                    { key: "return_rate", label: t("Return rate (%)", "نسبة المرتجعات (%)"), max: 100, step: "0.01" },
                    { key: "average_refund_amount", label: t("Average refund (SAR)", "متوسط مبلغ الاسترداد (ر.س)"), max: 9999999999, step: "0.01" },
                    { key: "monthly_refund_volume", label: t("Monthly refund total (SAR)", "إجمالي الاستردادات شهريًا (ر.س)"), max: 9999999999, step: "0.01" },
                    { key: "refund_processing_days", label: t("Current refund time (days)", "مدة الاسترداد الحالية (أيام)"), max: 365, step: "0.5" },
                    { key: "desired_financing_days", label: t("Preferred repayment period (days)", "مدة السداد المطلوبة (أيام)"), max: 365, step: "1" },
                  ].map(field => <div key={field.key} className="grid gap-2">
                    <Label htmlFor={`fin-${field.key}`}>{field.label}</Label>
                    <Input id={`fin-${field.key}`} name={field.key} type="number" min={0} max={field.max} step={field.step} inputMode="decimal" dir="ltr" />
                  </div>)}
                </div>
              </fieldset>
              <label className="flex items-start gap-3 text-sm leading-relaxed">
                <input name="consent" type="checkbox" required className="mt-1 size-4 shrink-0 accent-primary" />
                <span>{t("I agree that Reload may contact me about this interest. This is not a financing application, offer, or approval.", "أوافق على تواصل ريلود معي بخصوص هذا الاهتمام. هذا التسجيل ليس طلب تمويل أو عرضًا أو موافقة تمويلية.")}</span>
              </label>

              {error && (
                <p role="alert" className="text-sm text-not-eligible">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={status === "sending"}
                className="mt-2 h-11 w-full rounded-xl"
              >
                {status === "sending" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {status === "sending"
                  ? t("Sending…", "جارٍ الإرسال…")
                  : t("Submit request", "إرسال الطلب")}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {t(
                  "Financing would be subject to a licensed partner’s assessment and terms.",
                  "يخضع أي تمويل مستقبلي لتقييم الشريك المرخّص وشروطه.",
                )}
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
