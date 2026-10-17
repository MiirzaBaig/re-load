"use client";
import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export function BillingFrequencyChange({
  storeId,
  interval,
  pending,
  plan,
  periodEnd,
  disabled,
  onSaved,
}: {
  storeId: string;
  interval: "monthly" | "annual";
  pending: "monthly" | "annual" | null;
  plan: string;
  periodEnd: string;
  disabled: boolean;
  onSaved: () => void;
}) {
  const { t, isArabic } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const target = pending || (interval === "annual" ? "monthly" : "annual");
  const price =
    target === "annual"
      ? plan === "premium"
        ? "2,870.40"
        : "1,430.40"
      : plan === "premium"
        ? "299"
        : "149";
  const when = new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-GB", {
    dateStyle: "medium",
  }).format(new Date(periodEnd));
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          action: "schedule_interval",
          interval: target,
        }),
      });
      if (!r.ok) throw new Error();
      onSaved();
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
      >
        {pending ? (
          <Check className="size-4" />
        ) : (
          <CalendarDays className="size-4" />
        )}
        {pending
          ? t("Review billing change", "مراجعة تغيير الفوترة")
          : t("Change billing frequency", "تغيير مدة الاشتراك")}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Change at your next renewal", "التغيير عند التجديد القادم")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `Keep your current paid access until ${when}. Your next charge will be SAR ${price}, including VAT, billed ${target === "annual" ? "yearly" : "monthly"}. Your message allowance still refreshes monthly. No payment is collected now.`,
                `يبقى وصولك المدفوع حتى ${when}. الدفعة التالية ${price} ريال شامل الضريبة، ${target === "annual" ? "سنويًا" : "شهريًا"}. الرصيد يتجدد شهريًا. لا يُحصّل مبلغ الآن.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending && (
            <p className="text-sm text-muted-foreground animate-in fade-in-0 duration-300">
              {t(
                "A change has been requested. Confirm again to retry the same request safely if needed.",
                "تم طلب التغيير. يمكنك تأكيد نفس الطلب مجددًا بأمان عند الحاجة.",
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-review animate-in fade-in-0 slide-in-from-top-1 duration-300">
              {t(
                "We couldn’t confirm the change. Refresh billing before retrying; your current paid period stays unchanged.",
                "تعذّر تأكيد التغيير. حدّث الصفحة قبل المحاولة؛ فترتك المدفوعة لم تتغير.",
              )}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("Keep current billing", "الإبقاء على الفوترة")}
            </AlertDialogCancel>
            <Button disabled={busy} onClick={() => void save()}>
              {busy ? <Spinner /> : <CalendarDays className="size-4" />}
              {t("Confirm next-renewal change", "تأكيد التغيير للتجديد القادم")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
