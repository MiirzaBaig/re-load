"use client";
// Previous shipping settings screen (Codex, 2026-10-31), kept for revert after
// the step-flow redesign (2026-11-02). Not used by any route.
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
  Check,
  CheckCircle2,
  ChevronDown,
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
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/desk/page-header";
import { Panel, Metric, TWEEN } from "@/components/desk/primitives";
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
export function ShippingSettingsV1() {
  const { workspace } = useAuth(),
    { t, isArabic } = useLanguage(),
    reduce = useReducedMotion(),
    store = workspace?.storeId;
  const [data, setData] = useState<Snapshot | null>(null),
    [form, setForm] = useState<Form>({ ...blank }),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<string | null>(null),
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
        if (!c.signal.aborted && current.current === store)
          setError(e instanceof Error ? e.message : "unavailable");
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
      setError("invalid_input");
      return;
    }
    if (action === "approve" && (dirty || !approval)) return;
    if (
      (action === "warehouse" || action === "recoverWarehouse") &&
      !warehouseConsent
    ) {
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
      }
    } catch (e) {
      if (current.current !== store) return;
      const code = e instanceof Error ? e.message : "unavailable";
      if (action === "warehouse" || action === "recoverWarehouse") {
        await load(false);
        setError(code);
      } else setError(code);
    } finally {
      if (current.current === store) {
        lock.current = false;
        setBusy(null);
      }
    }
  }
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
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader icon={Truck} title={t("Shipping settings", "إعدادات الشحن")}>
        {t(
          "Choose where returns go, your couriers and the most you approve per shipment.",
          "حدد وجهة المرتجعات والناقلين والحد الأقصى المعتمد لكل شحنة.",
        )}
      </PageHeader>
      <div className="flex gap-3 rounded-2xl border border-review/25 bg-review/10 p-4 text-sm leading-6">
        <ShieldCheck className="mt-1 size-4 shrink-0" />
        <p>
          {t(
            "Sandbox setup. These settings apply to test shipping only. Approving them does not start customer bookings; automatic returns are not active yet.",
            "إعداد تجريبي. تنطبق هذه الإعدادات على الشحن التجريبي فقط. اعتمادها لا يبدأ حجوزات العملاء؛ الإرجاع التلقائي غير نشط بعد.",
          )}
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6"
        >
          <TriangleAlert className="mt-1 size-4 shrink-0 text-destructive" />
          <p>
            {messages[error] ||
              t(
                "We couldn’t confirm this step. Your edits are still here. Refresh before repeating an uncertain request.",
                "تعذر تأكيد هذه الخطوة. تعديلاتك ما زالت هنا. حدّث الصفحة قبل تكرار طلب غير مؤكد.",
              )}
          </p>
        </div>
      )}
      {!data ? (
        <>
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
          {error && (
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="size-4" />
              {t("Try again", "حاول مجددًا")}
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div>
              <p className="text-sm font-medium">
                {data.settings?.state === "APPROVED"
                  ? t(
                      "Approved · bookings not active",
                      "معتمد · الحجوزات غير نشطة",
                    )
                  : data.settings?.state === "PAUSED"
                    ? t(
                        "Shipping approval paused",
                        "موافقة الشحن متوقفة مؤقتًا",
                      )
                    : t("Not approved yet", "لم تُعتمد بعد")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {dirty
                  ? t(
                      "You have unsaved changes. Save, then review and approve.",
                      "لديك تعديلات غير محفوظة. احفظها ثم راجعها واعتمدها.",
                    )
                  : t(
                      "Changes require a new approval. Existing bookings are not cancelled by pausing.",
                      "تحتاج التغييرات إلى موافقة جديدة. الإيقاف المؤقت لا يلغي الحجوزات السابقة.",
                    )}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => void load()}
            >
              <RefreshCw className="size-4" />
              {t("Load latest settings", "تحميل آخر إعدادات")}
            </Button>
          </div>
          {!data.premium && (
            <div className="rounded-2xl border p-4 text-sm leading-6">
              {t(
                "Shipping is a Premium feature. You can view this setup and pause a previous approval.",
                "الشحن ميزة في بريميوم. يمكنك عرض الإعدادات وإيقاف موافقة سابقة مؤقتًا.",
              )}{" "}
              <Link
                href="/app/billing"
                className="underline underline-offset-4"
              >
                {t("View your plan", "عرض باقتك")}
              </Link>
            </div>
          )}
          {!data.canManage && (
            <p className="rounded-2xl border p-4 text-sm">
              {t(
                "Only a store owner or admin can change or approve shipping.",
                "يمكن لمالك المتجر أو المسؤول فقط تغيير إعدادات الشحن أو اعتمادها.",
              )}
            </p>
          )}
          {(data.policyChanged || data.warehouseChanged) && (
            <p
              role="status"
              className="rounded-2xl border border-review/25 bg-review/10 p-4 text-sm leading-6"
            >
              {t(
                "Your policy or warehouse details changed after approval. Review the current details and approve again before using the new setup.",
                "تغيرت السياسة أو تفاصيل المستودع بعد الاعتماد. راجع التفاصيل الحالية واعتمدها مجددًا قبل استخدام الإعداد الجديد.",
              )}
            </p>
          )}
          {!data.providerReady && (
            <p
              role="status"
              className="rounded-2xl border border-review/25 bg-review/10 p-4 text-sm leading-6"
            >
              {t(
                "We couldn’t refresh warehouse details from OTO. Saving and approval wait until the connection is restored. You can still pause.",
                "تعذر تحديث تفاصيل المستودع من أوتو. يتوقف الحفظ والاعتماد حتى استعادة الاتصال. ما زال بإمكانك الإيقاف المؤقت.",
              )}
            </p>
          )}
          <Panel
            title={t("Return warehouse", "مستودع الإرجاع")}
            subtitle={t(
              "Only warehouses linked to this store are shown. Verification checks OTO’s record, not the physical address.",
              "تظهر المستودعات المرتبطة بهذا المتجر فقط. يتحقق الفحص من سجل أوتو، وليس من العنوان الفعلي.",
            )}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="shipping-warehouse"
                  className="text-sm font-medium"
                >
                  {t("Send returns to", "إرسال المرتجعات إلى")}
                </label>
                <Select
                  value={form.warehouseId}
                  onValueChange={(v) => change("warehouseId", v)}
                  disabled={disabled || !data.providerReady}
                >
                  <SelectTrigger
                    id="shipping-warehouse"
                    className="h-11 w-full min-w-0 rounded-xl"
                  >
                    <SelectValue
                      placeholder={t(
                        "Choose a verified warehouse",
                        "اختر مستودعًا متحققًا منه",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {data.warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name === "Test return warehouse"
                          ? t(
                              "Test return warehouse",
                              "مستودع الإرجاع التجريبي",
                            )
                          : w.name}{" "}
                        · {w.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selected && (
                <div className="flex gap-3 rounded-xl bg-muted/40 p-3 text-sm leading-6">
                  <MapPin className="mt-1 size-4 shrink-0" />
                  <div>
                    <p>{selected.city}</p>
                    {selected.address && (
                      <p className="text-muted-foreground">
                        {selected.address}
                      </p>
                    )}
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-eligible">
                      <CheckCircle2 className="size-3" />
                      {t("Found in OTO", "موجود لدى أوتو")}
                    </p>
                  </div>
                </div>
              )}
              {!data.warehouses.length && data.providerReady && (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Add your first return warehouse, then choose it here.",
                    "أضف أول مستودع إرجاع ثم اختره هنا.",
                  )}
                </p>
              )}
              {data.canManage && (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setWarehouseOpen((v) => !v)}
                >
                  <Plus className="size-4" />
                  {data.pendingWarehouse
                    ? t("Check saved warehouse", "التحقق من المستودع المحفوظ")
                    : t("Add a warehouse", "إضافة مستودع")}
                  <ChevronDown
                    className={
                      "size-4 transition-transform " +
                      (warehouseOpen ? "rotate-180" : "")
                    }
                  />
                </Button>
              )}
              <AnimatePresence initial={false}>
                {warehouseOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: reduce ? "auto" : 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: reduce ? "auto" : 0 }}
                    transition={TWEEN}
                    className="overflow-hidden"
                  >
                    <form
                      className="space-y-4 rounded-2xl border p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act(
                          data.pendingWarehouse
                            ? "recoverWarehouse"
                            : "warehouse",
                        );
                      }}
                    >
                      <p className="text-sm leading-6 text-muted-foreground">
                        {data.pendingWarehouse
                          ? t(
                              "Re-enter the same details to check the saved request. This check does not create another warehouse.",
                              "أعد إدخال التفاصيل نفسها للتحقق من الطلب المحفوظ. لا ينشئ هذا الفحص مستودعًا آخر.",
                            )
                          : t(
                              "Enter a real address for future setup, or a fictional address for this sandbox. Use contact details you control. OTO may send test notifications.",
                              "أدخل عنوانًا حقيقيًا للإعداد المستقبلي، أو عنوانًا افتراضيًا لهذه البيئة التجريبية. استخدم بيانات تواصل تتحكم بها. قد يرسل أوتو إشعارات تجريبية.",
                            )}
                      </p>
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                        {(
                          [
                            "name",
                            "contactName",
                            "email",
                            "phone",
                            "address",
                          ] as const
                        ).map((key) => (
                          <div
                            key={key}
                            className={
                              "min-w-0 space-y-2 " +
                              (key === "address" ? "sm:col-span-2" : "")
                            }
                          >
                            <label
                              htmlFor={"warehouse-" + key}
                              className="text-sm font-medium"
                            >
                              {
                                {
                                  name: t("Warehouse name", "اسم المستودع"),
                                  contactName: t(
                                    "Contact name",
                                    "اسم جهة التواصل",
                                  ),
                                  email: t(
                                    "Contact email",
                                    "البريد الإلكتروني",
                                  ),
                                  phone: t(
                                    "Saudi mobile number",
                                    "رقم الجوال السعودي",
                                  ),
                                  address: t(
                                    "Full warehouse address",
                                    "عنوان المستودع الكامل",
                                  ),
                                }[key]
                              }
                            </label>
                            <Input
                              id={"warehouse-" + key}
                              type={
                                key === "email"
                                  ? "email"
                                  : key === "phone"
                                    ? "tel"
                                    : "text"
                              }
                              autoComplete="off"
                              required
                              minLength={key === "address" ? 12 : 2}
                              maxLength={
                                key === "address"
                                  ? 300
                                  : key === "email"
                                    ? 254
                                    : key === "phone"
                                      ? 25
                                      : key === "name"
                                        ? 64
                                        : 80
                              }
                              value={warehouse[key]}
                              onChange={(e) =>
                                setWarehouse((w) => ({
                                  ...w,
                                  [key]: e.target.value,
                                }))
                              }
                              disabled={!!busy}
                              className="h-11 rounded-xl"
                            />
                          </div>
                        ))}
                        <div className="space-y-2">
                          <label
                            htmlFor="warehouse-city"
                            className="text-sm font-medium"
                          >
                            {t("City", "المدينة")}
                          </label>
                          <Select
                            value={warehouse.city}
                            onValueChange={(city) =>
                              setWarehouse((w) => ({ ...w, city }))
                            }
                            disabled={!!busy}
                          >
                            <SelectTrigger
                              id="warehouse-city"
                              className="w-full rounded-xl"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                ["Riyadh", t("Riyadh", "الرياض")],
                                ["Jeddah", t("Jeddah", "جدة")],
                                ["Dammam", t("Dammam", "الدمام")],
                              ].map(([v, label]) => (
                                <SelectItem key={v} value={v}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <label className="flex items-start gap-3 text-sm leading-6">
                        <Checkbox
                          checked={warehouseConsent}
                          onCheckedChange={(v) =>
                            setWarehouseConsent(v === true)
                          }
                          disabled={!!busy}
                        />
                        <span>
                          {t(
                            "I control these contact details and approve creating this test warehouse with OTO and receiving test notifications.",
                            "أتحكم ببيانات التواصل هذه وأوافق على إنشاء هذا المستودع التجريبي لدى أوتو واستلام إشعارات الاختبار.",
                          )}
                        </span>
                      </label>
                      <Button
                        type="submit"
                        disabled={!!busy || !warehouseConsent}
                      >
                        {busy && (
                          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                        )}
                        {data.pendingWarehouse
                          ? t("Check warehouse", "التحقق من المستودع")
                          : t(
                              "Create and verify warehouse",
                              "إنشاء المستودع والتحقق منه",
                            )}
                      </Button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Panel>
          <Panel
            title={t("Preferred couriers", "الناقلون المفضلون")}
            subtitle={t(
              "Select couriers, then order them. Your first available choice will have priority when automatic booking is connected.",
              "اختر الناقلين ثم رتبهم. ستكون الأولوية لأول خيار متاح عند ربط الحجز التلقائي.",
            )}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {shippingTestCouriers.map((c) => (
                  <Button
                    key={c.id}
                    variant={
                      form.courierIds.includes(c.id) ? "default" : "outline"
                    }
                    size="sm"
                    disabled={disabled}
                    aria-pressed={form.courierIds.includes(c.id)}
                    onClick={() =>
                      change(
                        "courierIds",
                        form.courierIds.includes(c.id)
                          ? form.courierIds.filter((id) => id !== c.id)
                          : [...form.courierIds, c.id],
                      )
                    }
                  >
                    {form.courierIds.includes(c.id) && (
                      <Check className="size-3" />
                    )}
                    {c.name}
                  </Button>
                ))}
              </div>
              {form.courierIds.length ? (
                <ol className="divide-y rounded-xl border px-3">
                  {form.courierIds.map((id, i) => (
                    <li
                      key={id}
                      className="flex min-w-0 items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span>
                        <span className="me-2 text-muted-foreground">
                          {i + 1}.
                        </span>
                        {shippingTestCouriers.find((c) => c.id === id)?.name}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={disabled || i === 0}
                          aria-label={t(
                            "Move " +
                              shippingTestCouriers.find((c) => c.id === id)
                                ?.name +
                              " earlier",
                            "تقديم " +
                              shippingTestCouriers.find((c) => c.id === id)
                                ?.name,
                          )}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={
                            disabled || i === form.courierIds.length - 1
                          }
                          aria-label={t(
                            "Move " +
                              shippingTestCouriers.find((c) => c.id === id)
                                ?.name +
                              " later",
                            "تأخير " +
                              shippingTestCouriers.find((c) => c.id === id)
                                ?.name,
                          )}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Choose at least one courier to continue.",
                    "اختر ناقلًا واحدًا على الأقل للمتابعة.",
                  )}
                </p>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                {t(
                  "These are sandbox couriers. Saving checks support for your warehouse city, collection method and a sample Riyadh route; each real return will need a fresh availability and price check.",
                  "هؤلاء ناقلون تجريبيون. يتحقق الحفظ من الدعم لمدينة المستودع وطريقة الاستلام ومسار تجريبي من الرياض؛ يحتاج كل إرجاع فعلي إلى فحص جديد للتوفر والسعر.",
                )}
              </p>
            </div>
          </Panel>
          <Panel
            title={t("Collection and spending limit", "الاستلام وحد الإنفاق")}
          >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="shipping-collection"
                  className="text-sm font-medium"
                >
                  {t("Collection method", "طريقة الاستلام")}
                </label>
                <Select
                  value={form.collectionMethod}
                  onValueChange={(v) => change("collectionMethod", v)}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id="shipping-collection"
                    className="w-full rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PICKUP_BY_DC">
                      {t(
                        "Courier collects from the customer",
                        "الناقل يستلم من العميل",
                      )}
                    </SelectItem>
                    <SelectItem value="BRANCH_DROP_OFF">
                      {t(
                        "Customer drops off at a courier branch",
                        "العميل يسلّم في فرع الناقل",
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="shipping-cap" className="text-sm font-medium">
                  {t(
                    "Maximum per shipment (SAR)",
                    "الحد الأقصى لكل شحنة (ريال)",
                  )}
                </label>
                <Input
                  id="shipping-cap"
                  inputMode="decimal"
                  value={form.cap}
                  onChange={(e) => change("cap", e.target.value)}
                  maxLength={8}
                  disabled={disabled}
                  className="h-11 rounded-xl"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  {t(
                    "Use SAR 1–10,000. An estimate does not authorize charges above this limit. Unclear costs need review.",
                    "من 1 إلى 10,000 ريال. لا يجيز التقدير رسومًا أعلى من هذا الحد. تحتاج التكاليف غير الواضحة إلى مراجعة.",
                  )}
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-start justify-between gap-4 rounded-xl bg-muted/40 p-4">
              <div>
                <label
                  htmlFor="shipping-automatic"
                  className="text-sm font-medium"
                >
                  {t(
                    "Allow automatic eligible returns",
                    "السماح بالإرجاعات المؤهلة تلقائيًا",
                  )}
                </label>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t(
                    "Off by default. This records your permission for these exact settings. Customer bookings stay inactive until the return journey is connected.",
                    "غير مفعّل افتراضيًا. يسجل هذا موافقتك على هذه الإعدادات المحددة. تبقى حجوزات العملاء غير نشطة حتى ربط رحلة الإرجاع.",
                  )}
                </p>
              </div>
              <Switch
                id="shipping-automatic"
                checked={form.automaticRequested}
                onCheckedChange={(v) => change("automaticRequested", v)}
                disabled={disabled}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                disabled={disabled || !data.providerReady || !dirty}
                onClick={() => void act("save")}
              >
                {busy === "save" && (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                )}
                {busy === "save"
                  ? t("Saving…", "جارٍ الحفظ…")
                  : t("Save settings", "حفظ الإعدادات")}
              </Button>
            </div>
          </Panel>
          <Panel
            title={t("Review and approve", "المراجعة والاعتماد")}
            subtitle={t(
              "Approval applies only to the saved warehouse, courier order, collection method and limit. Reload adds no shipping fee.",
              "تنطبق الموافقة على المستودع وترتيب الناقلين وطريقة الاستلام والحد المحفوظة فقط. لا يضيف ريلود رسوم شحن.",
            )}
          >
            <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 text-sm sm:grid-cols-2">
              {[
                [
                  t("Warehouse", "المستودع"),
                  selected
                    ? selected.name === "Test return warehouse"
                      ? t("Test return warehouse", "مستودع الإرجاع التجريبي")
                      : selected.name
                    : t("Choose a warehouse", "اختر مستودعًا"),
                ],
                [
                  t("Maximum charge", "الحد الأقصى للتكلفة"),
                  Number.isFinite(cap)
                    ? money(Math.round(cap * 100))
                    : t("Enter an amount", "أدخل مبلغًا"),
                ],
                [
                  t("First choice", "الخيار الأول"),
                  shippingTestCouriers.find((c) => c.id === form.courierIds[0])
                    ?.name || t("Choose a courier", "اختر ناقلًا"),
                ],
                [
                  t("Automatic returns", "الإرجاع التلقائي"),
                  form.automaticRequested
                    ? t(
                        "Permission requested · not active",
                        "الموافقة مطلوبة · غير نشط",
                      )
                    : t("Off", "غير مفعّل"),
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="mt-1 break-words font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {data.canManage &&
              (data.settings?.state !== "APPROVED" ||
                data.policyChanged ||
                data.warehouseChanged) && (
                <>
                  <label className="mt-5 flex items-start gap-3 text-sm leading-6">
                    <Checkbox
                      checked={approval}
                      onCheckedChange={(v) => setApproval(v === true)}
                      disabled={disabled || dirty || !data.settings}
                    />
                    <span>
                      {t(
                        "I approve the saved shipping settings. I understand that customers must print return labels and shipping does not approve a product refund.",
                        "أوافق على إعدادات الشحن المحفوظة. أفهم أن العملاء يجب أن يطبعوا بوالص الإرجاع وأن الشحن لا يعني اعتماد استرداد ثمن المنتج.",
                      )}
                    </span>
                  </label>
                  <Button
                    className="mt-4"
                    disabled={
                      disabled ||
                      dirty ||
                      !approval ||
                      !data.providerReady ||
                      !data.settings
                    }
                    onClick={() => void act("approve")}
                  >
                    {busy === "approve" ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    {t("Approve saved settings", "اعتماد الإعدادات المحفوظة")}
                  </Button>
                </>
              )}
            {data.settings?.state === "APPROVED" && data.canManage && (
              <Button
                className="mt-5"
                variant="outline"
                disabled={!!busy}
                onClick={() => void act("pause")}
              >
                <Pause className="size-4" />
                {t("Pause shipping approval", "إيقاف موافقة الشحن مؤقتًا")}
              </Button>
            )}
            {dirty && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  "Save your edits before approving them.",
                  "احفظ تعديلاتك قبل اعتمادها.",
                )}
              </p>
            )}
          </Panel>
          {Boolean(data?.improvements?.length) && (
            <Panel
              title={t("What we can improve", "فرص تحسين التجربة")}
              subtitle={t(
                "Based on shipping checks from the last 30 days. Suggestions need your review; no setting changes automatically.",
                "بناءً على فحوصات الشحن خلال آخر 30 يومًا. التوصيات تحتاج مراجعتك، ولا تتغير الإعدادات تلقائيًا.",
              )}
            >
              <div className="space-y-3">
                {data!.improvements!.map((signal) => (
                  <div
                    key={signal.reason}
                    className="rounded-xl border p-3 text-sm leading-6"
                  >
                    <p className="font-medium">
                      {t(
                        `${signal.count} return(s) needed attention`,
                        `${signal.count} طلب إرجاع احتاج متابعة`,
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {signal.reason === "PARCEL_REQUIRED"
                        ? t(
                            "Add measured parcel details for the missing product and quantity.",
                            "أضف قياسات الطرد للمنتج والكمية اللذين لم تُعتمد بياناتهما.",
                          )
                        : ["ABOVE_CAP", "CHARGE_REVIEW"].includes(signal.reason)
                          ? t(
                              "Review courier costs against your approved limit. Reload will keep the limit unchanged.",
                              "راجع تكاليف الناقل مقارنة بالحد المعتمد. لن يغيّر ريلود الحد تلقائيًا.",
                            )
                          : signal.reason === "BALANCE_REQUIRED"
                            ? t(
                                "Review the shipping balance before the next booking.",
                                "راجع رصيد الشحن قبل الحجز التالي.",
                              )
                            : signal.reason === "BOOKING_UNCERTAIN"
                              ? t(
                                  "Check the existing booking with support before retrying. Funds stay reserved until its outcome is confirmed.",
                                  "راجع الحجز الحالي مع الدعم قبل المحاولة. يبقى المبلغ محجوزًا حتى تأكيد النتيجة.",
                                )
                              : t(
                                  "Review saved return cases and shipping settings to resolve these checks.",
                                  "راجع طلبات الإرجاع المحفوظة وإعدادات الشحن لمعالجة هذه الحالات.",
                                )}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <ShippingParcelForm
            store={store!}
            canManage={Boolean(data?.canManage && data?.premium)}
            profiles={data?.parcels || []}
            onSaved={() => void load(false)}
          />
          <Panel title={t("Before a booking can proceed", "قبل متابعة أي حجز")}>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              <Metric
                icon={Wallet}
                note={t("Separate from your subscription", "منفصل عن اشتراكك")}
                label={t("Available shipping funds", "رصيد الشحن المتاح")}
                value={data.wallet.availableHalalas / 100}
                decimals={2}
                suffix={t("SAR", "ر.س")}
              />
              <div className="space-y-2 text-sm leading-6">
                <p>
                  {data.policyReady ? (
                    t("Return policy published.", "تم نشر سياسة الإرجاع.")
                  ) : (
                    <Link
                      href="/app/policies"
                      className="underline underline-offset-4"
                    >
                      {t("Publish your return policy.", "انشر سياسة الإرجاع.")}
                    </Link>
                  )}
                </p>
                {data.wallet.onHold && (
                  <p className="text-review">
                    {t(
                      "Your shipping balance needs review. Approval waits until the hold is resolved.",
                      "رصيد الشحن بحاجة إلى مراجعة. ينتظر الاعتماد معالجة التعليق.",
                    )}
                  </p>
                )}
                {data.wallet.availableHalalas < Math.round(cap * 100) && (
                  <p className="text-review">
                    {t(
                      "Your available balance is below this limit. Add funds before booking.",
                      "رصيدك المتاح أقل من هذا الحد. أضف رصيدًا قبل الحجز.",
                    )}
                  </p>
                )}
                {data.wallet.unconfirmed > 0 && (
                  <p className="text-review">
                    {t(
                      "An earlier booking still needs checking. Do not create another to bypass it.",
                      "حجز سابق ما زال بحاجة إلى تحقق. لا تنشئ حجزًا آخر لتجاوزه.",
                    )}
                  </p>
                )}
                <p>
                  {t(
                    "Automatic customer bookings are not active yet.",
                    "الحجوزات التلقائية للعملاء غير نشطة بعد.",
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link
                href="/app/shipping"
                className="underline underline-offset-4"
              >
                {t("Open shipping balance", "فتح رصيد الشحن")}
              </Link>
              <Link
                href="/app/shipping/return-test"
                className="underline underline-offset-4"
              >
                {t("Check test return", "التحقق من الإرجاع التجريبي")}
              </Link>
            </div>
          </Panel>
          {!!data.history.length && (
            <Panel title={t("Recent changes", "آخر التغييرات")}>
              <ul className="divide-y">
                {data.history.map((h, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                  >
                    <span>
                      {h.event === "APPROVED"
                        ? t("Settings approved", "تم اعتماد الإعدادات")
                        : h.event === "PAUSED"
                          ? t("Approval paused", "تم إيقاف الموافقة مؤقتًا")
                          : t("New draft saved", "تم حفظ مسودة جديدة")}
                    </span>
                    <time className="text-xs text-muted-foreground">
                      {new Date(h.createdAt).toLocaleString(
                        isArabic ? "ar-SA-u-nu-latn" : "en-GB",
                      )}
                    </time>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <AnimatePresence>
            {saved && (
              <motion.p
                role="status"
                initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={TWEEN}
                className="flex gap-2 text-sm text-eligible"
              >
                <CheckCircle2 className="size-4 shrink-0" />
                {saved === "approve"
                  ? t(
                      "Approved. Automatic bookings are still inactive.",
                      "تم الاعتماد. الحجوزات التلقائية ما زالت غير نشطة.",
                    )
                  : saved === "pause"
                    ? t(
                        "Approval paused. Existing bookings are unchanged.",
                        "تم إيقاف الموافقة مؤقتًا. الحجوزات السابقة لم تتغير.",
                      )
                    : saved === "warehouse" || saved === "recoverWarehouse"
                      ? t(
                          "Warehouse verified. Choose it above to use it.",
                          "تم التحقق من المستودع. اختره أعلاه لاستخدامه.",
                        )
                      : t(
                          "Draft saved. Review and approve when ready.",
                          "تم حفظ المسودة. راجعها واعتمدها عندما تكون جاهزًا.",
                        )}
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
