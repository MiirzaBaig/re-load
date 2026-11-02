"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FlaskConical,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  TriangleAlert,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, Panel, TWEEN } from "@/components/desk/primitives";
import {
  sampleParcel,
  sandboxCities,
  type City,
  type QuoteInput,
  type SandboxConnection,
  type SandboxQuotes,
  type CourierRate,
} from "@/lib/oto/contracts";

const initial: QuoteInput = {
  originCity: "Riyadh",
  destinationCity: "Riyadh",
  ...sampleParcel,
};
export function ShippingSandbox({
  showWalletTest = false,
}: {
  showWalletTest?: boolean;
}) {
  const { t, isArabic, toggleLocale } = useLanguage();
  const reduced = useReducedMotion();
  const [input, setInput] = useState<QuoteInput>(initial);
  const [connection, setConnection] = useState<SandboxConnection | null>(null);
  const [quotes, setQuotes] = useState<SandboxQuotes | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connection" | "quote" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<
    Record<"weight" | "length" | "width" | "height", string>
  >({ weight: "1", length: "30", width: "20", height: "12" });
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const cityName = (city: City) =>
    ({
      Riyadh: t("Riyadh", "الرياض"),
      Jeddah: t("Jeddah", "جدة"),
      Dammam: t("Dammam", "الدمام"),
    })[city];
  const money = (value: number | null) =>
    value === null
      ? t("Not supplied", "غير متاح")
      : new Intl.NumberFormat(isArabic ? "ar-SA" : "en-SA", {
          style: "currency",
          currency: "SAR",
        }).format(value);
  const choice: CourierRate | undefined = quotes?.rates.find(
    (rate) => rate.id === selected,
  );
  const errorCopy: Record<string, string> = {
    access_denied: t(
      "Owner access is needed. Sign in again to continue.",
      "يلزم حساب مالك. سجّل الدخول مجددًا للمتابعة.",
    ),
    disabled: t(
      "Sandbox testing is not enabled on this website yet.",
      "لم يُفعّل الاختبار التجريبي على هذا الموقع بعد.",
    ),
    configuration: t(
      "The sandbox connection needs configuration. Ask the Reload owner to check it.",
      "يحتاج الربط التجريبي إلى إعداد. اطلب من مالك ريلود مراجعته.",
    ),
    invalid_input: t(
      "Check the cities and parcel measurements. Weight: up to 30 kg. Each dimension: up to 150 cm. Use at most two decimal places.",
      "راجع المدن وأبعاد الطرد. الوزن حتى 30 كجم وكل بُعد حتى 150 سم، وبحد أقصى منزلتان عشريتان.",
    ),
    authentication: t(
      "OTO could not verify the sandbox credential. Check the connection before continuing.",
      "لم يتمكن أوتو من التحقق من بيانات الربط التجريبي. راجع الاتصال قبل المتابعة.",
    ),
  };
  async function run(action: "connection" | "quote") {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(action);
    setError(null);
    // Old rates must never look current after a failed refresh or edited parcel.
    if (action === "quote") {
      setQuotes(null);
      setSelected(null);
    }
    const timeout = setTimeout(() => controller.abort(), 65_000);
    try {
      const response = await fetch("/api/admin/shipping/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "connection"
            ? { action }
            : {
                action,
                input: {
                  ...input,
                  ...Object.fromEntries(
                    Object.entries(draft).map(([key, value]) => [
                      key,
                      Number(
                        value.replace(/[٠-٩۰-۹]/g, (c) =>
                          String(c.charCodeAt(0) - (c <= "٩" ? 0x660 : 0x6f0)),
                        ),
                      ),
                    ]),
                  ),
                },
              },
        ),
        cache: "no-store",
        signal: controller.signal,
      });
      const value = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          setConnection(null);
          setQuotes(null);
          setSelected(null);
        }
        throw new Error(
          typeof value.error === "string" ? value.error : "unavailable",
        );
      }
      if (action === "connection") setConnection(value as SandboxConnection);
      else setQuotes(value as SandboxQuotes);
    } catch (cause) {
      if (!controller.signal.aborted || active.current === controller)
        setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        setBusy(null);
      }
    }
  }
  function edit() {
    setQuotes(null);
    setSelected(null);
    setError(null);
  }
  return (
    <main className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-7 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {showWalletTest && (
          <Link
            href="/app/shipping"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            {t("Test shipping balance", "اختبار رصيد الشحن")}
          </Link>
        )}
        <Link
          href="/admin?view=activity"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("Back to Activity", "العودة إلى النشاط")}
        </Link>
        <Button variant="ghost" size="sm" onClick={toggleLocale}>
          {isArabic ? "English" : "العربية"}
        </Button>
      </header>
      <div className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <FlaskConical className="size-3.5" />
          {t(
            "Owner testing · OTO sandbox",
            "اختبار المالك · بيئة أوتو التجريبية",
          )}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("Try a return journey", "جرّب رحلة الإرجاع")}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {t(
            "A sample return from a customer to the store. Check the connection, compare sandbox rates and review a courier. No shipment is booked here.",
            "إرجاع تجريبي من العميل إلى المتجر. تحقّق من الاتصال وقارن الأسعار التجريبية وراجع الناقل. لا يتم حجز شحنة هنا.",
          )}
        </p>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-review/25 bg-review/10 p-4 text-sm leading-6">
        <ShieldCheck className="mt-1 size-4 shrink-0 text-amber-800 dark:text-review" />
        <p>
          {t(
            "Sample route and parcel only. No customer phone, email or street address is required. These prices are test data, not a live shipping offer.",
            "مسار وطرد تجريبيان فقط. لا نحتاج هاتف العميل أو بريده أو عنوانه. هذه أسعار اختبار وليست عرض شحن فعليًا.",
          )}
        </p>
      </div>
      <Panel
        title={t("1 · Check the connection", "1 · التحقق من الاتصال")}
        subtitle={t(
          "Use Reload’s configured sandbox account.",
          "استخدم حساب ريلود التجريبي المُعد مسبقًا.",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 text-sm" aria-live="polite">
            {connection ? (
              <span className="inline-flex items-center gap-2 text-emerald-800 dark:text-eligible">
                <Check className="size-4" />
                {t("Sandbox connected", "البيئة التجريبية متصلة")}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t("Ready to check", "جاهز للتحقق")}
              </span>
            )}
            {connection && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Checked", "آخر تحقق")}:{" "}
                {new Date(connection.checkedAt).toLocaleTimeString(
                  isArabic ? "ar-SA" : "en-GB",
                  { hour: "2-digit", minute: "2-digit" },
                )}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => void run("connection")}
          >
            <RefreshCw
              className={`size-4 ${busy === "connection" ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
            {busy === "connection"
              ? t("Checking…", "جارٍ التحقق…")
              : t("Check connection", "تحقق من الاتصال")}
          </Button>
        </div>
      </Panel>
      <Panel
        title={t("2 · Set up the sample parcel", "2 · إعداد الطرد التجريبي")}
        subtitle={t(
          "One pair of test shoes. Collection → return destination.",
          "زوج أحذية تجريبي واحد. الاستلام ← وجهة الإرجاع.",
        )}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("quote");
          }}
          className="space-y-5"
        >
          <fieldset
            disabled={busy !== null}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2"
          >
            {(["originCity", "destinationCity"] as const).map((key) => (
              <div key={key} className="min-w-0 space-y-2">
                <label id={`${key}-label`} className="text-sm font-medium">
                  {key === "originCity"
                    ? t("Customer city", "مدينة العميل")
                    : t("Store return city", "مدينة إرجاع المتجر")}
                </label>
                <Select
                  value={input[key]}
                  onValueChange={(value) => {
                    edit();
                    setInput((v) => ({ ...v, [key]: value as City }));
                  }}
                >
                  <SelectTrigger
                    aria-labelledby={`${key}-label`}
                    className="h-11 w-full rounded-xl bg-background"
                  >
                    <MapPin className="size-4 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sandboxCities.map((city) => (
                      <SelectItem value={city} key={city}>
                        {cityName(city)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {(["weight", "length", "width", "height"] as const).map((key) => (
              <div key={key} className="min-w-0 space-y-2">
                <label htmlFor={key} className="text-sm font-medium">
                  {
                    {
                      weight: t("Weight (kg)", "الوزن (كجم)"),
                      length: t("Length (cm)", "الطول (سم)"),
                      width: t("Width (cm)", "العرض (سم)"),
                      height: t("Height (cm)", "الارتفاع (سم)"),
                    }[key]
                  }
                </label>
                <Input
                  id={key}
                  inputMode="decimal"
                  required
                  maxLength={8}
                  value={draft[key]}
                  onChange={(e) => {
                    edit();
                    setDraft((v) => ({ ...v, [key]: e.target.value }));
                  }}
                  className="h-11 rounded-xl"
                  aria-describedby="measurements-hint"
                />
              </div>
            ))}
          </fieldset>
          <p
            id="measurements-hint"
            className="text-xs leading-5 text-muted-foreground"
          >
            {t(
              "Use the outer package dimensions. OTO may price by size or weight. Requesting rates does not create an order or reserve a courier.",
              "استخدم أبعاد التغليف الخارجي. قد يعتمد السعر على الحجم أو الوزن. طلب الأسعار لا ينشئ طلبًا ولا يحجز ناقلًا.",
            )}
          </p>
          <Button
            type="submit"
            disabled={busy !== null}
            className="w-full sm:w-auto"
          >
            <Truck className="size-4" />
            {busy === "quote"
              ? t("Finding test rates…", "جارٍ البحث عن أسعار تجريبية…")
              : t("Get sandbox rates", "عرض الأسعار التجريبية")}
          </Button>
        </form>
      </Panel>
      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: reduced ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={TWEEN}
            className="flex gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">
                {t("This step needs attention", "تحتاج هذه الخطوة إلى مراجعة")}
              </p>
              <p className="mt-1 leading-6 text-muted-foreground">
                {errorCopy[error] ??
                  t(
                    "We couldn’t get a confirmed response from OTO. No shipment was created. Try this check again.",
                    "تعذر تأكيد رد أوتو. لم يتم إنشاء شحنة. أعد محاولة التحقق.",
                  )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {busy === "quote" && (
        <div
          role="status"
          aria-label={t("Loading courier rates", "تحميل أسعار الناقلين")}
          className="space-y-3"
        >
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}
      <AnimatePresence mode="wait">
        {quotes && (
          <motion.div
            key={quotes.checkedAt}
            initial={{ opacity: 0, y: reduced ? 0 : 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={TWEEN}
          >
            <Panel
              title={t(
                "3 · Compare test couriers",
                "3 · مقارنة الناقلين التجريبيين",
              )}
              subtitle={`${cityName(quotes.input.originCity)} → ${cityName(quotes.input.destinationCity)} · ${quotes.input.weight} ${t("kg", "كجم")}`}
            >
              {!quotes.rates.length ? (
                <EmptyState
                  icon={Truck}
                  title={t(
                    "No test rates for this parcel",
                    "لا تتوفر أسعار تجريبية لهذا الطرد",
                  )}
                  text={t(
                    "Try another sample city or check the measurements.",
                    "جرّب مدينة تجريبية أخرى أو راجع القياسات.",
                  )}
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t(
                      "Return fee is shown separately from delivery price. Tax, surcharges and the final reverse-shipment charge still need verification. Courier names come from OTO’s sandbox.",
                      "تظهر رسوم الإرجاع منفصلة عن سعر التوصيل. لا تزال الضريبة والرسوم الإضافية والتكلفة النهائية بحاجة إلى تحقق. أسماء الناقلين مصدرها بيئة أوتو التجريبية.",
                    )}
                  </p>
                  <div
                    role="radiogroup"
                    aria-label={t("Test couriers", "الناقلون التجريبيون")}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2"
                  >
                    {quotes.rates.map((rate) => (
                      <label
                        key={rate.id}
                        className={`relative flex min-w-0 cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${selected === rate.id ? "border-foreground bg-muted/50" : "border-border hover:bg-muted/30"}`}
                      >
                        <input
                          type="radio"
                          name="courier"
                          value={rate.id}
                          checked={selected === rate.id}
                          onChange={() => setSelected(rate.id)}
                          className="mt-1 shrink-0 accent-foreground"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="break-words text-sm font-medium"
                            dir="auto"
                          >
                            {rate.name}
                          </p>
                          <dl className="mt-3 space-y-1 text-xs">
                            <div className="flex flex-wrap justify-between gap-2">
                              <dt className="text-muted-foreground">
                                {t("Return fee", "رسوم الإرجاع")}
                              </dt>
                              <dd className="font-semibold">
                                <bdi>{money(rate.returnFee)}</bdi>
                              </dd>
                            </div>
                            <div className="flex flex-wrap justify-between gap-2">
                              <dt className="text-muted-foreground">
                                {t("Delivery price", "سعر التوصيل")}
                              </dt>
                              <dd>
                                <bdi>{money(rate.price)}</bdi>
                              </dd>
                            </div>
                          </dl>
                          <p className="mt-3 text-xs text-muted-foreground">
                            {rate.sandboxBookable
                              ? t(
                                  "Documented sandbox test courier",
                                  "ناقل اختبار موثق للبيئة التجريبية",
                                )
                              : t("Rate comparison only", "للمقارنة فقط")}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {choice && (
          <motion.div
            key={choice.id}
            initial={{ opacity: 0, y: reduced ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={TWEEN}
          >
            <Panel title={t("Your sample selection", "اختيارك التجريبي")}>
              <div className="flex items-start gap-3">
                <Package className="mt-1 size-5 shrink-0" />
                <div className="min-w-0">
                  <p className="break-words font-medium" dir="auto">
                    {choice.name}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(
                      "One pair of test shoes · 1 parcel",
                      "زوج أحذية تجريبي · طرد واحد",
                    )}
                  </p>
                  <p className="mt-1 text-sm">
                    {t("Quoted return fee", "رسوم الإرجاع المعروضة")}:{" "}
                    <bdi>{money(choice.returnFee)}</bdi>
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {t(
                      "Selection reviewed. Nothing has been booked. The next integration stage will create a test return, retrieve the label and verify tracking before merchant shipping is enabled.",
                      "تمت مراجعة الاختيار دون حجز. ستنشئ المرحلة التالية إرجاعًا تجريبيًا وتسترجع البوليصة وتتحقق من التتبع قبل تفعيل شحن التجار.",
                    )}
                  </p>
                </div>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
      <details className="rounded-2xl border p-4 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
          {t(
            "How this becomes merchant shipping",
            "كيف تصبح هذه التجربة خدمة شحن للتاجر",
          )}
          <ChevronDown className="size-4" />
        </summary>
        <p className="mt-3 leading-6 text-muted-foreground">
          {t(
            "A Premium merchant will open a return case, verify collection and warehouse details, choose a courier and approve the separate shipping charge. Booking, labels, tracking and safe recovery come next. Courier delivery will not automatically approve inspection or issue a refund.",
            "سيفتح تاجر بريميوم حالة الإرجاع ويتحقق من بيانات الاستلام والمستودع ويختار الناقل ويوافق على رسوم الشحن المنفصلة. يلي ذلك الحجز والبوليصة والتتبع ومعالجة النتائج غير المؤكدة. تسليم الناقل لا يعني اعتماد الفحص أو استرداد المبلغ تلقائيًا.",
          )}
        </p>
      </details>
    </main>
  );
}
