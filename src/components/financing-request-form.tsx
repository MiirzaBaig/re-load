"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  Phone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatsAppLogo } from "@/components/phone-frame";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getWhatsAppStartUrl } from "@/lib/whatsapp";
import { smoothAnchorClick } from "@/lib/smooth-scroll";
import { useLanguage } from "@/components/language-provider";
import { Tone } from "@/components/heading-accent";
import { cn } from "@/lib/utils";

/** The estimate the merchant was looking at when they asked. */
export interface FinancingSnapshot {
  monthlyReturns: number;
  orderValue: number;
  processingMinutes: number;
  resolutionDays: number;
  hourlyCost: number;
  tiedUp: number;
  operatingCost: number;
}

type Status = "idle" | "sending" | "sent" | "error";
type Interest = "returns" | "financing" | "both";
type Contact = "whatsapp" | "call" | "email";

/** Columns added by 202609290001. Stripped on retry if that migration is not
 *  applied yet, so a lead is never lost to a schema that lags the UI. */
const QUALIFICATION_COLUMNS = [
  "website",
  "interest",
  "preferred_contact",
  "partner_sharing_consent",
] as const;

/**
 * The contact / financing section, open on the page (not behind a dialog) so
 * a visitor can find it by scrolling, by the navbar "Contact" link, or from the
 * calculator. It sits directly under the calculator and shares its state, so
 * the estimate shown here updates live as the sliders move.
 */
