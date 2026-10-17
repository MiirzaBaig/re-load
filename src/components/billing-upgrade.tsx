"use client";
import { useState } from "react";
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
export function BillingUpgrade({
  storeId,
  disabled,
  onConfirm,
}: {
  storeId: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const { t, isArabic } = useLanguage();
  const [quote, setQuote] = useState<{
    amountHalalas: number;
    messages: number;
    periodEnd: string;
    allowanceEnd: string;
    interval: "monthly" | "annual";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function preview() {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          action: "quote",
          plan: "premium",
          kind: "UPGRADE",
        }),
      });
      const result = await r.json();
      if (!r.ok || !result.periodEnd) throw new Error();
      setQuote(result);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        className="w-full rounded-xl active:scale-[.98]"
        disabled={disabled || busy}
        onClick={() => void preview()}
      >
        {busy && <Spinner />}
        {t("Upgrade to Premium", "الترقية إلى Premium")}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-300">
          {t(
            "Could not prepare your upgrade. Refresh billing or contact Reload.",
            "تعذّر تجهيز الترقية. حدّث الصفحة أو تواصل مع ريلود.",
          )}
        </p>
      )}
      <AlertDialog
        open={Boolean(quote)}
        onOpenChange={(open) => {
          if (!open) setQuote(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Your Premium upgrade", "ترقيتك إلى Premium")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {quote &&
                t(
                  `Estimated charge: SAR ${(quote.amountHalalas / 100).toFixed(2)} including VAT for the rest of this billing period. You’ll receive ${quote.messages} additional messages and customer support features until the monthly reset on ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(quote.allowanceEnd))}. After that, you receive 2,000 messages each month. Your paid access lasts until ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(quote.periodEnd))}. The final charge is shown at checkout before you pay. Premium then renews at SAR ${quote.interval === "annual" ? "2,870.40/year" : "299/month"}.`,
                  `التكلفة التقديرية ${(quote.amountHalalas / 100).toFixed(2)} ريال شامل الضريبة لبقية فترة الفوترة. تحصل على ${quote.messages} رسالة إضافية وميزات خدمة العملاء حتى ${new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-GB", { dateStyle: "medium" }).format(new Date(quote.allowanceEnd))}، ثم 2,000 رسالة كل شهر. يستمر وصولك المدفوع حتى ${new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(quote.periodEnd))}، ويظهر المبلغ النهائي قبل الدفع. ثم يتجدد Premium بسعر ${quote.interval === "annual" ? "2,870.40 ريال سنويًا" : "299 ريال شهريًا"}.`,
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Not now", "ليس الآن")}</AlertDialogCancel>
            <Button
              onClick={() => {
                setQuote(null);
                onConfirm();
              }}
            >
              {t("Continue to secure checkout", "المتابعة إلى الدفع الآمن")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
