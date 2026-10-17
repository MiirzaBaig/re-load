"use client";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { CreditCard, Check } from "lucide-react";

type Data = {
  environment: string;
  outgoingDelivered: number;
  snapshot: {
    plan: string | null;
    status: string;
    used: number;
    included: number;
    billingInterval: string;
    periodEnd: string | null;
    allowanceEnd: string | null;
    offerAvailable: boolean;
  };
  costs: Array<{
    input_tokens: number;
    output_tokens: number;
    cost_sar: number | null;
    cost_basis: string;
  }>;
  payments: Array<{
    amount_halalas: number;
    refunded_halalas: number;
    paid_at: string;
    plan: string;
    kind: string;
    billing_interval: string;
  }>;
};
export function StaffBillingCard({
  storeId,
  canManage,
}: {
  storeId: string;
  canManage: boolean;
}) {
  const { t } = useLanguage();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const r = await fetch(`/api/admin/billing?store=${storeId}`, {
          signal,
          cache: "no-store",
        });
        if (!r.ok) throw new Error();
        setData(await r.json());
        setError("");
      } catch (e) {
        if (!(e instanceof Error && e.name === "AbortError"))
          setError(t("Could not load billing.", "تعذّر تحميل الاشتراك."));
      }
    },
    [storeId, t],
  );
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    const timer = setInterval(() => {
      if (!document.hidden) void load(c.signal);
    }, 15000);
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [load]);
  async function grant() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant_offer", storeId }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setSaved(true);
      await load();
    } catch {
      setError(
        t(
          "Offer could not be assigned. Check eligibility and retry.",
          "تعذّر تخصيص العرض. تحقق من الأهلية وحاول مجددًا.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <CreditCard className="size-4" />
        {t("Subscription & usage", "الاشتراك والاستخدام")}
      </h2>
      {error && (
        <div
          className="mt-3 flex items-center justify-between gap-3 text-sm"
          role="alert"
        >
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {t("Retry", "إعادة المحاولة")}
          </Button>
        </div>
      )}
      {!data && !error && <Skeleton className="mt-4 h-24 rounded-xl" />}
      {data && (
        <>
          <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">{t("Plan", "الاشتراك")}</p>
              <p className="mt-1 font-medium">
                {data.snapshot.plan === "premium"
                  ? "Premium"
                  : data.snapshot.plan === "standard"
                    ? "Standard"
                    : t("Free setup", "إعداد مجاني")}
                {data.environment === "sandbox" &&
                  ` · ${t("Sandbox", "تجريبي")}`}
              </p>
              {data.snapshot.plan && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.snapshot.billingInterval === "annual"
                    ? t("Paid yearly", "دفع سنوي")
                    : t("Paid monthly", "دفع شهري")}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">
                {t(
                  "Delivered this month / allowance",
                  "المسلّم هذا الشهر / الرصيد",
                )}
              </p>
              <p className="mt-1 tabular-nums">
                {data.snapshot.used} / {data.snapshot.included}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t(
                  "Recorded AI tokens · last 30 days",
                  "رموز الذكاء المسجلة · آخر 30 يومًا",
                )}
              </p>
              <p className="mt-1 tabular-nums">
                {data.costs
                  .reduce((s, c) => s + c.input_tokens + c.output_tokens, 0)
                  .toLocaleString()}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {t(
              "Usage records are not provider invoices. AI tokens are measured; provider cost stays unpriced until confirmed. Recent records are bounded to 1,000 entries.",
              "سجلات الاستخدام ليست فواتير مزودي الخدمة. تُقاس الرموز وتبقى التكلفة غير مسعّرة حتى تأكيدها. العرض محدود بأحدث 1,000 سجل.",
            )}
          </p>
          {data.payments.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <h3 className="text-sm font-medium">
                {t("Recent confirmed payments", "الدفعات المؤكدة الأخيرة")}
              </h3>
              <div className="mt-2 divide-y">
                {data.payments.slice(0, 5).map((payment, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                  >
                    <span>
                      {payment.plan === "premium" ? "Premium" : "Standard"} ·{" "}
                      {payment.billing_interval === "annual"
                        ? t("Annual", "سنوي")
                        : t("Monthly", "شهري")}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Date(payment.paid_at).toLocaleDateString()}
                        {payment.refunded_halalas > 0
                          ? ` · ${t("Refund recorded", "استرداد مسجل")}`
                          : ""}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {(payment.amount_halalas / 100).toFixed(2)} SAR
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {canManage && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div>
                <p className="text-sm font-medium">
                  {t("Private first-month offer", "عرض خاص للشهر الأول")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    "SAR 99 Standard / SAR 199 Premium, then regular renewal. Never advertised publicly.",
                    "99 ريال Standard / 199 ريال Premium، ثم السعر المعتاد. لا يُعلن للعامة.",
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={
                  busy ||
                  data.snapshot.offerAvailable ||
                  saved ||
                  Boolean(data.snapshot.plan)
                }
                onClick={() => void grant()}
              >
                {busy ? (
                  <Spinner />
                ) : saved || data.snapshot.offerAvailable ? (
                  <Check className="size-4" />
                ) : null}
                {saved || data.snapshot.offerAvailable
                  ? t("Offer assigned", "تم تخصيص العرض")
                  : t("Assign private offer", "تخصيص عرض خاص")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
