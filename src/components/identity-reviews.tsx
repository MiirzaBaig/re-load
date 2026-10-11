"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Review = { id: string; order_number: string; requester_phone: string; created_at: string };

export function IdentityReviews() {
  const { workspace } = useAuth();
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const storeId = workspace?.storeId;
  const canReview = workspace?.role === "owner" || workspace?.role === "admin";

  useEffect(() => {
    if (!storeId || !canReview) return;
    let active = true;
    const load = async () => {
      const client = getSupabaseBrowserClient();
      if (!client) return;
      const result = await client.from("identity_reviews").select("id,order_number,requester_phone,created_at")
        .eq("store_id", storeId).eq("status", "PENDING").order("created_at", { ascending: true }).limit(50);
      if (!active) return;
      setError(Boolean(result.error));
      if (!result.error) setReviews(result.data ?? []);
    };
    setReviews([]);
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [storeId, canReview, refresh]);

  async function resolve(review: Review, action: "approve" | "decline") {
    const client = getSupabaseBrowserClient();
    if (!client || busy) return;
    setBusy(review.id);
    try {
      const { data, error } = await client.functions.invoke("whatsapp-identity-review", {
        body: { reviewId: review.id, action, verifier: contacts[review.id], reviewNote: notes[review.id], confirmedIdentity: confirmed[review.id] === true },
      });
      if (error || !data?.resolved) throw new Error("review_failed");
      setReviews((current) => current.filter((entry) => entry.id !== review.id));
      setContacts((current) => { const next = { ...current }; delete next[review.id]; return next; });
      toast.success(data.notification === "sent"
        ? t("Saved. The customer has been notified on WhatsApp.", "تم الحفظ وإبلاغ العميل على واتساب.")
        : t("Saved. Ask the customer to tap Continue in WhatsApp.", "تم الحفظ. اطلب من العميل الضغط على «متابعة» في واتساب."));
    } catch {
      toast.error(t("Couldn’t save. Check the order’s original contact details and try again.", "تعذّر الحفظ. راجع بيانات التواصل المسجلة في الطلب وحاول مرة ثانية."));
    } finally { setBusy(null); }
  }

  if (!canReview || (!reviews.length && !error)) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="identity-review-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-muted-foreground" aria-hidden="true" />
          <h2 id="identity-review-title" className="font-medium">{t("Customer identity checks", "التحقق من هوية العملاء")}</h2>
          {reviews.length > 0 && <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums">{reviews.length}</span>}
        </div>
        <Button size="icon" variant="ghost" onClick={() => setRefresh((value) => value + 1)} aria-label={t("Refresh identity checks", "تحديث طلبات التحقق")}><RefreshCw className="size-4" /></Button>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("These customers couldn’t verify with their WhatsApp number. Confirm who they are before allowing access to the order. This does not approve a return or refund.", "لم نتمكن من التحقق من هؤلاء العملاء برقم واتساب. تأكد من هويتهم قبل السماح بعرض الطلب. هذا الإجراء لا يعني الموافقة على الإرجاع أو رد المبلغ.")}</p>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{t("Identity checks couldn’t load. Try refreshing.", "تعذّر تحميل طلبات التحقق. حاول التحديث.")}</p>}
      <div className="mt-4 divide-y divide-border">
        {reviews.map((review) => (
          <div key={review.id} className="space-y-3 py-4 first:pt-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">{t("Order", "الطلب")} <bdi>{review.order_number}</bdi></span>
              <span className="text-muted-foreground">{t("Requesting number", "رقم مقدم الطلب")}: <bdi>+{review.requester_phone}</bdi></span>
            </div>
            <label className="block max-w-md space-y-1.5 text-sm">
              <span>{t("Email or phone recorded on this order", "البريد أو الجوال المسجل في هذا الطلب")}</span>
              <Input dir="ltr" autoComplete="off" value={contacts[review.id] ?? ""} onChange={(event) => setContacts((current) => ({ ...current, [review.id]: event.target.value }))} />
            </label>
            <label className="block max-w-md space-y-1.5 text-sm">
              <span>{t("How did you confirm their identity?", "كيف تأكدت من هوية العميل؟")}</span>
              <Input maxLength={500} placeholder={t("For example: confirmed through our existing support conversation", "مثلًا: تأكدت من خلال محادثته السابقة مع دعم المتجر")} value={notes[review.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))} />
            </label>
            <label className="flex items-start gap-2 text-sm leading-5">
              <input type="checkbox" className="mt-1 size-4 accent-foreground" checked={confirmed[review.id] ?? false} onChange={(event) => setConfirmed((current) => ({ ...current, [review.id]: event.target.checked }))} />
              {t("I checked that this requester owns this order.", "تحققت من أن مقدم الطلب هو صاحب هذا الطلب.")}
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={Boolean(busy) || !confirmed[review.id] || !contacts[review.id]?.trim() || (notes[review.id]?.trim().length ?? 0) < 5} onClick={() => void resolve(review, "approve")}>
                {busy === review.id && <Loader2 className="size-4 animate-spin" />}{t("Allow continuation", "السماح بالمتابعة")}
              </Button>
              <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void resolve(review, "decline")}>{t("Decline verification", "رفض التحقق")}</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
