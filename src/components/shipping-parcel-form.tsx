"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Package, Loader2 } from "lucide-react";
import { FeedbackNote } from "@/components/ui/feedback-note";
import { useLanguage } from "@/components/language-provider";
import { Panel } from "@/components/desk/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { testDigits } from "@/lib/oto/return-contract";
export type ParcelProfile = {
  sku: string;
  quantity: number;
  version: number;
  weight_grams: number;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  approved_at: string;
};
const empty = {
  sku: "",
  quantity: "1",
  weight: "",
  length: "",
  width: "",
  height: "",
};
export function ShippingParcelForm({
  store,
  canManage,
  profiles = [],
  onSaved,
}: {
  store: string;
  canManage: boolean;
  profiles: ParcelProfile[];
  onSaved: () => void;
}) {
  const { t } = useLanguage(); // reduced motion is handled inside FeedbackNote
  const [form, setForm] = useState({ ...empty }),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [saved, setSaved] = useState(false),
    // Changes on every approval so the success tick replays.
    [savedAt, setSavedAt] = useState(0);
  const current = useRef(store),
    lock = useRef(false);
  current.current = store;
  useEffect(() => {
    setForm({ ...empty });
    setConsent(false);
    setError(false);
    setSaved(false);
    setBusy(false);
    lock.current = false;
  }, [store]);
  const match = profiles.find(
    (p) =>
      p.sku === form.sku.trim() &&
      p.quantity === Number(testDigits(form.quantity)),
  );
  function change(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setConsent(false);
    setSaved(false);
    setError(false);
  }
  function edit(p: ParcelProfile) {
    setForm({
      sku: p.sku,
      quantity: String(p.quantity),
      weight: String(p.weight_grams / 1000),
      length: String(p.length_mm / 10),
      width: String(p.width_mm / 10),
      height: String(p.height_mm / 10),
    });
    setConsent(false);
    setSaved(false);
  }
  async function save() {
    if (lock.current || !canManage || !consent) return;
    const n = (v: string) => Number(testDigits(v));
    const qty = n(form.quantity),
      weight = n(form.weight) * 1000,
      len = n(form.length) * 10,
      wid = n(form.width) * 10,
      hei = n(form.height) * 10;
    if (
      !form.sku.trim() ||
      form.sku.length > 100 ||
      !Number.isSafeInteger(qty) ||
      qty < 1 ||
      qty > 20 ||
      [weight, len, wid, hei].some((x) => !Number.isSafeInteger(x) || x < 1) ||
      weight > 30000 ||
      [len, wid, hei].some((x) => x > 1500)
    ) {
      setError(true);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(false);
    setSaved(false);
    const target = store;
    try {
      const r = await fetch("/api/shipping/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: target,
          action: "parcel",
          input: {
            sku: form.sku.trim(),
            quantity: qty,
            version: match?.version || 0,
            weightGrams: weight,
            lengthMm: len,
            widthMm: wid,
            heightMm: hei,
            consent: true,
          },
        }),
        signal: AbortSignal.timeout(90000),
      });
      if (!r.ok) throw Error();
      if (current.current !== target) return;
      setSaved(true);
      setSavedAt(Date.now());
      setConsent(false);
      onSaved();
    } catch {
      if (current.current === target) setError(true);
    } finally {
      if (current.current === target) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <Panel
      title={t("Packed parcel details", "تفاصيل الطرد بعد التغليف")}
      subtitle={t(
        "Measure the packed return, including its box. Approve one product code and quantity at a time.",
        "قِس طرد الإرجاع بعد التغليف، مع الصندوق. اعتمد رمز منتج وكمية محددين في كل مرة.",
      )}
    >
      <div className="space-y-5">
        <div className="flex gap-3 rounded-xl bg-muted/50 p-4 text-sm leading-6">
          <Package className="mt-1 size-5 shrink-0" />
          <p>
            {t(
              "Reload uses your measurements for shipping rates. It will never guess the weight or multiply a single item’s weight for a larger return. Shipping still needs customer confirmation and your approved cost limit.",
              "يستخدم ريلود قياساتك لحساب الشحن، ولا يخمّن الوزن أو يضاعف وزن قطعة واحدة لإرجاع أكبر. يبقى تأكيد العميل وحد التكلفة المعتمد مطلوبين.",
            )}
          </p>
        </div>
        {profiles.length > 0 && (
          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.sku + ":" + p.quantity}
                type="button"
                disabled={busy || !canManage}
                onClick={() => edit(p)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-start text-sm transition-colors hover:bg-muted/50 disabled:cursor-default"
              >
                <span className="font-medium">
                  {p.sku} · {t(`${p.quantity} item(s)`, `${p.quantity} قطعة`)}
                </span>
                <span className="text-muted-foreground" dir="ltr">
                  {p.weight_grams / 1000} kg · {p.length_mm / 10} ×{" "}
                  {p.width_mm / 10} × {p.height_mm / 10} cm
                </span>
              </button>
            ))}
          </div>
        )}
        <fieldset
          disabled={!canManage || busy}
          className="space-y-4 disabled:opacity-60"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["sku", t("Product code (SKU)", "رمز المنتج (SKU)"), "text"],
                [
                  "quantity",
                  t("Items in this parcel", "عدد القطع في هذا الطرد"),
                  "numeric",
                ],
                [
                  "weight",
                  t("Packed weight (kg)", "الوزن بعد التغليف (كجم)"),
                  "decimal",
                ],
                ["length", t("Length (cm)", "الطول (سم)"), "decimal"],
                ["width", t("Width (cm)", "العرض (سم)"), "decimal"],
                ["height", t("Height (cm)", "الارتفاع (سم)"), "decimal"],
              ] as const
            ).map(([key, label, mode]) => (
              <label key={key} className="space-y-2 text-sm font-medium">
                <span>{label}</span>
                <Input
                  value={form[key]}
                  inputMode={mode}
                  maxLength={key === "sku" ? 100 : 8}
                  onChange={(e) => change(key, e.target.value)}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {t(
              "Use the exact SKU from your store. Weight: up to 30 kg. Each side: up to 150 cm. For a different quantity, approve its own packed measurements.",
              "استخدم رمز المنتج كما هو في المتجر. الوزن حتى 30 كجم، وكل بُعد حتى 150 سم. اعتمد قياسات مستقلة لكل كمية مختلفة.",
            )}
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-6">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-1"
            />
            <span>
              {t(
                "I measured this packed parcel and approve these details for this exact product and quantity.",
                "قست هذا الطرد بعد التغليف وأعتمد هذه التفاصيل لهذا المنتج وهذه الكمية تحديدًا.",
              )}
            </span>
          </label>
          <Button
            type="button"
            disabled={!consent || busy || !canManage}
            onClick={() => void save()}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t(
              match ? "Update approved parcel" : "Approve parcel details",
              match ? "تحديث قياسات الطرد المعتمدة" : "اعتماد تفاصيل الطرد",
            )}
          </Button>
        </fieldset>
        <AnimatePresence mode="wait" initial={false}>
          {(error || saved) && (
            <FeedbackNote key={error ? "error" : "saved-" + savedAt} tone={error ? "error" : "success"}>
              {error
                ? t(
                    "We couldn’t save these details. Check the measurements and your Premium access. If another tab changed this parcel, reload the latest settings before trying again.",
                    "تعذّر حفظ التفاصيل. تحقق من القياسات واشتراك بريميوم. إذا تغيرت البيانات في تبويب آخر، حمّل أحدث الإعدادات قبل المحاولة.",
                  )
                : t(
                    "Parcel details approved. No shipment was booked.",
                    "اعتُمدت تفاصيل الطرد. لم يُحجز شحن.",
                  )}
            </FeedbackNote>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}
