"use client";
import Link from "next/link";
import {
  ShippingParcelForm,
  type ParcelProfile,
} from "@/components/shipping-parcel-form";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  Pause,
  Plus,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Truck,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/desk/page-header";
import { Metric, TWEEN } from "@/components/desk/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shippingTestCouriers } from "@/lib/shipping/settings-contract";
import { testDigits } from "@/lib/oto/return-contract";

type Form = {
  warehouseId: string;
  courierIds: string[];
  collectionMethod: string;
  cap: string;
  automaticRequested: boolean;
};
type Snapshot = {
  parcels?: ParcelProfile[];
  improvements?: Array<{ reason: string; count: number }>;
  canManage: boolean;
  premium: boolean;
  providerReady: boolean;
  policyReady: boolean;
  policyChanged: boolean;
  warehouseChanged: boolean;
  automationActive: false;
  settings: null | {
    version: number;
    warehouse_id: string;
    courier_ids: string[];
    collection_method: string;
    cap_halalas: number;
    automatic_requested: boolean;
    state: "DRAFT" | "APPROVED" | "PAUSED";
    approved_at: string | null;
  };
  warehouses: Array<{
    id: string;
    name: string;
    city: string;
    address?: string;
  }>;
  pendingWarehouse: null | { id: string; state: string };
  wallet: {
    availableHalalas: number;
    reservedHalalas: number;
    onHold: boolean;
    unconfirmed: number;
  };
  history: Array<{ version: number; event: string; createdAt: string }>;
};
const blank: Form = {
  warehouseId: "",
  courierIds: [],
  collectionMethod: "PICKUP_BY_DC",
  cap: "50",
  automaticRequested: false,
};
const warehouseBlank = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  city: "Riyadh",
  address: "",
};
function fromSnapshot(d: Snapshot): Form {
  const s = d.settings;
  return s
    ? {
        warehouseId: s.warehouse_id,
        courierIds: s.courier_ids,
        collectionMethod: s.collection_method,
        cap: String(s.cap_halalas / 100),
        automaticRequested: s.automatic_requested,
      }
    : { ...blank };
}
export function ShippingSettings() {
  const { workspace } = useAuth(),
    { t, isArabic } = useLanguage(),
    reduce = useReducedMotion(),
    store = workspace?.storeId;
  const [data, setData] = useState<Snapshot | null>(null),
    [form, setForm] = useState<Form>({ ...blank }),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<string | null>(null),
    // Where the error came from, so it shows next to that action instead of
    // at the top of the page. null = page level (loading).
    [errorAt, setErrorAt] = useState<string | null>(null),
    [touched, setTouched] = useState<Record<string, boolean>>({}),
    [tried, setTried] = useState(false),
    [busy, setBusy] = useState<string | null>(null),
    [saved, setSaved] = useState<string | null>(null),
    [approval, setApproval] = useState(false),
    [warehouseOpen, setWarehouseOpen] = useState(false),
    [warehouse, setWarehouse] = useState({ ...warehouseBlank }),
    [warehouseConsent, setWarehouseConsent] = useState(false),
    [warehouseId, setWarehouseId] = useState("");
  const current = useRef(store),
    lock = useRef(false),
    controller = useRef<AbortController | null>(null);
  current.current = store;
  const hydrate = (value: Snapshot, reset = true) => {
    setData(value);
    if (reset) {
      setForm(fromSnapshot(value));
      setDirty(false);
      setApproval(false);
    }
    if (value.pendingWarehouse) setWarehouseId(value.pendingWarehouse.id);
  };
  const load = useCallback(
    async (reset = true) => {
      if (!store) return;
      controller.current?.abort();
      const c = new AbortController();
      controller.current = c;
      try {
        const r = await fetch("/api/shipping/settings?store=" + store, {
          cache: "no-store",
          signal: AbortSignal.any([c.signal, AbortSignal.timeout(90000)]),
        });
        const b = await r.json();
        if (c.signal.aborted || current.current !== store) return;
        if (!r.ok) throw Error(b.error || "unavailable");
        hydrate(b, reset);
        setError(null);
      } catch (e) {
        if (!c.signal.aborted && current.current === store) {
          setErrorAt(null);
          setError(e instanceof Error ? e.message : "unavailable");
        }
      }
    },
    [store],
  );
  useEffect(() => {
    lock.current = false;
    setBusy(null);
    setData(null);
    setForm({ ...blank });
    setDirty(false);
    setApproval(false);
    setError(null);
    setSaved(null);
    setWarehouse({ ...warehouseBlank });
    setWarehouseConsent(false);
    setWarehouseOpen(false);
    setWarehouseId(crypto.randomUUID());
    void load();
    return () => controller.current?.abort();
  }, [load]);
  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setApproval(false);
    setSaved(null);
  }
  function move(index: number, delta: number) {
    const ids = [...form.courierIds],
      to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    change("courierIds", ids);
  }
  const cap = Number(testDigits(form.cap)),
    version = data?.settings?.version || 0,
    selected = data?.warehouses.find((w) => w.id === form.warehouseId);
  async function act(
    action: "save" | "approve" | "pause" | "warehouse" | "recoverWarehouse",
  ) {
    if (lock.current || !store || !data?.canManage) return;
    if (
      action === "save" &&
      (!form.warehouseId ||
        !form.courierIds.length ||
        !/^\d+(?:\.\d{1,2})?$/.test(testDigits(form.cap)) ||
        cap < 1 ||
        cap > 10000)
    ) {
      setErrorAt(action);
      setError("invalid_input");
      return;
    }
    if (action === "approve" && (dirty || !approval)) return;
    if (
      (action === "warehouse" || action === "recoverWarehouse") &&
      !warehouseConsent
    ) {
      setErrorAt(action);
      setError("warehouse_consent");
      return;
    }
    lock.current = true;
    setBusy(action);
    setError(null);
    setSaved(null);
    try {
      const r = await fetch("/api/shipping/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store,
          action,
          ...(action === "save"
            ? {
                input: {
                  version,
                  warehouseId: form.warehouseId,
                  courierIds: form.courierIds,
                  collectionMethod: form.collectionMethod,
                  capHalalas: Math.round(cap * 100),
                  automaticRequested: form.automaticRequested,
                },
              }
            : action === "warehouse" || action === "recoverWarehouse"
              ? {
                  id: warehouseId,
                  input: { ...warehouse, consent: warehouseConsent },
                }
              : { version }),
        }),
        signal: AbortSignal.timeout(145000),
      });
      const b = await r.json();
      if (current.current !== store) return;
      if (!r.ok) throw Error(b.error || "unavailable");
      hydrate(b, !["warehouse", "recoverWarehouse"].includes(action));
      setSaved(action);
      if (action === "warehouse" || action === "recoverWarehouse") {
        setWarehouseOpen(false);
        setWarehouse({ ...warehouseBlank });
        setWarehouseConsent(false);
        setWarehouseId(crypto.randomUUID());
        setTouched({});
        setTried(false);
      }
    } catch (e) {
      if (current.current !== store) return;
      const code = e instanceof Error ? e.message : "unavailable";
      if (action === "warehouse" || action === "recoverWarehouse") {
        await load(false);
        setErrorAt(action);
        setError(code);
      } else {
        setErrorAt(action);
        setError(code);
      }
    } finally {
      if (current.current === store) {
        lock.current = false;
        setBusy(null);
      }
    }
  }
  // Same rules the server applies, checked as the merchant types.
  const phoneDigits = testDigits(warehouse.phone).replace(/[\s()+-]/g, "").replace(/^00966/, "966").replace(/^0(?=5)/, "966");
  const warehouseIssues: Partial<Record<keyof typeof warehouseBlank, string>> = {
    ...(warehouse.name.trim().length < 2 ? { name: t("Enter the warehouse name.", "اكتب اسم المستودع.") } : {}),
    ...(warehouse.contactName.trim().length < 2 ? { contactName: t("Enter the contact person’s name.", "اكتب اسم الشخص المسؤول.") } : {}),
    ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(warehouse.email.trim()) ? { email: t("Enter a valid email, like name@store.com.", "اكتب بريدًا صحيحًا، مثل name@store.com.") } : {}),
    ...(!/^9665\d{8}$/.test(phoneDigits) ? { phone: t("Use a Saudi mobile: 05 followed by 8 digits (10 in total).", "استخدم جوالًا سعوديًا: 05 ثم 8 أرقام (10 أرقام).") } : {}),
    ...(warehouse.address.trim().length < 12 ? { address: t("Add the full address: street, district and city.", "اكتب العنوان كاملًا: الشارع والحي والمدينة.") } : {}),
  };
  const showIssue = (key: keyof typeof warehouseBlank) => (touched[key] || tried) ? warehouseIssues[key] : undefined;
  const messages: Record<string, string> = {
    warehouse_input_invalid: t(
      "Check the warehouse name, contact name, valid email, Saudi mobile and full address. Confirm permission to use these test contacts.",
      "تحقق من اسم المستودع وجهة التواصل والبريد الصحيح والجوال السعودي والعنوان الكامل، وأكد السماح باستخدام بيانات التواصل التجريبية.",
    ),
    disabled: t(
      "Shipping settings are not enabled here yet.",
      "لم تُفعّل إعدادات الشحن هنا بعد.",
    ),
    access_denied: t(
      "Sign in to this store with permission to manage shipping.",
      "سجّل الدخول إلى هذا المتجر بحساب مخوّل لإدارة الشحن.",
    ),
    premium_required: t(
      "An active Premium test subscription is needed to change or approve shipping settings. You can still pause an existing approval.",
      "يلزم اشتراك بريميوم تجريبي ساري لتغيير إعدادات الشحن أو اعتمادها. يمكنك إيقاف موافقة سابقة مؤقتًا.",
    ),
    invalid_input: t(
      "Choose a verified warehouse and at least one courier. Enter a limit from SAR 1 to SAR 10,000.",
      "اختر مستودعًا متحققًا منه وناقلًا واحدًا على الأقل. أدخل حدًا من 1 إلى 10,000 ريال.",
    ),
    warehouse_required: t(
      "This warehouse could not be verified with OTO. Refresh its details before approving.",
      "تعذر التحقق من هذا المستودع لدى أوتو. حدّث تفاصيله قبل الاعتماد.",
    ),
    settings_changed: t(
      "Someone changed these settings in another tab. Your edits are still here. Select Load latest settings to replace them with the saved version.",
      "تغيرت الإعدادات في نافذة أخرى. تعديلاتك ما زالت هنا. اختر تحميل آخر إعدادات لاستبدالها بالنسخة المحفوظة.",
    ),
    policy_required: t(
      "Publish your return policy before approving automatic returns.",
      "انشر سياسة الإرجاع قبل اعتماد الإرجاع التلقائي.",
    ),
    wallet_on_hold: t(
      "Your shipping wallet needs review. Resolve the hold before approving.",
      "رصيد الشحن بحاجة إلى مراجعة. عالج التعليق قبل الاعتماد.",
    ),
    courier_unavailable: t(
      "A selected courier does not currently support this collection method on the test route. Try another courier or collection method.",
      "أحد الناقلين المختارين لا يدعم حاليًا طريقة الاستلام هذه للمسار التجريبي. جرّب ناقلًا أو طريقة استلام أخرى.",
    ),
    warehouse_pending: t(
      "The warehouse request is saved but not confirmed. Keep the same details and use Check warehouse. We will not create a second warehouse.",
      "طلب المستودع محفوظ لكنه غير مؤكد. احتفظ بالتفاصيل نفسها واختر التحقق من المستودع. لن ننشئ مستودعًا ثانيًا.",
    ),
    warehouse_consent: t(
      "Confirm that you control these contact details and allow OTO test notifications.",
      "أكد أنك تتحكم ببيانات التواصل وتسمح بإشعارات أوتو التجريبية.",
    ),
    warehouse_request_mismatch: t(
      "These details do not match the saved warehouse request. Re-enter the original details to check it.",
      "هذه التفاصيل لا تطابق طلب المستودع المحفوظ. أعد إدخال التفاصيل الأصلية للتحقق منه.",
    ),
  };
  const money = (n: number) =>
    new Intl.NumberFormat(isArabic ? "ar-SA-u-nu-latn" : "en-SA", {
      style: "currency",
      currency: "SAR",
    }).format(n / 100);
  const disabled = !!busy || !data?.canManage || !data?.premium;
  // ── Step-flow layout (2026-11-02). Previous layout: src/views/shipping-settings-v1.tsx.
  const capValid = /^\d+(?:\.\d{1,2})?$/.test(testDigits(form.cap)) && cap >= 1 && cap <= 10000;
  const approvedNow = data?.settings?.state === "APPROVED" && !dirty && !data.policyChanged && !data.warehouseChanged;
  const stepsDone = [Boolean(selected), form.courierIds.length > 0, capValid, approvedNow];
  const doneCount = stepsDone.filter(Boolean).length;
  // One step open at a time: the first unfinished one, unless the merchant
  // picked another. Finished steps fold into a one-line summary.
  const [chosenStep, setChosenStep] = useState<number | null>(null);
  const firstOpen = stepsDone.findIndex((d) => !d);
  const openStep = chosenStep ?? (firstOpen === -1 ? 3 : firstOpen);
  const goTo = (i: number) => setChosenStep(i);
  const courierName = (id: string) => shippingTestCouriers.find((c) => c.id === id)?.name ?? id;
  // OTO stores the city in English; show the three cities we offer in Arabic too.
  const cityName = (c: string) =>
    ({ Riyadh: t("Riyadh", "الرياض"), Jeddah: t("Jeddah", "جدة"), Dammam: t("Dammam", "الدمام") } as Record<string, string>)[c] ?? c;
  const warehouseName = (w: { name: string }) =>
    w.name === "Test return warehouse" ? t("Test return warehouse", "مستودع الإرجاع التجريبي") : w.name;
  // Successes appear as a toast as well as inline.
  useEffect(() => {
    if (!saved) return;
    toast.success(
      saved === "approve"
        ? t("Shipping settings approved", "تم اعتماد إعدادات الشحن")
        : saved === "pause"
          ? t("Approval paused", "تم إيقاف الموافقة مؤقتًا")
          : saved === "warehouse" || saved === "recoverWarehouse"
            ? t("Warehouse verified", "تم التحقق من المستودع")
            : t("Settings saved", "تم حفظ الإعدادات"),
    );
  }, [saved, t]);
  const status =
    data?.settings?.state === "APPROVED"
      ? { tone: "ok", label: t("Approved · bookings not active", "معتمد · الحجوزات غير نشطة") }
      : data?.settings?.state === "PAUSED"
        ? { tone: "wait", label: t("Shipping approval paused", "موافقة الشحن متوقفة مؤقتًا") }
        : { tone: "idle", label: t("Not approved yet", "لم تُعتمد بعد") };
  return (
    <div className="ship-flow min-w-0 space-y-9 pb-24">
      <PageHeader
        icon={Truck}
        title={t("Shipping settings", "إعدادات الشحن")}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-review/30 bg-review-muted px-2.5 py-1 text-xs font-medium text-review">
            <span className="size-1.5 rounded-full bg-review" />
            {t("Test mode", "وضع تجريبي")}
          </span>
        }
      >
        {t(
          "Choose where returns go, your couriers and the most you approve per shipment.",
          "حدد وجهة المرتجعات والناقلين والحد الأقصى المعتمد لكل شحنة.",
        )}
      </PageHeader>

      {/* Sandbox note, as one quiet line. */}
      <p className="flex items-start gap-2.5 text-[13px] leading-6 text-muted-foreground">
        <ShieldCheck className="mt-1 size-4 shrink-0 text-review" />
        {t(
          "Test mode: approving these settings won’t book any real shipments yet.",
          "وضع تجريبي: اعتماد هذه الإعدادات لا يحجز أي شحنة فعلية حاليًا.",
        )}
      </p>

      <AnimatePresence initial={false}>
        {error && errorAt === null && (
          <motion.div
            key={error}
            role="alert"
            initial={{ opacity: 0, y: reduce ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={TWEEN}
            className="flex gap-3 overflow-hidden border-s-2 border-destructive ps-4 text-sm leading-6"
          >
            <TriangleAlert className="mt-1 size-4 shrink-0 text-destructive" />
            <p>
              {messages[error] ||
                t(
                  "We couldn’t confirm this step. Your edits are still here. Refresh before repeating an uncertain request.",
                  "تعذر تأكيد هذه الخطوة. تعديلاتك ما زالت هنا. حدّث الصفحة قبل تكرار طلب غير مؤكد.",
                )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          {error && (
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="size-4" />
              {t("Try again", "حاول مجددًا")}
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* ── Status and progress ── */}
          <section className="space-y-3" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    status.tone === "ok" ? "bg-eligible" : status.tone === "wait" ? "bg-review" : "bg-muted-foreground/40",
                  )}
                />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={status.label}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={TWEEN}
                    className="text-sm font-semibold"
                  >
                    {status.label}
                  </motion.p>
                </AnimatePresence>
                <span className="text-sm tabular-nums text-muted-foreground">
                  · {t(`${doneCount} of 4 steps`, `${doneCount} من 4 خطوات`)}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" disabled={!!busy} onClick={() => void load()}>
                <RefreshCw className={cn("size-3.5", busy === null ? "" : "")} />
                {t("Load latest settings", "تحميل آخر إعدادات")}
              </Button>
            </div>
            {/* One bar that fills with the number of finished steps (the old
                four segments lit up out of order, e.g. only the third). */}
            <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <motion.div
                className={cn("h-full rounded-full", doneCount === 4 ? "bg-eligible" : "bg-foreground")}
                initial={false}
                animate={{ width: `${(doneCount / 4) * 100}%` }}
                transition={{ ...TWEEN, duration: 0.6 }}
              />
            </div>
            {dirty && (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("You have unsaved changes. Save, then review and approve.", "لديك تعديلات غير محفوظة. احفظها ثم راجعها واعتمدها.")}
              </p>
            )}
          </section>

          {/* ── Only what needs fixing (all fine = nothing shown) ── */}
          {(!data.premium || !data.policyReady || !data.providerReady || data.wallet.onHold || !data.canManage || data.policyChanged || data.warehouseChanged) && (
            <ul className="space-y-2.5">
              {!data.premium && <ReadyItem ok={false} text={t("Shipping is a Premium feature.", "الشحن ميزة في باقة بريميوم.")} link={{ href: "/app/billing", label: t("View your plan", "عرض باقتك") }} />}
              {!data.policyReady && <ReadyItem ok={false} text={t("Publish your return policy first.", "انشر سياسة الإرجاع أولًا.")} link={{ href: "/app/policies", label: t("Open policies", "فتح السياسات") }} />}
              {!data.providerReady && <ReadyItem ok={false} text={t("We can’t reach OTO right now. Saving and approval wait until it’s back; you can still pause.", "ما نقدر نوصل لأوتو الآن. الحفظ والاعتماد ينتظران عودة الاتصال، ويمكنك الإيقاف المؤقت.")} />}
              {data.wallet.onHold && <ReadyItem ok={false} text={t("Your shipping balance is on hold and needs review.", "رصيد الشحن معلّق ويحتاج مراجعة.")} />}
              {!data.canManage && <ReadyItem ok={false} text={t("Only a store owner or admin can change or approve shipping.", "يمكن لمالك المتجر أو المسؤول فقط تغيير إعدادات الشحن أو اعتمادها.")} />}
              {(data.policyChanged || data.warehouseChanged) && <ReadyItem ok={false} text={t("Your policy or warehouse changed after approval. Please approve again.", "تغيّرت السياسة أو المستودع بعد الاعتماد. اعتمد الإعدادات مجددًا.")} />}
            </ul>
          )}

          {/* ── The four steps on one rail ── */}
          <ol className="ship-steps">
            {/* 1. Warehouse */}
            <Step n={1} done={stepsDone[0]} open={openStep === 0} onOpen={() => goTo(0)} onContinue={() => goTo(1)} t={t}
              title={t("Return warehouse", "مستودع الإرجاع")}
              subtitle={t("Where returned parcels are sent.", "وين تُرسل الطرود المرتجعة.")}
              summary={selected ? `${warehouseName(selected)} · ${cityName(selected.city)}` : undefined}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="shipping-warehouse" className="text-sm font-medium">{t("Send returns to", "إرسال المرتجعات إلى")}</label>
                  <Select value={form.warehouseId} onValueChange={(v) => change("warehouseId", v)} disabled={disabled || !data.providerReady}>
                    <SelectTrigger id="shipping-warehouse" className="h-11 w-full min-w-0 rounded-xl">
                      <SelectValue placeholder={t("Choose a verified warehouse", "اختر مستودعًا متحققًا منه")} />
                    </SelectTrigger>
                    <SelectContent>
                      {data.warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{warehouseName(w)} · {cityName(w.city)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <AnimatePresence initial={false}>
                  {selected && (
                    <motion.div key={selected.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={TWEEN} className="overflow-hidden">
                      <div className="flex gap-3 text-sm leading-6">
                        <MapPin className="mt-1 size-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p>{cityName(selected.city)}</p>
                          {selected.address && <p className="text-muted-foreground">{selected.address}</p>}
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-eligible"><CheckCircle2 className="size-3" />{t("Found in OTO", "موجود لدى أوتو")}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!data.warehouses.length && data.providerReady && (
                  <p className="text-sm text-muted-foreground">{t("No warehouse yet. Add one below, then choose it.", "ما فيه مستودع بعد. أضف واحد تحت ثم اختره.")}</p>
                )}
                {data.canManage && (
                  <Button variant="outline" className="rounded-full" disabled={disabled} onClick={() => setWarehouseOpen((v) => !v)} aria-expanded={warehouseOpen}>
                    <Plus className={cn("size-4 transition-transform duration-300", warehouseOpen && "rotate-45")} />
                    {data.pendingWarehouse ? t("Check saved warehouse", "التحقق من المستودع المحفوظ") : t("Add a warehouse", "إضافة مستودع")}
                  </Button>
                )}
                <AnimatePresence initial={false}>
                  {warehouseOpen && (
                    <motion.div initial={{ opacity: 0, height: reduce ? "auto" : 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: reduce ? "auto" : 0 }} transition={{ ...TWEEN, duration: 0.4 }} className="overflow-hidden">
                      <motion.form
                        initial={{ opacity: 0, y: reduce ? 0 : -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...TWEEN, delay: 0.08 }}
                        className="space-y-4 border-s-2 border-border ps-4 pt-1"
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          const first = (Object.keys(warehouseIssues) as Array<keyof typeof warehouseBlank>)[0];
                          if (first) {
                            setTried(true);
                            document.getElementById("warehouse-" + first)?.focus();
                            return;
                          }
                          void act(data.pendingWarehouse ? "recoverWarehouse" : "warehouse");
                        }}
                      >
                        <p className="text-sm leading-6 text-muted-foreground">
                          {data.pendingWarehouse
                            ? t("Re-enter the same details to check the saved request. This check does not create another warehouse.", "أعد إدخال التفاصيل نفسها للتحقق من الطلب المحفوظ. لا ينشئ هذا الفحص مستودعًا آخر.")
                            : t("Enter a real address for future setup, or a fictional address for this sandbox. Use contact details you control. OTO may send test notifications.", "أدخل عنوانًا حقيقيًا للإعداد المستقبلي، أو عنوانًا افتراضيًا لهذه البيئة التجريبية. استخدم بيانات تواصل تتحكم بها. قد يرسل أوتو إشعارات تجريبية.")}
                        </p>
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                          {(["name", "contactName", "email", "phone", "address"] as const).map((key) => (
                            <div key={key} className={"min-w-0 space-y-2 " + (key === "address" ? "sm:col-span-2" : "")}>
                              <label htmlFor={"warehouse-" + key} className="text-sm font-medium">
                                {{
                                  name: t("Warehouse name", "اسم المستودع"),
                                  contactName: t("Contact name", "اسم جهة التواصل"),
                                  email: t("Contact email", "البريد الإلكتروني"),
                                  phone: t("Saudi mobile number", "رقم الجوال السعودي"),
                                  address: t("Full warehouse address", "عنوان المستودع الكامل"),
                                }[key]}
                              </label>
                              <Input
                                id={"warehouse-" + key}
                                aria-invalid={Boolean(showIssue(key))}
                                aria-describedby={showIssue(key) ? "warehouse-" + key + "-issue" : undefined}
                                onBlur={() => setTouched((v) => ({ ...v, [key]: true }))}
                                placeholder={key === "phone" ? "05XXXXXXXX" : key === "email" ? "name@store.com" : undefined}
                                type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                                dir={key === "email" || key === "phone" ? "ltr" : undefined}
                                autoComplete="off"
                                required
                                minLength={key === "address" ? 12 : 2}
                                maxLength={key === "address" ? 300 : key === "email" ? 254 : key === "phone" ? 25 : key === "name" ? 64 : 80}
                                value={warehouse[key]}
                                onChange={(e) => {
                                  setWarehouse((w) => ({ ...w, [key]: e.target.value }));
                                  if (errorAt === "warehouse" || errorAt === "recoverWarehouse") setError(null);
                                }}
                                disabled={!!busy}
                                className={cn("h-11 rounded-xl rtl:text-right", showIssue(key) && "border-destructive focus-visible:ring-destructive/30")}
                              />
                              <AnimatePresence initial={false}>
                                {showIssue(key) ? (
                                  <motion.p
                                    key="issue"
                                    id={"warehouse-" + key + "-issue"}
                                    initial={{ opacity: 0, height: 0, y: -2 }}
                                    animate={{ opacity: 1, height: "auto", y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ ...TWEEN, duration: 0.22 }}
                                    className="overflow-hidden text-xs text-destructive"
                                  >
                                    {showIssue(key)}
                                  </motion.p>
                                ) : key in touched && !warehouseIssues[key] ? (
                                  <motion.p key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-xs text-eligible">
                                    <Check className="size-3" /> {t("Looks good", "تمام")}
                                  </motion.p>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          ))}
                          <div className="space-y-2">
                            <label htmlFor="warehouse-city" className="text-sm font-medium">{t("City", "المدينة")}</label>
                            <Select value={warehouse.city} onValueChange={(city) => setWarehouse((w) => ({ ...w, city }))} disabled={!!busy}>
                              <SelectTrigger id="warehouse-city" className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[["Riyadh", t("Riyadh", "الرياض")], ["Jeddah", t("Jeddah", "جدة")], ["Dammam", t("Dammam", "الدمام")]].map(([v, label]) => (
                                  <SelectItem key={v} value={v}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <label className="flex items-start gap-3 text-sm leading-6">
                          <Checkbox checked={warehouseConsent} onCheckedChange={(v) => setWarehouseConsent(v === true)} disabled={!!busy} className="mt-1" />
                          <span>{t("I control these contact details and approve creating this test warehouse with OTO and receiving test notifications.", "أتحكم ببيانات التواصل هذه وأوافق على إنشاء هذا المستودع التجريبي لدى أوتو واستلام إشعارات الاختبار.")}</span>
                        </label>
                        <InlineError show={Boolean(error) && (errorAt === "warehouse" || errorAt === "recoverWarehouse")} text={error ? messages[error] || t("We couldn’t confirm this step. Your details are still here. Please try again.", "تعذر تأكيد هذه الخطوة. بياناتك ما زالت هنا. حاول مرة ثانية.") : ""} />
                        <Button type="submit" className="rounded-full" disabled={!!busy || !warehouseConsent}>
                          {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
                          {data.pendingWarehouse ? t("Check warehouse", "التحقق من المستودع") : t("Create and verify warehouse", "إنشاء المستودع والتحقق منه")}
                        </Button>
                      </motion.form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Step>

            {/* 2. Couriers */}
            <Step n={2} done={stepsDone[1]} open={openStep === 1} onOpen={() => goTo(1)} onContinue={() => goTo(2)} t={t}
              title={t("Couriers", "الناقلون")}
              subtitle={t("Pick the couriers you trust. Your first choice is tried first.", "اختر الناقلين اللي تثق فيهم. نجرّب خيارك الأول أولًا.")}
              summary={form.courierIds.length ? form.courierIds.map(courierName).join(" → ") : undefined}>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {shippingTestCouriers.map((c) => {
                    const on = form.courierIds.includes(c.id);
                    return (
                      <motion.button
                        key={c.id}
                        type="button"
                        whileTap={reduce ? undefined : { scale: 0.96 }}
                        disabled={disabled}
                        aria-pressed={on}
                        onClick={() => change("courierIds", on ? form.courierIds.filter((id) => id !== c.id) : [...form.courierIds, c.id])}
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-200 disabled:opacity-50",
                          on ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40",
                        )}
                      >
                        <AnimatePresence initial={false}>
                          {on && (
                            <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={TWEEN} className="inline-flex overflow-hidden">
                              <Check className="size-3.5" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {c.name}
                      </motion.button>
                    );
                  })}
                </div>
                {form.courierIds.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t("Priority order", "ترتيب الأولوية")}</p>
                    <ol className="mt-2 border-t border-border">
                      <AnimatePresence initial={false}>
                        {form.courierIds.map((id, i) => (
                          <motion.li
                            key={id}
                            layout={!reduce}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ ...TWEEN, layout: { ...TWEEN, duration: 0.35 } }}
                            className="overflow-hidden border-b border-border"
                          >
                            <div className="flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm">
                              <span className="flex items-center gap-3">
                                <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums", i === 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{i + 1}</span>
                                {courierName(id)}
                                {i === 0 && <span className="text-xs text-muted-foreground">{t("First choice", "الخيار الأول")}</span>}
                              </span>
                              <div className="flex shrink-0 gap-1">
                                <Button size="icon-sm" variant="ghost" className="rounded-full" disabled={disabled || i === 0} aria-label={t("Move " + courierName(id) + " earlier", "تقديم " + courierName(id))} onClick={() => move(i, -1)}>
                                  <ArrowUp className="size-4" />
                                </Button>
                                <Button size="icon-sm" variant="ghost" className="rounded-full" disabled={disabled || i === form.courierIds.length - 1} aria-label={t("Move " + courierName(id) + " later", "تأخير " + courierName(id))} onClick={() => move(i, 1)}>
                                  <ArrowDown className="size-4" />
                                </Button>
                              </div>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ol>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("Choose at least one courier to continue.", "اختر ناقلًا واحدًا على الأقل للمتابعة.")}</p>
                )}
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("Test couriers. Real availability and price are checked for every return.", "ناقلون تجريبيون. يُتحقق من التوفر والسعر الفعلي لكل إرجاع.")}
                </p>
              </div>
            </Step>

            {/* 3. Collection and limit */}
            <Step n={3} done={stepsDone[2]} open={openStep === 2} onOpen={() => goTo(2)} onContinue={() => goTo(3)} t={t}
              title={t("Pickup and limit", "الاستلام والحد الأقصى")}
              subtitle={t("How parcels are collected, and the most you’ll pay per shipment.", "كيف يُستلم الطرد، وأعلى مبلغ تدفعه لكل شحنة.")}
              summary={capValid ? `${form.collectionMethod === "PICKUP_BY_DC" ? t("Courier collects", "الناقل يستلم") : t("Branch drop-off", "تسليم في الفرع")} · ${t("up to", "حتى")} ${money(Math.round(cap * 100))}` : undefined}>
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("Collection method", "طريقة الاستلام")}</p>
                  {/* Two clear choices instead of a dropdown. */}
                  <div role="radiogroup" aria-label={t("Collection method", "طريقة الاستلام")} className="grid gap-2 sm:grid-cols-2">
                    {([
                      ["PICKUP_BY_DC", t("Courier collects from the customer", "الناقل يستلم من العميل")],
                      ["BRANCH_DROP_OFF", t("Customer drops off at a courier branch", "العميل يسلّم في فرع الناقل")],
                    ] as const).map(([value, label]) => {
                      const on = form.collectionMethod === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={disabled}
                          onClick={() => change("collectionMethod", value)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border px-4 py-3 text-start text-sm transition-colors duration-200 disabled:opacity-50",
                            on ? "border-foreground" : "border-border hover:border-foreground/40",
                          )}
                        >
                          <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border transition-colors", on ? "border-foreground" : "border-muted-foreground/50")}>
                            <motion.span initial={false} animate={{ scale: on ? 1 : 0 }} transition={TWEEN} className="size-2 rounded-full bg-foreground" />
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="shipping-cap" className="text-sm font-medium">{t("Maximum per shipment (SAR)", "الحد الأقصى لكل شحنة (ريال)")}</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Number and "SAR" always read left to right, so the unit never overlaps the amount in Arabic. */}
                    <div className="relative w-36" dir="ltr">
                      <Input id="shipping-cap" inputMode="decimal" dir="ltr" value={form.cap} onChange={(e) => change("cap", e.target.value)} maxLength={8} disabled={disabled} aria-invalid={!capValid} className="h-11 rounded-xl pe-12 text-left tabular-nums" />
                      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">{t("SAR", "ر.س")}</span>
                    </div>
                    {[25, 50, 100, 250].map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={disabled}
                        onClick={() => change("cap", String(v))}
                        className={cn(
                          "h-9 rounded-full border px-3 text-sm tabular-nums transition-colors disabled:opacity-50",
                          cap === v ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className={cn("text-xs leading-5", capValid ? "text-muted-foreground" : "text-destructive")}>
                    {t("Between SAR 1 and 10,000. Anything above it never gets booked; it comes to you instead.", "بين 1 و10,000 ريال. أي تكلفة أعلى ما تُحجز، وتوصلك للمراجعة.")}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-4 border-t border-border pt-5">
                  <div>
                    <label htmlFor="shipping-automatic" className="text-sm font-medium">{t("Allow automatic eligible returns", "السماح بالإرجاعات المؤهلة تلقائيًا")}</label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Off by default. Records your permission only; nothing is booked until returns are connected.", "غير مفعّل افتراضيًا. يسجّل موافقتك فقط، ولا يُحجز شيء حتى ربط الإرجاع.")}</p>
                  </div>
                  <Switch id="shipping-automatic" checked={form.automaticRequested} onCheckedChange={(v) => change("automaticRequested", v)} disabled={disabled} />
                </div>
              </div>
            </Step>

            {/* 4. Approve */}
            <Step n={4} done={stepsDone[3]} last open={openStep === 3} onOpen={() => goTo(3)} t={t}
              title={t("Review and approve", "المراجعة والاعتماد")}
              subtitle={t("Check everything once and approve. Reload adds no shipping fee.", "راجع كل شيء مرة وحدة واعتمد. ريلود ما يضيف رسوم شحن.")}
              summary={approvedNow ? t("Approved", "معتمدة") : undefined}>
              <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                {[
                  [t("Warehouse", "المستودع"), selected ? warehouseName(selected) : t("Choose a warehouse", "اختر مستودعًا"), Boolean(selected)],
                  [t("Maximum charge", "الحد الأقصى للتكلفة"), capValid ? money(Math.round(cap * 100)) : t("Enter an amount", "أدخل مبلغًا"), capValid],
                  [t("First choice", "الخيار الأول"), form.courierIds[0] ? courierName(form.courierIds[0]) : t("Choose a courier", "اختر ناقلًا"), Boolean(form.courierIds[0])],
                  [t("Automatic returns", "الإرجاع التلقائي"), form.automaticRequested ? t("Permission requested · not active", "الموافقة مطلوبة · غير نشط") : t("Off", "غير مفعّل"), true],
                ].map(([k, v, ok]) => (
                  <div key={String(k)} className="border-b border-border pb-3">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className={cn("mt-1 break-words font-medium", !ok && "text-muted-foreground")}>{v}</dd>
                  </div>
                ))}
              </dl>
              <AnimatePresence mode="wait" initial={false}>
                {approvedNow ? (
                  <motion.div key="approved" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={TWEEN} className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-eligible">
                        <DrawnCheck play={saved === "approve"} />
                        {t("Approved. Automatic bookings are still inactive.", "تم الاعتماد. الحجوزات التلقائية ما زالت غير نشطة.")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{t("Any change needs a new approval. Pausing doesn’t cancel existing bookings.", "أي تعديل يحتاج اعتمادًا جديدًا. الإيقاف لا يلغي الحجوزات السابقة.")}</p>
                    </div>
                    {data.canManage && (
                      <Button variant="outline" className="rounded-full" disabled={!!busy} onClick={() => void act("pause")}>
                        {busy === "pause" ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
                        {t("Pause shipping approval", "إيقاف موافقة الشحن مؤقتًا")}
                      </Button>
                    )}
                  </motion.div>
                ) : data.canManage ? (
                  <motion.div key="approve" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={TWEEN} className="mt-5 space-y-4">
                    <label className={cn("flex items-start gap-3 text-sm leading-6", (dirty || !data.settings) && "opacity-60")}>
                      <Checkbox checked={approval} onCheckedChange={(v) => setApproval(v === true)} disabled={disabled || dirty || !data.settings} className="mt-1" />
                      <span>{t("I approve the saved shipping settings. I understand that customers must print return labels and shipping does not approve a product refund.", "أوافق على إعدادات الشحن المحفوظة. أفهم أن العملاء يجب أن يطبعوا بوالص الإرجاع وأن الشحن لا يعني اعتماد استرداد ثمن المنتج.")}</span>
                    </label>
                    <InlineError show={Boolean(error) && (errorAt === "approve" || errorAt === "pause")} text={error ? messages[error] || t("We couldn’t confirm this step. Please refresh before trying again.", "تعذر تأكيد هذه الخطوة. حدّث الصفحة قبل المحاولة مجددًا.") : ""} />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button className="rounded-full" disabled={disabled || dirty || !approval || !data.providerReady || !data.settings} onClick={() => void act("approve")}>
                        {busy === "approve" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <ShieldCheck className="size-4" />}
                        {t("Approve saved settings", "اعتماد الإعدادات المحفوظة")}
                      </Button>
                      {dirty && <span className="text-xs text-muted-foreground">{t("Save your edits before approving them.", "احفظ تعديلاتك قبل اعتمادها.")}</span>}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </Step>
          </ol>

          {Boolean(data?.improvements?.length) && (
            <section>
              <h2 className="text-[15px] font-semibold">{t("What we can improve", "فرص تحسين التجربة")}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Based on shipping checks from the last 30 days. Suggestions need your review; no setting changes automatically.", "بناءً على فحوصات الشحن خلال آخر 30 يومًا. التوصيات تحتاج مراجعتك، ولا تتغير الإعدادات تلقائيًا.")}</p>
              <ul className="mt-3 space-y-3">
                {data!.improvements!.map((signal) => (
                  <li key={signal.reason} className="border-s-2 border-review ps-4 text-sm leading-6">
                    <p className="font-medium">{t(`${signal.count} return(s) needed attention`, `${signal.count} طلب إرجاع احتاج متابعة`)}</p>
                    <p className="text-muted-foreground">
                      {signal.reason === "PARCEL_REQUIRED"
                        ? t("Add measured parcel details for the missing product and quantity.", "أضف قياسات الطرد للمنتج والكمية اللذين لم تُعتمد بياناتهما.")
                        : ["ABOVE_CAP", "CHARGE_REVIEW"].includes(signal.reason)
                          ? t("Review courier costs against your approved limit. Reload will keep the limit unchanged.", "راجع تكاليف الناقل مقارنة بالحد المعتمد. لن يغيّر ريلود الحد تلقائيًا.")
                          : signal.reason === "BALANCE_REQUIRED"
                            ? t("Review the shipping balance before the next booking.", "راجع رصيد الشحن قبل الحجز التالي.")
                            : signal.reason === "BOOKING_UNCERTAIN"
                              ? t("Check the existing booking with support before retrying. Funds stay reserved until its outcome is confirmed.", "راجع الحجز الحالي مع الدعم قبل المحاولة. يبقى المبلغ محجوزًا حتى تأكيد النتيجة.")
                              : t("Review saved return cases and shipping settings to resolve these checks.", "راجع طلبات الإرجاع المحفوظة وإعدادات الشحن لمعالجة هذه الحالات.")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Less-used settings, folded away until needed. */}
          <div className="border-t border-border">
            <Disclosure title={t("Parcel sizes", "مقاسات الطرود")} hint={t("Measured weight and size per product", "الوزن والمقاس لكل منتج")}>
              <ShippingParcelForm store={store!} canManage={Boolean(data?.canManage && data?.premium)} profiles={data?.parcels || []} onSaved={() => void load(false)} />
            </Disclosure>
            <Disclosure
              title={t("Shipping balance", "رصيد الشحن")}
              hint={money(data.wallet.availableHalalas)}
              attention={(capValid && data.wallet.availableHalalas < Math.round(cap * 100)) || data.wallet.unconfirmed > 0}
            >
              <div className="space-y-4 pb-2">
                <Metric icon={Wallet} note={t("Separate from your subscription", "منفصل عن اشتراكك")} label={t("Available shipping funds", "رصيد الشحن المتاح")} value={data.wallet.availableHalalas / 100} decimals={2} suffix={t("SAR", "ر.س")} />
                <ul className="space-y-2">
                  {capValid && data.wallet.availableHalalas < Math.round(cap * 100) && (
                    <ReadyItem ok={false} text={t("Your balance is below your limit. Add funds before booking.", "رصيدك أقل من الحد. أضف رصيدًا قبل الحجز.")} />
                  )}
                  {data.wallet.unconfirmed > 0 && (
                    <ReadyItem ok={false} text={t("An earlier booking still needs checking. Do not create another to bypass it.", "حجز سابق ما زال بحاجة إلى تحقق. لا تنشئ حجزًا آخر لتجاوزه.")} />
                  )}
                </ul>
                <div className="flex flex-wrap gap-4 text-sm">
                  <Link href="/app/shipping" className="font-medium underline underline-offset-4">{t("Add funds", "إضافة رصيد")}</Link>
                  <Link href="/app/shipping/return-test" className="underline underline-offset-4">{t("Try a test return", "جرّب إرجاعًا تجريبيًا")}</Link>
                </div>
              </div>
            </Disclosure>
            {!!data.history.length && (
              <Disclosure title={t("Recent changes", "آخر التغييرات")} hint={data.history.length === 1 ? t("1 change", "تغيير واحد") : t(`${data.history.length} changes`, `${data.history.length} تغييرات`)}>
                <ol className="ship-history pb-2">
                  {data.history.map((h, i) => (
                    <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2.5">
                        <span className={cn("ship-history-dot", h.event === "APPROVED" ? "bg-eligible" : h.event === "PAUSED" ? "bg-review" : "bg-muted-foreground/50")} />
                        {h.event === "APPROVED" ? t("Settings approved", "تم اعتماد الإعدادات") : h.event === "PAUSED" ? t("Approval paused", "تم إيقاف الموافقة مؤقتًا") : t("New draft saved", "تم حفظ مسودة جديدة")}
                      </span>
                      <time className="text-xs text-muted-foreground tabular-nums">{new Date(h.createdAt).toLocaleString(isArabic ? "ar-SA-u-nu-latn" : "en-GB")}</time>
                    </li>
                  ))}
                </ol>
              </Disclosure>
            )}
          </div>

          {/* ── Unsaved changes bar: appears only when there is something to save ── */}
          <AnimatePresence>
            {dirty && data.canManage && (
              <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : 24 }}
                transition={{ ...TWEEN, duration: 0.35 }}
                className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 ps-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,.6)] backdrop-blur max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm">
                    <span className="size-2 rounded-full bg-review" />
                    {t("Unsaved changes", "تعديلات غير محفوظة")}
                  </p>
                  {error && errorAt === "save" && (
                    <motion.p initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={TWEEN} role="alert" className="mt-1 text-xs leading-5 text-destructive">
                      {messages[error] || t("We couldn’t save. Your edits are still here. Please try again.", "تعذر الحفظ. تعديلاتك ما زالت هنا. حاول مرة ثانية.")}
                    </motion.p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" className="rounded-full text-muted-foreground" disabled={!!busy} onClick={() => void load()}>
                    {t("Discard", "تجاهل")}
                  </Button>
                  <Button className="rounded-full" disabled={disabled || !data.providerReady} onClick={() => void act("save")}>
                    {busy === "save" && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
                    {busy === "save" ? t("Saving…", "جارٍ الحفظ…") : t("Save settings", "حفظ الإعدادات")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

/** One step on the rail. Only the open step shows its fields; the others
 *  show a one-line summary and can be reopened. The number turns into a
 *  drawn check when the step is complete. */
function Step({ n, done, title, subtitle, summary, open, onOpen, onContinue, last = false, t, children }: {
  n: number; done: boolean; title: string; subtitle?: string; summary?: string; open: boolean;
  onOpen: () => void; onContinue?: () => void; last?: boolean; t: (en: string, ar: string) => string; children: React.ReactNode;
}) {
  return (
    <li className={cn("ship-step", last && "ship-step-last")} data-done={done || undefined} data-open={open || undefined}>
      <span className="ship-step-dot" aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.span key="done" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={TWEEN} className="grid place-items-center">
              <DrawnCheck play />
            </motion.span>
          ) : (
            <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TWEEN} className="tabular-nums">{n}</motion.span>
          )}
        </AnimatePresence>
      </span>
      <div className="min-w-0 flex-1 pb-8">
        <button type="button" onClick={onOpen} aria-expanded={open} className="group flex w-full items-start justify-between gap-4 text-start">
          <span className="min-w-0">
            <span className={cn("block text-base font-semibold transition-colors", !open && !done && "text-muted-foreground")}>{title}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "sub" : "sum"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-1 block text-sm leading-6 text-muted-foreground"
              >
                {open ? subtitle : summary ?? subtitle}
              </motion.span>
            </AnimatePresence>
          </span>
          {!open && (
            <span className="mt-0.5 shrink-0 text-sm font-medium text-muted-foreground underline-offset-4 group-hover:text-foreground group-hover:underline">
              {done ? t("Change", "تعديل") : t("Open", "فتح")}
            </span>
          )}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ ...TWEEN, duration: 0.4 }}
              className="overflow-hidden"
            >
              <motion.div initial={{ y: -6 }} animate={{ y: 0 }} transition={{ ...TWEEN, delay: 0.06 }} className="pt-5">
                {children}
                {onContinue && done && (
                  <Button variant="outline" className="mt-6 rounded-full" onClick={onContinue}>
                    {t("Continue", "التالي")}
                    <ArrowDown className="size-4" />
                  </Button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

/** An error shown right where it happened (above the button that failed). */
function InlineError({ show, text }: { show: boolean; text: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={TWEEN}
          className="flex items-start gap-2 overflow-hidden text-sm leading-6 text-destructive"
        >
          <TriangleAlert className="mt-1 size-4 shrink-0" />
          {text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** A folded section for less-used settings; opens smoothly. */
function Disclosure({ title, hint, attention = false, children }: { title: string; hint?: string; attention?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 py-4 text-start">
        <span className="flex items-center gap-2.5">
          {attention && <span className="size-2 rounded-full bg-review" aria-hidden="true" />}
          <span className="text-[15px] font-semibold">{title}</span>
          {hint && <span className="text-sm text-muted-foreground">· {hint}</span>}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[420ms] ease-[cubic-bezier(0.2,0,0,1)]", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ...TWEEN, duration: 0.4 }} className="overflow-hidden">
            <div className="ship-disclosure-body pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A readiness line: green check, amber dot, or neutral info (ok = null). */
function ReadyItem({ ok, text, link }: { ok: boolean | null; text: string; link?: { href: string; label: string } }) {
  return (
    <motion.li layout="position" className="flex items-start gap-2.5 text-sm leading-6">
      <span className={cn("mt-1 grid size-4 shrink-0 place-items-center rounded-full", ok === true ? "bg-eligible-muted text-eligible" : ok === false ? "bg-review-muted text-review" : "bg-muted text-muted-foreground")}>
        {ok === true ? <Check className="size-3" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <span className={cn(ok === true && "text-muted-foreground")}>
        {text}
        {link && (
          <>
            {" "}
            <Link href={link.href} className="font-medium text-foreground underline underline-offset-4">{link.label}</Link>
          </>
        )}
      </span>
    </motion.li>
  );
}

/** A check mark that draws itself when `play` is set. */
function DrawnCheck({ play }: { play: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
      <motion.path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" initial={play ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: [0.2, 0, 0, 1], delay: 0.05 }} />
    </svg>
  );
}