export function FinancingSection({
  snapshot,
}: {
  snapshot: FinancingSnapshot;
}) {
  const { t, n, isArabic } = useLanguage();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [interest, setInterest] = useState<Interest>("both");
  const [contact, setContact] = useState<Contact>("whatsapp");
  const [figuresOpen, setFiguresOpen] = useState(false);
  const [firstName, setFirstName] = useState("");

  const needsPhone = contact !== "email";
  const tiedUp = n(Math.round(useTweened(snapshot.tiedUp)), { maximumFractionDigits: 0 });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const metric = (key: string) => (text(key) === "" ? null : Number(form.get(key)));
    setStatus("sending");
    setError(null);

    // The figures go in with the contact details: the estimate on screen is
    // what the merchant is asking about, and recomputing it later from inputs
    // they may have changed would not be the same request.
    const payload: Record<string, unknown> = {
      store_name: text("store"),
      contact_name: text("name"),
      email: text("email"),
      phone: text("phone") || null,
      store_platform: text("platform"),
      website: text("website") || null,
      interest,
      preferred_contact: contact,
      monthly_sales: metric("monthly_sales"),
      monthly_orders: metric("monthly_orders"),
      return_rate: metric("return_rate"),
      average_refund_amount: metric("average_refund_amount"),
      monthly_refund_volume: metric("monthly_refund_volume"),
      refund_processing_days: metric("refund_processing_days"),
      desired_financing_days: metric("desired_financing_days"),
      contact_consent: form.get("consent") === "on",
      partner_sharing_consent: form.get("partner_consent") === "on",
      monthly_returns: Math.round(snapshot.monthlyReturns),
      average_order_value: snapshot.orderValue,
      processing_minutes: Math.round(snapshot.processingMinutes),
      resolution_days: snapshot.resolutionDays,
      hourly_cost: snapshot.hourlyCost,
      tied_up_amount: Math.round(snapshot.tiedUp),
      operating_cost: Math.round(snapshot.operatingCost),
      locale: isArabic ? "ar" : "en",
    };

    try {
      const supabase = getSupabaseBrowserClient();
      let { error: insertError } = await supabase
        .from("financing_requests")
        .insert(payload);

      // PGRST204: a column in the payload does not exist yet. Retry with the
      // original columns rather than dropping the merchant's request.
      if (insertError?.code === "PGRST204") {
        const fallback = { ...payload };
        for (const column of QUALIFICATION_COLUMNS) delete fallback[column];
        ({ error: insertError } = await supabase
          .from("financing_requests")
          .insert(fallback));
      }

      if (insertError) throw insertError;
      setFirstName(text("name").split(/\s+/)[0] ?? "");
      setStatus("sent");
    } catch {
      // Never strand the merchant on a dead form: show the failure and leave
      // their input in place so they can retry without retyping.
      setStatus("error");
      setError(
        t(
          "We couldn’t save your details. Please try again; everything you typed is still here.",
          "تعذّر حفظ بياناتك. حاول مرة أخرى، كل ما كتبته ما زال موجودًا.",
        ),
      );
    }
  };

  const reset = () => {
    setStatus("idle");
    setError(null);
    setFiguresOpen(false);
  };

  return (
    <section id="contact" aria-labelledby="contact-title" className="fin-section scroll-mt-24">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 md:py-28 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        {/* Left: the why, pinned while the form scrolls on desktop. */}
        <div className="fin-aside">
          <span className="text-sm font-semibold text-foreground/70">
            {t("Talk to Reload", "تواصل مع ريلود")}
          </span>
          <h2
            id="contact-title"
            className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-balance md:text-[40px] md:leading-[1.1]"
          >
            {t("Let's talk about ", "خلنا نفهم ")}
            <Tone>{t("your store.", "متجرك.")}</Tone>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
            {t("Share a few details and we'll reach you the way you prefer.", "شاركنا بيانات بسيطة ونتواصل معك بالطريقة اللي تناسبك.")}
          </p>

          {/* Live-linked to the calculator above. */}
          <div className="fin-estimate mt-8">
            <span className="fin-estimate-label">
              {t("Your estimate", "تقديرك")}
            </span>
            <span className="fin-estimate-value">
              <span className="fin-estimate-currency">{t("SAR", "ر.س")}</span>
              <span dir="ltr" className="tabular-nums">{tiedUp}</span>
            </span>
            <span className="fin-estimate-note">
              {t("tied up in slow returns · added to your request", "عالقة في المرتجعات المتأخرة · مُرفقة بطلبك")}
            </span>
            <a href="#returns-financing" onClick={smoothAnchorClick} className="fin-estimate-edit">
              {t("Adjust in the calculator", "عدّل في الحاسبة")}
              <ArrowRight className="size-3 -rotate-90" />
            </a>
          </div>

          <ol className="fin-steps mt-8">
            {[
              t("You share your store details", "تشاركنا تفاصيل متجرك"),
              t("We get in touch the way you prefer", "نتواصل معك بالطريقة التي تفضّلها"),
              t("We walk through your returns together", "نراجع مرتجعاتك معًا"),
            ].map((step, index) => (
              <li key={step}>
                <span className="fin-step-index">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <ul className="fin-trust mt-8">
            {[
              t("No commitment when you submit", "لا التزام عند الإرسال"),
              t("Eligibility is assessed by the financing partner", "يقيّم شريك التمويل الأهلية"),
              t("Nothing is shared with a partner without your consent", "لا نشارك بياناتك مع أي شريك دون موافقتك"),
            ].map((line) => (
              <li key={line}>
                <Check className="size-3.5 shrink-0" strokeWidth={2.5} />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: the form card. */}
        <div className="fin-card" data-sent={status === "sent" || undefined}>
          {status === "sent" ? (
            <div className="fin-success text-center" role="status">
              <span className="fin-success-mark" aria-hidden="true">
                <Check className="size-6" strokeWidth={2.5} />
              </span>
              <h3 className="mt-5 text-xl font-semibold">
                {firstName
                  ? t(`Thanks, ${firstName}.`, `شكرًا، ${firstName}.`)
                  : t("Thanks.", "شكرًا.")}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {t(
                  "Your details and your estimate are with the Reload team. We’ll reach you the way you chose.",
                  "وصلت بياناتك وتقديرك إلى فريق ريلود، وسنتواصل معك بالطريقة التي اخترتها.",
                )}
              </p>
              <div className="mt-7 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <a
                  href={getWhatsAppStartUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="fin-wa-button"
                >
                  <WhatsAppLogo className="size-4 !text-current" />
                  {t("Try Reload on WhatsApp", "جرّب ريلود على واتساب")}
                </a>
                <Button onClick={reset} variant="ghost" className="h-11 rounded-xl">
                  {t("Send another", "إرسال طلب آخر")}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-5">
              <Segmented
                label={t("What matters most to you?", "ما الأهم بالنسبة لك؟")}
                name="interest"
                value={interest}
                onChange={setInterest}
                options={[
                  { value: "returns", label: t("Returns", "المرتجعات") },
                  { value: "financing", label: t("Financing", "التمويل") },
                  { value: "both", label: t("Both", "كلاهما") },
                ]}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="fin-name" label={t("Your name", "اسمك")}>
                  <Input id="fin-name" name="name" required autoComplete="name" />
                </Field>
                <Field id="fin-store" label={t("Store name", "اسم المتجر")}>
                  <Input
                    id="fin-store"
                    name="store"
                    required
                    autoComplete="organization"
                    placeholder={t("Nova Store", "متجر نوفا")}
                  />
                </Field>
              </div>

              <Field id="fin-email" label={t("Work email", "البريد الإلكتروني للعمل")}>
                <Input
                  id="fin-email"
                  name="email"
                  type="email"
                  required
                  dir="ltr"
                  autoComplete="email"
                  placeholder="name@company.com"
                  className="text-start"
                />
              </Field>

              <Segmented
                label={t("How should we reach you?", "كيف تفضّل أن نتواصل معك؟")}
                name="preferred_contact"
                value={contact}
                onChange={setContact}
                options={[
                  {
                    value: "whatsapp",
                    label: "WhatsApp",
                    icon: <WhatsAppLogo className="size-3.5 !text-current" />,
                  },
                  { value: "call", label: t("Call", "اتصال"), icon: <Phone className="size-3.5" /> },
                  { value: "email", label: t("Email", "بريد"), icon: <Mail className="size-3.5" /> },
                ]}
              />

              {/* Phone slides in only when the chosen channel needs it. */}
              <div className="fin-reveal" data-open={needsPhone || undefined}>
                <div className="min-h-0 overflow-hidden">
                  <Field id="fin-phone" label={t("Mobile number", "رقم الجوال")}>
                    <Input
                      id="fin-phone"
                      name="phone"
                      type="tel"
                      dir="ltr"
                      required={needsPhone}
                      disabled={!needsPhone}
                      autoComplete="tel"
                      placeholder="+966 5x xxx xxxx"
                      className="text-start"
                    />
                  </Field>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="fin-platform" label={t("Store platform", "منصة المتجر")}>
                  <Input
                    id="fin-platform"
                    name="platform"
                    required
                    maxLength={120}
                    placeholder={t("Salla, Zid, Shopify…", "سلة، زد، شوبيفاي…")}
                  />
                </Field>
                <Field
                  id="fin-website"
                  label={t("Website", "الموقع الإلكتروني")}
                  optional={t("optional", "اختياري")}
                >
                  <Input
                    id="fin-website"
                    name="website"
                    dir="ltr"
                    maxLength={200}
                    placeholder="novastore.sa"
                    className="text-start"
                  />
                </Field>
              </div>

              <div className="fin-figures" data-open={figuresOpen || undefined}>
                <button
                  type="button"
                  className="fin-figures-toggle"
                  aria-expanded={figuresOpen}
                  aria-controls="fin-figures-body"
                  onClick={() => setFiguresOpen((value) => !value)}
                >
                  <span>
                    {t("Add business figures", "أضف أرقام متجرك")}
                    <span className="ms-2 text-xs font-normal text-muted-foreground">
                      {t("optional · helps us prepare", "اختياري · يساعدنا على الاستعداد")}
                    </span>
                  </span>
                  <ChevronDown className="fin-figures-chevron size-4" />
                </button>
                <div id="fin-figures-body" className="fin-reveal" data-open={figuresOpen || undefined}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="grid gap-4 pt-4 sm:grid-cols-2">
                      {[
                        { key: "monthly_sales", label: t("Monthly online sales (SAR)", "المبيعات الشهرية (ر.س)"), max: 9999999999, step: "0.01" },
                        { key: "monthly_orders", label: t("Monthly orders", "عدد الطلبات شهريًا"), max: 100000000, step: "1" },
                        { key: "return_rate", label: t("Return rate (%)", "نسبة المرتجعات (%)"), max: 100, step: "0.01" },
                        { key: "average_refund_amount", label: t("Average refund (SAR)", "متوسط الاسترداد (ر.س)"), max: 9999999999, step: "0.01" },
                        { key: "monthly_refund_volume", label: t("Monthly refund total (SAR)", "إجمالي الاستردادات شهريًا (ر.س)"), max: 9999999999, step: "0.01" },
                        { key: "refund_processing_days", label: t("Current refund time (days)", "مدة الاسترداد الحالية (أيام)"), max: 365, step: "0.5" },
                        { key: "desired_financing_days", label: t("Preferred repayment period (days)", "مدة السداد المفضّلة (أيام)"), max: 365, step: "1" },
                      ].map((field) => (
                        <Field key={field.key} id={`fin-${field.key}`} label={field.label}>
                          <Input
                            id={`fin-${field.key}`}
                            name={field.key}
                            type="number"
                            min={0}
                            max={field.max}
                            step={field.step}
                            inputMode="decimal"
                            dir="ltr"
                            tabIndex={figuresOpen ? undefined : -1}
                          />
                        </Field>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <Consent name="consent" required>
                  {t(
                    "Reload may contact me about this request.",
                    "أوافق على تواصل ريلود معي بخصوص هذا الطلب.",
                  )}
                </Consent>
                <Consent name="partner_consent">
                  {t(
                    "Reload may share my store details with licensed financing partners so they can assess eligibility.",
                    "أوافق على مشاركة ريلود لتفاصيل متجري مع شركاء تمويل مرخّصين لتقييم الأهلية.",
                  )}
                  <span className="ms-1 text-muted-foreground">
                    {t("(optional)", "(اختياري)")}
                  </span>
                </Consent>
              </div>

              {error && (
                <p role="alert" className="fin-error">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={status === "sending"}
                className="group h-12 w-full rounded-xl text-[15px] font-semibold"
              >
                {/* Fixed structure across states (see return-walkthrough.tsx). */}
                <span className="fin-submit" data-sending={status === "sending" || undefined}>
                  <Loader2 className="fin-submit-spinner size-4 animate-spin" aria-hidden="true" />
                  <span>
                    {status === "sending"
                      ? t("Sending…", "جارٍ الإرسال…")
                      : t("Contact me", "تواصلوا معي")}
                  </span>
                  <ArrowRight className="fin-submit-arrow size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                </span>
              </Button>

              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {t(
                  "Submitting is not a financing application or approval. Any financing is subject to a licensed partner’s assessment and terms.",
                  "الإرسال ليس طلب تمويل ولا موافقة عليه. يخضع أي تمويل لتقييم الشريك المرخّص وشروطه.",
                )}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/** Eases a number toward its target so the live estimate glides, rather than
 *  jumping, while a calculator slider is dragged. */
function useTweened(target: number, duration = 260) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const frame = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    cancelAnimationFrame(frame.current);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = origin + (target - origin) * eased;
      from.current = next;
      setValue(next);
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);
  return value;
}

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-[13px]">
        {label}
        {optional && (
          <span className="ms-1 text-xs font-normal text-muted-foreground">
            ({optional})
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

/** Radio group styled as a segmented control. Native radios keep keyboard
 *  arrows and form semantics; the pill is purely visual. */
function Segmented<T extends string>({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-[13px] font-medium">{label}</legend>
      <div className="fin-segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn("fin-segment", value === option.value && "is-selected")}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon}
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Consent({
  name,
  required,
  children,
}: {
  name: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="fin-consent">
      <input name={name} type="checkbox" required={required} className="peer sr-only" />
      <span className="fin-checkbox" aria-hidden="true">
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span className="text-[13px] leading-relaxed">{children}</span>
    </label>
  );
}
