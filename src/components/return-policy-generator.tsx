"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { Segmented, TWEEN } from "@/components/desk/primitives";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/locale-server";
import { cn } from "@/lib/utils";

/*
 * Free return-policy generator. Everything runs in the browser: nothing the
 * merchant types is sent anywhere. The output is a starting point, not legal
 * advice; the page says so next to the result.
 */

type Shipping = "store" | "split" | "customer";
type Refund = "original" | "credit" | "choice";
type Option = readonly [key: string, en: string, ar: string];

/** Starting values for a store type (see src/lib/policy-presets.ts). */
export type PolicyPreset = {
  days?: string;
  exchange?: boolean;
  exchangeDays?: string;
  conditions?: string[];
  exclusions?: string[];
  extraConditions?: ReadonlyArray<Option>;
  extraExclusions?: ReadonlyArray<Option>;
  refund?: Refund;
  shipping?: Shipping;
};

const EXCLUSIONS: ReadonlyArray<Option> = [
  ["care", "Personal care and cosmetics once opened", "منتجات العناية الشخصية ومستحضرات التجميل بعد فتحها"],
  ["underwear", "Underwear and swimwear", "الملابس الداخلية وملابس السباحة"],
  ["custom", "Custom-made or personalised items", "المنتجات المصنوعة حسب الطلب أو المخصصة"],
  ["perishable", "Perishable goods", "المنتجات سريعة التلف"],
  ["digital", "Digital codes and gift cards once delivered", "الأكواد الرقمية وبطاقات الهدايا بعد تسليمها"],
  ["sale", "Final-sale items marked as such before purchase", "منتجات التصفية المعلن عنها بوضوح قبل الشراء"],
];

const CONDITIONS: ReadonlyArray<Option> = [
  ["unused", "Unused and in the same condition as received", "غير مستخدم وبنفس حالة الاستلام"],
  ["packaging", "In its original packaging", "في تغليفه الأصلي"],
  ["tags", "With all tags and labels attached", "مع جميع البطاقات والملصقات"],
  ["accessories", "With all accessories and gifts included", "مع جميع الملحقات والهدايا المرفقة"],
];

