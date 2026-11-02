"use client";
import Link from "next/link";
import { testDigits } from "@/lib/oto/return-contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  FileDown,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/desk/page-header";
import { Panel, TWEEN } from "@/components/desk/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Attempt = {
  id: string;
  stage: string;
  capHalalas: number;
  quoteHalalas: number;
  expiresAt: string;
  walletState: string | null;
  chargeHalalas: number | null;
  hasReturn: boolean;
  hasShipment: boolean;
  events: Array<{ stage: string; created_at: string }>;
};
type Review = {
  id: string;
  capHalalas: number;
  quoteHalalas: number;
  expiresAt: string;
  courierName: string;
};

export function ReturnTest() {
  const { workspace } = useAuth(),
    { t, isArabic } = useLanguage(),
    reduce = useReducedMotion(),
    store = workspace?.storeId;
  const [chargeReview, setChargeReview] = useState<{
    amountHalalas: number;
    capHalalas: number;
  } | null>(null);
  const [chargeConsent, setChargeConsent] = useState(false);
  const [canManage, setCanManage] = useState(true);
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState<string | null>(null),
    [review, setReview] = useState<Review | null>(null),
    [id, setId] = useState(""),
    [consent, setConsent] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [tracking, setTracking] = useState<string | null>(null);
  const [fields, setFields] = useState({
    name: "",
    email: "",
    phone: "",
    customerAddress: "",
    warehouseAddress: "",
    courierId: "2828",
    cap: "50",
  });
  const currentStore = useRef(store);
  currentStore.current = store;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const money = (v: number) =>
    new Intl.NumberFormat(isArabic ? "ar-SA-u-nu-latn" : "en-SA", {
      style: "currency",
      currency: "SAR",
    }).format(v / 100);
  const load = useCallback(async () => {
    if (!store) return;
    try {
      const r = await fetch("/api/shipping/returns?store=" + store, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "unavailable");
      if (currentStore.current === store && mounted.current) {
        setAttempt(b.attempt);
        setCanManage(b.canManage !== false);
        if (b.attempt?.stage === "DRAFT") setId(b.attempt.id);
        setError(null);
      }
    } catch (e) {
      if (currentStore.current === store && mounted.current)
        setError(e instanceof Error ? e.message : "unavailable");
    } finally {
      if (currentStore.current === store && mounted.current) setLoading(false);
    }
  }, [store]);
  useEffect(() => {
    setLoading(true);
    setAttempt(null);
    setReview(null);
    setConsent(false);
    setConfirmed(false);
    setTracking(null);
    setChargeReview(null);
    setChargeConsent(false);
    setError(null);
    setId(crypto.randomUUID());
    setFields({
      name: "",
      email: "",
      phone: "",
      customerAddress: "",
      warehouseAddress: "",
      courierId: "2828",
      cap: "50",
    });
    void load();
  }, [load]);
  const submitted = !!attempt && !["DRAFT", "EXPIRED"].includes(attempt.stage);
  const input = () => ({
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    customerAddress: fields.customerAddress,
    warehouseAddress: fields.warehouseAddress,
    courierId: fields.courierId,
    capHalalas: Math.round(Number(testDigits(fields.cap)) * 100),
    consent,
  });
  async function act(
    action: "prepare" | "submit" | "refresh" | "label" | "approveCharge",
  ) {
    if (busy || !store || !canManage) return;
    if (
      action === "prepare" &&
      (!consent ||
        !/^\d+(?:\.\d{1,2})?$/.test(testDigits(fields.cap)) ||
        Number(testDigits(fields.cap)) < 1 ||
        Number(testDigits(fields.cap)) > 10000)
    ) {
      setError("invalid_input");
      return;
    }
    if (
      action === "submit" &&
      review &&
      Date.parse(review.expiresAt) <= Date.now()
    ) {
      setReview(null);
      setConfirmed(false);
      setError("test_expired");
      return;
    }
    if (action === "submit" && (!review || !confirmed)) {
      setError("confirm_required");
      return;
    }
    if (action === "approveCharge" && (!chargeReview || !chargeConsent)) return;
    setBusy(action);
    setError(null);
    try {
      const r = await fetch("/api/shipping/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store,
          action,
          ...(action === "approveCharge"
            ? { amountHalalas: chargeReview!.amountHalalas }
            : {}),
          ...(["prepare", "submit"].includes(action)
            ? { id: review?.id || id, input: input() }
            : {}),
        }),
        signal: AbortSignal.timeout(170000),
      });
      if (currentStore.current !== store || !mounted.current) return;
      if (!r.ok) {
        let b;
        try {
          b = await r.json();
        } catch {}
        throw Error(b?.error || "unavailable");
      }
      if (action === "label") {
        const blob = await r.blob();
        if (blob.type !== "application/pdf") throw Error("label_unavailable");
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = "reload-sandbox-return.pdf";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const b = await r.json();
        if (action === "prepare") {
          setReview(b);
          setConfirmed(false);
        } else {
          setAttempt(b.attempt);
          setReview(null);
          setTracking(b.tracking?.status || null);
          setChargeReview(b.chargeReview || null);
          setChargeConsent(false);
        }
      }
    } catch (e) {
      if (currentStore.current !== store || !mounted.current) return;
      setError(e instanceof Error ? e.message : "unavailable");
      if (action === "submit") {
        setReview(null);
        await load();
      }
    } finally {
      if (currentStore.current === store && mounted.current) setBusy(null);
    }
  }
  const messages: Record<string, string> = {
    charge_changed: t(
      "The recorded charge changed. Check progress again before approving the exact amount.",
      "تغيرت التكلفة المسجلة. تحقق من التقدم مجددًا قبل اعتماد المبلغ المحدد.",
    ),
    provider_funds_required: t(
      "Reload’s OTO sandbox balance needs test shipping credit. Your Reload shipping balance is unchanged. Ask Reload support to fund the OTO test account; do not make a live payment.",
      "يحتاج حساب أوتو التجريبي لدى ريلود إلى رصيد شحن تجريبي. لم يتغير رصيد الشحن في ريلود. اطلب من دعم ريلود تمويل حساب أوتو التجريبي، ولا تدفع مبلغًا فعليًا.",
    ),
    test_expired: t(
      "Your quote expired. Review your details again to get a fresh quote.",
      "انتهت صلاحية السعر. راجع التفاصيل مجددًا للحصول على سعر جديد.",
    ),
    disabled: t(
      "Return tests are not enabled here yet.",
      "لم تُفعّل اختبارات الإرجاع هنا بعد.",
    ),
    access_denied: t(
      "Sign in to this store with owner or admin access.",
      "سجّل الدخول إلى هذا المتجر بصلاحية مالك أو مسؤول.",
    ),
    invalid_input: t(
      "Check the contact details, full Riyadh addresses and maximum charge. Confirm that you control these test contacts.",
      "تحقق من بيانات التواصل وعناوين الرياض الكاملة والحد الأقصى للتكلفة، وأكد أنك تتحكم ببيانات التواصل التجريبية.",
    ),
    above_cap: t(
      "The latest return quote is above your limit or unavailable. Review the amount before continuing.",
      "سعر الإرجاع الحالي أعلى من حدك أو غير متاح. راجع المبلغ قبل المتابعة.",
    ),
    courier_unavailable: t(
      "This test courier has no confirmed return quote. Choose another test courier.",
      "لا يتوفر سعر إرجاع مؤكد لهذا الناقل التجريبي. اختر ناقلًا تجريبيًا آخر.",
    ),
    funding_or_access: t(
      "Check your available test shipping balance and active Premium subscription, then refresh before trying again.",
      "تحقق من رصيد الشحن التجريبي المتاح واشتراك بريميوم الساري، ثم حدّث الصفحة قبل المحاولة مجددًا.",
    ),
    booking_needs_checking: t(
      "OTO may have received this request. Your reserved funds stay held. Check this attempt; do not start another booking.",
      "قد يكون أوتو استلم الطلب. يبقى المبلغ محجوزًا. تحقق من هذه العملية ولا تبدأ حجزًا آخر.",
    ),
    selection_changed: t(
      "The details changed. Review them again before booking.",
      "تغيرت التفاصيل. راجعها مجددًا قبل الحجز.",
    ),
    label_unavailable: t(
      "The return label is not ready or could not be verified. Check progress and try again.",
      "بوليصة الإرجاع غير جاهزة أو تعذر التحقق منها. تحقق من التقدم ثم حاول مجددًا.",
    ),
    confirm_required: t(
      "Confirm the test booking after reviewing the details.",
      "أكد الحجز التجريبي بعد مراجعة التفاصيل.",
    ),
  };
  const stageLabel = (s: string) =>
    ({
      DRAFT: t("Details reviewed", "تمت مراجعة التفاصيل"),
      WAREHOUSE_CREATING: t(
        "Creating the test warehouse",
        "جارٍ إنشاء المستودع التجريبي",
      ),
      WAREHOUSE_READY: t("Test warehouse saved", "تم حفظ المستودع التجريبي"),
      ORDER_CREATING: t(
        "Creating the return-only order",
        "جارٍ إنشاء طلب مخصص للإرجاع",
      ),
      ORDER_READY: t("Return-only order saved", "تم حفظ طلب الإرجاع"),
      RETURN_CREATING: t(
        "Requesting the return courier",
        "جارٍ طلب ناقل الإرجاع",
      ),
      CHARGE_INCREASE_APPROVED: t(
        "Additional test charge approved",
        "تم اعتماد التكلفة التجريبية الإضافية",
      ),
      RETURN_REQUESTED: t(
        "Waiting for OTO’s return confirmation",
        "بانتظار تأكيد الإرجاع من أوتو",
      ),
      RETURN_SAVED: t(
        "Return request saved with OTO",
        "تم حفظ طلب الإرجاع لدى أوتو",
      ),
    })[s] || t("Checking this step", "جارٍ التحقق من هذه الخطوة");
  const trackingLabel = (s: string) =>
    ({
      preparing: t("Preparing", "قيد التجهيز"),
      booked: t("Shipment created", "تم إنشاء الشحنة"),
      collected: t("Collected by the courier", "تم الاستلام بواسطة الناقل"),
      in_transit: t("In transit", "في الطريق"),
      delivered: t("Delivered by the courier", "تم التسليم بواسطة الناقل"),
      cancelled: t("Cancelled", "ملغي"),
      needs_attention: t("Needs attention", "بحاجة إلى متابعة"),
      checking: t("Status needs checking", "الحالة بحاجة إلى تحقق"),
    })[s] || t("Status needs checking", "الحالة بحاجة إلى تحقق");
  const change = (key: keyof typeof fields, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setReview(null);
    setConfirmed(false);
  };
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        icon={Package}
        title={t("Try a return shipment", "جرّب شحنة إرجاع")}
      >
        {t(
          "One sample return, from your test customer to your test warehouse.",
          "عملية إرجاع تجريبية واحدة من عميلك التجريبي إلى مستودعك التجريبي.",
        )}
      </PageHeader>
      <div className="flex gap-3 rounded-2xl border border-review/25 bg-review/10 p-4 text-sm leading-6">
        <ShieldCheck className="mt-1 size-4 shrink-0" />
        <p>
          {t(
            "Sandbox only. No real courier is booked. This test uses Riyadh, one sample pair of shoes and a 1 kg parcel (30 × 20 × 12 cm). Enter contact details you control; OTO may send test notifications.",
            "بيئة تجريبية فقط، دون حجز ناقل فعلي. يستخدم الاختبار مدينة الرياض وحذاءً تجريبيًا واحدًا وطردًا بوزن 1 كجم (30 × 20 × 12 سم). أدخل بيانات تواصل تتحكم بها؛ قد يرسل أوتو إشعارات تجريبية.",
          )}
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6"
        >
          <TriangleAlert className="mt-1 size-4 shrink-0" />
          <p>
            {messages[error] ||
              t(
                "We couldn’t confirm this step. Refresh the saved attempt before trying again. No unconfirmed amount is marked as spent.",
                "تعذر تأكيد هذه الخطوة. حدّث العملية المحفوظة قبل المحاولة مجددًا. لا يُسجل مبلغ غير مؤكد كمصروف.",
              )}
          </p>
        </div>
      )}
      {!canManage && (
        <p className="rounded-2xl border p-4 text-sm">
          {t(
            "A store owner or admin can run return-shipping tests. You can view the saved progress here.",
            "يمكن لمالك المتجر أو المسؤول إجراء اختبارات شحن الإرجاع. يمكنك الاطلاع على التقدم المحفوظ هنا.",
          )}
        </p>
      )}
      {loading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : submitted ? (
        <Panel title={t("Your test return", "عملية الإرجاع التجريبية")}>
          <ol className="space-y-4">
            {[...new Set(attempt.events.map((e) => e.stage))].map((stage) => (
              <li key={stage} className="flex gap-3 text-sm">
                {stage.endsWith("CREATING") ? (
                  <span
                    className={
                      "mt-1.5 size-2 shrink-0 rounded-full " +
                      (stage === attempt.stage
                        ? "bg-review"
                        : "bg-muted-foreground/40")
                    }
                  />
                ) : (
                  <Check className="mt-0.5 size-4 shrink-0 text-eligible" />
                )}
                <span>
                  {stageLabel(stage)}
                  {attempt.events.find((e) => e.stage === stage)
                    ?.created_at && (
                    <time className="ms-2 text-xs text-muted-foreground">
                      {new Date(
                        attempt.events.find((e) => e.stage === stage)!
                          .created_at,
                      ).toLocaleTimeString(isArabic ? "ar-SA" : "en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm font-medium">
            {stageLabel(attempt.stage)}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {attempt.walletState === "BOOKED"
              ? t(
                  `Confirmed shipping cost: ${money(attempt.chargeHalalas || 0)}. The unused reservation is available again.`,
                  `تكلفة الشحن المؤكدة: ${money(attempt.chargeHalalas || 0)}. أصبح الجزء غير المستخدم من المبلغ المحجوز متاحًا مجددًا.`,
                )
              : t(
                  `${money(attempt.capHalalas)} stays reserved until the booking and actual charge are verified. Refresh checks the saved return without creating another shipment.`,
                  `يبقى ${money(attempt.capHalalas)} محجوزًا حتى التحقق من الحجز والتكلفة الفعلية. يتحقق التحديث من الإرجاع المحفوظ دون إنشاء شحنة أخرى.`,
                )}
          </p>
          {chargeReview && (
            <div className="mt-4 space-y-3 rounded-xl border border-review/30 bg-review/10 p-4 text-sm leading-6">
              <p className="font-medium">
                {t(
                  "The recorded charge needs your approval",
                  "التكلفة المسجلة بحاجة إلى موافقتك",
                )}
              </p>
              <p>
                {t(
                  `OTO recorded ${money(chargeReview.amountHalalas)}, above your ${money(chargeReview.capHalalas)} limit. We have not settled it from your Reload balance. Approving applies only to this existing sandbox shipment and does not create another booking.`,
                  `سجّل أوتو تكلفة ${money(chargeReview.amountHalalas)}، وهي أعلى من حدك ${money(chargeReview.capHalalas)}. لم تُخصم التكلفة من رصيد ريلود بعد. تنطبق الموافقة على هذه الشحنة التجريبية الحالية فقط ولا تنشئ حجزًا آخر.`,
                )}
              </p>
              {canManage && (
                <>
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={chargeConsent}
                      disabled={!!busy}
                      onCheckedChange={(v) => setChargeConsent(v === true)}
                    />
                    <span>
                      {t(
                        `I approve the total test charge of ${money(chargeReview.amountHalalas)}.`,
                        `أوافق على إجمالي التكلفة التجريبية البالغ ${money(chargeReview.amountHalalas)}.`,
                      )}
                    </span>
                  </label>
                  <Button
                    disabled={!!busy || !chargeConsent}
                    onClick={() => void act("approveCharge")}
                  >
                    {busy === "approveCharge"
                      ? t("Verifying the charge…", "جارٍ التحقق من التكلفة…")
                      : t(
                          "Approve this test charge",
                          "اعتماد هذه التكلفة التجريبية",
                        )}
                  </Button>
                </>
              )}
            </div>
          )}
          {tracking && (
            <p role="status" className="mt-3 text-sm">
              {trackingLabel(tracking)}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={!!busy || !canManage}
              onClick={() => void act("refresh")}
            >
              {busy === "refresh" ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {t("Check progress", "التحقق من التقدم")}
            </Button>
            {attempt.hasShipment && (
              <Button
                variant="outline"
                disabled={!!busy || !canManage}
                onClick={() => void act("label")}
              >
                <FileDown className="size-4" />
                {t("Download return label", "تنزيل بوليصة الإرجاع")}
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {t(
              "Print the return label before collection. Courier delivery does not confirm merchant inspection or a customer refund.",
              "اطبع بوليصة الإرجاع قبل الاستلام. تسليم الناقل لا يعني تأكيد فحص التاجر للمنتج أو استرداد العميل للمبلغ.",
            )}
          </p>
        </Panel>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={review ? "review" : "details"}
            initial={{ opacity: 0, y: reduce ? 0 : 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={TWEEN}
          >
            {review ? (
              <Panel title={t("Review before booking", "راجع قبل الحجز")}>
                <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 text-sm sm:grid-cols-2">
                  {[
                    [t("Test courier", "الناقل التجريبي"), review.courierName],
                    [
                      t("Estimated shipping fee", "رسوم الشحن التقديرية"),
                      money(review.quoteHalalas),
                    ],
                    [
                      t(
                        "Maximum reserved amount",
                        "الحد الأقصى للمبلغ المحجوز",
                      ),
                      money(review.capHalalas),
                    ],
                    [
                      t("Route", "المسار"),
                      t("Riyadh → Riyadh", "الرياض ← الرياض"),
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="mt-1 break-words font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {t(
                    "The estimate is not a final charge. We reserve your approved maximum and settle only a verified OTO charge within it. Your test contact and address details are sent to OTO for this booking.",
                    "التقدير ليس تكلفة نهائية. نحجز الحد الأقصى الذي وافقت عليه، ولا نخصم إلا رسوم أوتو المتحقق منها ضمن هذا الحد. تُرسل بيانات التواصل والعنوان التجريبية إلى أوتو لهذا الحجز.",
                  )}
                </p>
                <label className="mt-5 flex items-start gap-3 text-sm leading-6">
                  <Checkbox
                    checked={confirmed}
                    disabled={!!busy || !canManage}
                    onCheckedChange={(v) => setConfirmed(v === true)}
                  />
                  <span>
                    {t(
                      "I approve one sandbox return booking and this maximum reservation.",
                      "أوافق على حجز إرجاع تجريبي واحد وعلى الحد الأقصى للمبلغ المحجوز.",
                    )}
                  </span>
                </label>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    disabled={!!busy || !canManage || !confirmed}
                    onClick={() => void act("submit")}
                  >
                    {busy === "submit" && (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    )}
                    {busy === "submit"
                      ? t("Saving your return…", "جارٍ حفظ الإرجاع…")
                      : t("Confirm test booking", "تأكيد الحجز التجريبي")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!!busy || !canManage}
                    onClick={() => {
                      setReview(null);
                      setConfirmed(false);
                    }}
                  >
                    {t("Edit details", "تعديل التفاصيل")}
                  </Button>
                </div>
              </Panel>
            ) : (
              <Panel
                title={t(
                  "Test contact and addresses",
                  "بيانات التواصل والعناوين التجريبية",
                )}
              >
                <form
                  className="space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act("prepare");
                  }}
                >
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t(
                      "Use one contact you control for both ends of this test. Addresses must be in Riyadh. Reload does not save these contact or address fields in the test record.",
                      "استخدم جهة تواصل واحدة تتحكم بها لطرفي الاختبار. يجب أن تكون العناوين في الرياض. لا يحفظ ريلود حقول التواصل أو العناوين هذه في سجل الاختبار.",
                    )}
                  </p>
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                    {(
                      [
                        "name",
                        "email",
                        "phone",
                        "customerAddress",
                        "warehouseAddress",
                      ] as const
                    ).map((key) => (
                      <div
                        key={key}
                        className={
                          "min-w-0 space-y-2 " +
                          (key.includes("Address") ? "sm:col-span-2" : "")
                        }
                      >
                        <label
                          htmlFor={"return-" + key}
                          className="text-sm font-medium"
                        >
                          {
                            {
                              name: t("Contact name", "اسم جهة التواصل"),
                              email: t("Contact email", "البريد الإلكتروني"),
                              phone: t(
                                "Saudi mobile number",
                                "رقم الجوال السعودي",
                              ),
                              customerAddress: t(
                                "Customer collection address · Riyadh",
                                "عنوان الاستلام من العميل · الرياض",
                              ),
                              warehouseAddress: t(
                                "Return warehouse address · Riyadh",
                                "عنوان مستودع الإرجاع · الرياض",
                              ),
                            }[key]
                          }
                        </label>
                        <Input
                          id={"return-" + key}
                          type={
                            key === "email"
                              ? "email"
                              : key === "phone"
                                ? "tel"
                                : "text"
                          }
                          autoComplete="off"
                          value={fields[key]}
                          onChange={(e) => change(key, e.target.value)}
                          disabled={!!busy || !canManage}
                          required
                          minLength={
                            key.includes("Address")
                              ? 12
                              : key === "name"
                                ? 2
                                : undefined
                          }
                          maxLength={
                            key.includes("Address")
                              ? 300
                              : key === "phone"
                                ? 25
                                : key === "email"
                                  ? 254
                                  : 80
                          }
                          className="h-11 rounded-xl"
                        />
                        {key === "phone" && (
                          <p className="text-xs text-muted-foreground">
                            {t("For example: 05xxxxxxxx", "مثال: 05xxxxxxxx")}
                          </p>
                        )}
                      </div>
                    ))}
                    <div className="min-w-0 space-y-2">
                      <label
                        htmlFor="return-courier"
                        className="text-sm font-medium"
                      >
                        {t("Test courier", "الناقل التجريبي")}
                      </label>
                      <Select
                        value={fields.courierId}
                        onValueChange={(v) => change("courierId", v)}
                        disabled={!!busy || !canManage}
                      >
                        <SelectTrigger
                          id="return-courier"
                          className="w-full rounded-xl"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            ["2828", "SMSA Express"],
                            ["56468", "SMSA Bullet"],
                            ["56469", "SMSA Same Day"],
                          ].map(([v, label]) => (
                            <SelectItem key={v} value={v}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="return-cap"
                        className="text-sm font-medium"
                      >
                        {t(
                          "Maximum approved charge (SAR)",
                          "الحد الأقصى المعتمد للتكلفة (ريال)",
                        )}
                      </label>
                      <Input
                        id="return-cap"
                        value={fields.cap}
                        onChange={(e) => change("cap", e.target.value)}
                        inputMode="decimal"
                        maxLength={8}
                        disabled={!!busy || !canManage}
                        required
                        className="h-11 rounded-xl"
                      />
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t(
                          "This amount must be available in your test shipping balance. No Reload fee is added.",
                          "يجب أن يتوفر هذا المبلغ في رصيد الشحن التجريبي. لا تُضاف رسوم لريلود.",
                        )}
                      </p>
                    </div>
                  </div>
                  <label className="flex items-start gap-3 text-sm leading-6">
                    <Checkbox
                      checked={consent}
                      disabled={!!busy || !canManage}
                      onCheckedChange={(v) => setConsent(v === true)}
                    />
                    <span>
                      {t(
                        "I control these contact details and approve test notifications from OTO.",
                        "أتحكم ببيانات التواصل هذه وأوافق على إشعارات أوتو التجريبية.",
                      )}
                    </span>
                  </label>
                  <Button
                    type="submit"
                    disabled={!!busy || !canManage || !consent}
                  >
                    {busy === "prepare" && (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    )}
                    {busy === "prepare"
                      ? t("Checking your test…", "جارٍ التحقق من الاختبار…")
                      : t("Review test return", "مراجعة الإرجاع التجريبي")}
                  </Button>
                </form>
              </Panel>
            )}
          </motion.div>
        </AnimatePresence>
      )}
      <Link
        href="/app/shipping"
        className="inline-flex text-sm text-muted-foreground underline underline-offset-4"
      >
        {t("Back to shipping balance", "العودة إلى رصيد الشحن")}
      </Link>
    </div>
  );
}