function buildPolicy(o: {
  out: Locale;
  store: string;
  days: string;
  from: "delivery" | "order";
  exchange: boolean;
  exchangeDays: string;
  conditions: string[];
  exclusions: string[];
  refund: Refund;
  refundDays: string;
  shipping: Shipping;
  contact: string;
  conditionList: ReadonlyArray<Option>;
  exclusionList: ReadonlyArray<Option>;
  credit: string | null;
}) {
  const ar = o.out === "ar";
  const store = o.store.trim() || (ar ? "متجرنا" : "our store");
  const n = (v: string, fallback: string) => (/^\d{1,3}$/.test(v.trim()) ? v.trim() : fallback);
  const days = n(o.days, "14");
  const exDays = n(o.exchangeDays, "14");
  const refundDays = n(o.refundDays, "14");
  const conditions = o.conditionList.filter(([k]) => o.conditions.includes(k)).map((c) => c[ar ? 2 : 1]);
  const exclusions = o.exclusionList.filter(([k]) => o.exclusions.includes(k)).map((c) => c[ar ? 2 : 1]);
  const contact = o.contact.trim();
  const lines: string[] = [];

  if (ar) {
    lines.push(`سياسة الاسترجاع والاستبدال — ${store}`, "");
    lines.push("مدة الإرجاع");
    lines.push(`يمكنك طلب إرجاع المنتج خلال ${days} يومًا من ${o.from === "delivery" ? "تاريخ استلام الطلب" : "تاريخ الطلب"}.`);
    if (o.exchange) lines.push(`ويمكنك طلب الاستبدال خلال ${exDays} يومًا من ${o.from === "delivery" ? "تاريخ الاستلام" : "تاريخ الطلب"}، حسب توفر المنتج.`);
    lines.push("");
    if (conditions.length) {
      lines.push("حالة المنتج");
      lines.push("نقبل المنتج المُرجع إذا كان:");
      conditions.forEach((c) => lines.push(`• ${c}`));
      lines.push("");
    }
    if (exclusions.length) {
      lines.push("منتجات لا يمكن إرجاعها");
      exclusions.forEach((c) => lines.push(`• ${c}`));
      lines.push("ويحق لك دائمًا الإرجاع إذا وصلك المنتج تالفًا أو مختلفًا عن طلبك.");
      lines.push("");
    }
    lines.push("الاسترداد");
    lines.push(
      o.refund === "original"
        ? `نعيد المبلغ إلى وسيلة الدفع الأصلية خلال ${refundDays} يومًا من استلامنا للمنتج وفحصه.`
        : o.refund === "credit"
          ? `نضيف المبلغ رصيدًا في المتجر خلال ${refundDays} يومًا من استلامنا للمنتج وفحصه. إذا كان المنتج تالفًا أو خاطئًا، يمكنك طلب استرداد المبلغ إلى وسيلة الدفع الأصلية.`
          : `يمكنك اختيار استرداد المبلغ إلى وسيلة الدفع الأصلية أو رصيدًا في المتجر، خلال ${refundDays} يومًا من استلامنا للمنتج وفحصه.`,
    );
    lines.push("");
    lines.push("تكلفة شحن الإرجاع");
    lines.push(
      o.shipping === "store"
        ? "نتحمل تكلفة شحن الإرجاع في جميع الحالات."
        : o.shipping === "split"
          ? "نتحمل تكلفة شحن الإرجاع إذا كان المنتج تالفًا أو مختلفًا عن طلبك. وفي غير ذلك يتحمل العميل تكلفة الشحن."
          : "يتحمل العميل تكلفة شحن الإرجاع، إلا إذا كان المنتج تالفًا أو مختلفًا عن طلبه فنتحملها نحن.",
    );
    lines.push("");
    lines.push("كيف تطلب الإرجاع");
    lines.push(
      contact
        ? `تواصل معنا عبر ${contact}، وأرسل رقم الطلب والمنتج المطلوب إرجاعه وسبب الإرجاع، مع صورة إذا كان المنتج تالفًا. سنرد عليك بالخطوات التالية.`
        : "تواصل معنا وأرسل رقم الطلب والمنتج المطلوب إرجاعه وسبب الإرجاع، مع صورة إذا كان المنتج تالفًا. سنرد عليك بالخطوات التالية.",
    );
  } else {
    lines.push(`Return and exchange policy — ${store}`, "");
    lines.push("Return window");
    lines.push(`You can request a return within ${days} days of ${o.from === "delivery" ? "receiving your order" : "placing your order"}.`);
    if (o.exchange) lines.push(`You can request an exchange within ${exDays} days of ${o.from === "delivery" ? "delivery" : "your order date"}, subject to availability.`);
    lines.push("");
    if (conditions.length) {
      lines.push("Item condition");
      lines.push("We accept a returned item when it is:");
      conditions.forEach((c) => lines.push(`• ${c}`));
      lines.push("");
    }
    if (exclusions.length) {
      lines.push("Items that cannot be returned");
      exclusions.forEach((c) => lines.push(`• ${c}`));
      lines.push("You can always return an item that arrives damaged or different from what you ordered.");
      lines.push("");
    }
    lines.push("Refunds");
    lines.push(
      o.refund === "original"
        ? `We refund to your original payment method within ${refundDays} days of receiving and inspecting the item.`
        : o.refund === "credit"
          ? `We add the amount as store credit within ${refundDays} days of receiving and inspecting the item. If the item is damaged or wrong, you can ask for a refund to your original payment method instead.`
          : `You can choose a refund to your original payment method or store credit, within ${refundDays} days of us receiving and inspecting the item.`,
    );
    lines.push("");
    lines.push("Return shipping");
    lines.push(
      o.shipping === "store"
        ? "We cover return shipping in all cases."
        : o.shipping === "split"
          ? "We cover return shipping when the item is damaged or not what you ordered. Otherwise, the customer pays return shipping."
          : "The customer pays return shipping, unless the item is damaged or not what was ordered, in which case we cover it.",
    );
    lines.push("");
    lines.push("How to start a return");
    lines.push(
      contact
        ? `Contact us on ${contact} with your order number, the item and the reason, plus a photo if it is damaged. We will reply with the next steps.`
        : "Contact us with your order number, the item and the reason, plus a photo if it is damaged. We will reply with the next steps.",
    );
  }
  // Optional credit line: the merchant can switch it off.
  if (o.credit)
    lines.push(
      "",
      ar
        ? `أُنشئت هذه السياسة باستخدام نموذج ريلود المجاني: ${o.credit}`
        : `Created with Reload's free policy template: ${o.credit}`,
    );
  return lines.join("\n");
}

export function ReturnPolicyGenerator({
  locale,
  preset = {},
  creditUrl,
}: {
  locale: Locale;
  preset?: PolicyPreset;
  /** Public URL of the page the merchant used, for the optional credit line. */
  creditUrl: string;
}) {
  const reduce = useReducedMotion();
  const ar = locale === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);
  const [out, setOut] = useState<Locale>(locale);
  const [store, setStore] = useState("");
  const conditionList = useMemo(() => [...CONDITIONS, ...(preset.extraConditions ?? [])], [preset.extraConditions]);
  const exclusionList = useMemo(() => [...EXCLUSIONS, ...(preset.extraExclusions ?? [])], [preset.extraExclusions]);
  const [days, setDays] = useState(preset.days ?? "14");
  const [from, setFrom] = useState<"delivery" | "order">("delivery");
  const [exchange, setExchange] = useState(preset.exchange ?? true);
  const [exchangeDays, setExchangeDays] = useState(preset.exchangeDays ?? "14");
  const [conditions, setConditions] = useState<string[]>(preset.conditions ?? ["unused", "packaging", "tags"]);
  const [exclusions, setExclusions] = useState<string[]>(preset.exclusions ?? ["care", "underwear", "custom"]);
  const [refund, setRefund] = useState<Refund>(preset.refund ?? "original");
  const [refundDays, setRefundDays] = useState("14");
  const [shipping, setShipping] = useState<Shipping>(preset.shipping ?? "split");
  const [contact, setContact] = useState("");
  const [copied, setCopied] = useState(false);
  const [credit, setCredit] = useState(true);

  const policy = useMemo(
    () =>
      buildPolicy({
        out, store, days, from, exchange, exchangeDays, conditions, exclusions, refund, refundDays, shipping, contact,
        conditionList, exclusionList, credit: credit ? creditUrl : null,
      }),
    [out, store, days, from, exchange, exchangeDays, conditions, exclusions, refund, refundDays, shipping, contact, conditionList, exclusionList, credit, creditUrl],
  );

  const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(policy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the text is selectable, so nothing else to do.
    }
  }

  const label = "text-sm font-medium";
  const hint = "mt-1 text-xs text-muted-foreground";
  const dayField = (value: string, set: (v: string) => void, id: string, aria: string) => (
    <Input
      id={id}
      inputMode="numeric"
      aria-label={aria}
      value={value}
      onChange={(e) => set(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
      className="h-9 w-20 rounded-xl text-center tabular-nums"
    />
  );

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
      <form className="space-y-9" onSubmit={(e) => e.preventDefault()} aria-label={t("Policy options", "خيارات السياسة")}>
        <div>
          <label htmlFor="rp-store" className={label}>{t("Store name", "اسم المتجر")}</label>
          <Input id="rp-store" value={store} onChange={(e) => setStore(e.target.value.slice(0, 60))} placeholder={t("e.g. Noura Boutique", "مثال: بوتيك نورة")} className="mt-2 h-10 rounded-xl" />
        </div>

        <div>
          <p className={label}>{t("Return window", "مدة الإرجاع")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {dayField(days, setDays, "rp-days", t("Return window in days", "مدة الإرجاع بالأيام"))}
            <span className="text-sm text-muted-foreground">{t("days from", "يومًا من")}</span>
            <Segmented
              label={t("Count from", "تبدأ المدة من")}
              value={from}
              onChange={setFrom}
              options={[
                { value: "delivery", label: t("Delivery", "الاستلام") },
                { value: "order", label: t("Order date", "تاريخ الطلب") },
              ]}
            />
          </div>
          <p className={hint}>{t("Never shorter than current Saudi consumer rules require.", "يجب ألا تقل عن المدة التي تفرضها أنظمة حماية المستهلك الحالية.")}</p>
        </div>

        <div>
          <label className="flex items-center gap-3">
            <Checkbox checked={exchange} onCheckedChange={(v) => setExchange(v === true)} />
            <span className={label}>{t("Allow exchanges", "السماح بالاستبدال")}</span>
          </label>
          <AnimatePresence initial={false}>
            {exchange && (
              <motion.div
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduce ? undefined : { height: 0, opacity: 0 }}
                transition={{ ...TWEEN, duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 ps-7 pt-3">
                  {dayField(exchangeDays, setExchangeDays, "rp-exdays", t("Exchange window in days", "مدة الاستبدال بالأيام"))}
                  <span className="text-sm text-muted-foreground">{t("days to exchange", "يومًا للاستبدال")}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <fieldset>
          <legend className={label}>{t("Accepted condition", "حالة المنتج المقبولة")}</legend>
          <div className="mt-3 space-y-3">
            {conditionList.map(([key, en, arText]) => (
              <label key={key} className="flex items-start gap-3 text-sm">
                <Checkbox className="mt-0.5" checked={conditions.includes(key)} onCheckedChange={() => toggle(conditions, setConditions, key)} />
                {t(en, arText)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={label}>{t("Items that can’t be returned", "منتجات لا يمكن إرجاعها")}</legend>
          <div className="mt-3 space-y-3">
            {exclusionList.map(([key, en, arText]) => (
              <label key={key} className="flex items-start gap-3 text-sm">
                <Checkbox className="mt-0.5" checked={exclusions.includes(key)} onCheckedChange={() => toggle(exclusions, setExclusions, key)} />
                {t(en, arText)}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <p className={label}>{t("Refund method", "طريقة الاسترداد")}</p>
          <Segmented
            className="mt-2 flex-wrap"
            label={t("Refund method", "طريقة الاسترداد")}
            value={refund}
            onChange={setRefund}
            options={[
              { value: "original", label: t("Original payment", "وسيلة الدفع") },
              { value: "credit", label: t("Store credit", "رصيد المتجر") },
              { value: "choice", label: t("Customer chooses", "يختار العميل") },
            ]}
          />
          <div className="mt-3 flex items-center gap-3">
            {dayField(refundDays, setRefundDays, "rp-refund", t("Refund time in days", "مدة الاسترداد بالأيام"))}
            <span className="text-sm text-muted-foreground">{t("days after inspection", "يومًا بعد الفحص")}</span>
          </div>
        </div>

        <div>
          <p className={label}>{t("Who pays return shipping?", "من يتحمل شحن الإرجاع؟")}</p>
          <Segmented
            className="mt-2 flex-wrap"
            label={t("Return shipping", "شحن الإرجاع")}
            value={shipping}
            onChange={setShipping}
            options={[
              { value: "split", label: t("Depends on reason", "حسب السبب") },
              { value: "store", label: t("Store", "المتجر") },
              { value: "customer", label: t("Customer", "العميل") },
            ]}
          />
        </div>

        <div>
          <label htmlFor="rp-contact" className={label}>{t("How customers reach you", "كيف يتواصل العميل معك")}</label>
          <Input id="rp-contact" value={contact} onChange={(e) => setContact(e.target.value.slice(0, 80))} placeholder={t("e.g. WhatsApp 05x xxx xxxx", "مثال: واتساب 05x xxx xxxx")} className="mt-2 h-10 rounded-xl" />
        </div>
      </form>

      <section aria-label={t("Your policy", "سياستك")} className="lg:sticky lg:top-24 lg:self-start lg:border-s lg:ps-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{t("Your policy", "سياستك")}</h2>
          <div className="flex items-center gap-2">
            <Segmented
              label={t("Policy language", "لغة السياسة")}
              value={out}
              onChange={setOut}
              options={[
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
              ]}
            />
            <button
              type="button"
              onClick={() => void copy()}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-medium transition-[transform,background-color,color] duration-200 active:scale-[.97]",
                copied ? "bg-eligible text-white" : "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? "done" : "copy"}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="inline-flex items-center gap-1.5"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? t("Copied", "تم النسخ") : t("Copy", "نسخ")}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
        <motion.div
          key={out}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...TWEEN, duration: 0.3 }}
          dir={out === "ar" ? "rtl" : "ltr"}
          lang={out}
          className="mt-6 whitespace-pre-wrap text-sm leading-7 text-foreground/90 [&::selection]:bg-primary/20"
        >
          {policy}
        </motion.div>
        <label className="mt-8 flex items-center justify-between gap-4 border-t pt-4 text-xs text-muted-foreground">
          <span>{t("Add a small “Created with Reload” line", "أضف سطرًا صغيرًا «أُنشئت باستخدام ريلود»")}</span>
          <Switch checked={credit} onCheckedChange={setCredit} aria-label={t("Credit line", "سطر الإشارة إلى ريلود")} />
        </label>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          {t(
            "A starting point, not legal advice. Check the current requirements on the Ministry of Commerce website before publishing. Nothing you type here is sent or saved.",
            "نقطة بداية وليست استشارة قانونية. راجع المتطلبات الحالية على موقع وزارة التجارة قبل النشر. لا يُرسل أو يُحفظ أي شيء تكتبه هنا.",
          )}
        </p>
      </section>
    </div>
  );
}
