"use client";

import { useMemo, useState } from "react";
import { FinancingRequestForm } from "@/components/financing-request-form";
import { Calculator, Clock3, SlidersHorizontal, TimerReset, WalletCards, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useLanguage } from "@/components/language-provider";
import { formatNumber } from "@/lib/numerals";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function ReturnsCostCalculator() {
  const { t, n } = useLanguage();
  const formatMoney = (amount: number) =>
    n(amount, {
      style: "currency",
      currency: "SAR",
      maximumFractionDigits: 0,
    });
  const [monthlyReturns, setMonthlyReturns] = useState(500);
  const [orderValue, setOrderValue] = useState(725);
  const [processingMinutes, setProcessingMinutes] = useState(24);
  const [resolutionDays, setResolutionDays] = useState(6.2);
  const [hourlyCost, setHourlyCost] = useState(45);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  const results = useMemo(() => ({
    tiedUp: monthlyReturns * orderValue * (resolutionDays / 30),
    operatingCost: monthlyReturns * (processingMinutes / 60) * hourlyCost,
  }), [hourlyCost, monthlyReturns, orderValue, processingMinutes, resolutionDays]);

  return (
    <section
      id="returns-financing"
      aria-labelledby="returns-calculator-title"
      className="scroll-mt-20 px-5 pb-20 md:pb-28"
    >
      <div className="mx-auto mb-8 flex max-w-[1200px] items-end justify-between gap-6">
        <div><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-primary"><Calculator className="size-4" />{t("Returns financing", "تمويل المرتجعات")}</p>
        <h2 id="returns-calculator-title" className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{t("How much cash is locked in your returns?", "كم من السيولة محتجزة في مرتجعاتك؟")}</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("Enter your numbers to see the working capital sitting in undecided returns — then request financing against it.", "أدخل أرقامك لترى رأس المال المحتجز في مرتجعات بلا قرار، ثم اطلب تمويلًا مقابله.")}</p></div>
        <ArrowUpRight aria-hidden="true" className="hidden size-10 text-primary/40 sm:block" />
      </div>
      <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-[0_28px_80px_-48px_rgba(10,50,41,.4)]">
        <div className="grid lg:grid-cols-[1.08fr_.92fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">{t("Your monthly picture", "تقديرك الشهري")}</p><span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">{t("Live estimate", "تقدير مباشر")}</span></div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <CalculatorInput label={t("Monthly returns", "عدد المرتجعات شهريًا")} value={monthlyReturns} min={0} max={3000} step={10} suffix={t("returns", "طلب")} onChange={setMonthlyReturns} className="sm:col-span-2" />
              <CalculatorInput label={t("Average order value", "متوسط قيمة الطلب")} value={orderValue} min={0} max={5000} step={25} prefix={t("SAR", "ر.س")} onChange={setOrderValue} />
              <CalculatorInput label={t("Processing time per return", "وقت معالجة كل إرجاع")} value={processingMinutes} min={0} max={120} step={1} suffix={t("min", "دقيقة")} onChange={setProcessingMinutes} />
            </div>

            <div className="mt-8 border-t border-border/70 pt-5">
              <p className="text-xs leading-relaxed text-muted-foreground">{t(`Based on ${n(resolutionDays, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} days to resolve a return and SAR ${n(hourlyCost)} per staff hour.`, `بناءً على ${n(resolutionDays, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} يوم لمعالجة الإرجاع وتكلفة ${n(hourlyCost)} ر.س لكل ساعة عمل.`)}</p>
              <Dialog open={assumptionsOpen} onOpenChange={setAssumptionsOpen}>
                <DialogTrigger asChild><Button variant="ghost" className="mt-2 -ms-3 gap-2 text-primary"><SlidersHorizontal className="size-4" />{t("Adjust assumptions", "تعديل الافتراضات")}</Button></DialogTrigger>
                <DialogContent className="rounded-2xl sm:max-w-md">
                  <DialogHeader><DialogTitle>{t("Make the estimate yours", "خصّص التقدير لمتجرك")}</DialogTitle><DialogDescription>{t("These assumptions update your results immediately. Use your team's actual figures when available.", "تتحدث النتائج فورًا عند تعديل هذه القيم. استخدم الأرقام الفعلية لفريقك متى توفرت.")}</DialogDescription></DialogHeader>
                  <div className="grid gap-6 py-4">
                    <CalculatorInput compact label={t("Average resolution time", "متوسط وقت المعالجة")} value={resolutionDays} min={0.5} max={30} step={0.1} suffix={t("days", "يوم")} onChange={setResolutionDays} />
                    <CalculatorInput compact label={t("Estimated staff cost", "تكلفة الموظف التقديرية")} value={hourlyCost} min={10} max={300} step={5} prefix={t("SAR", "ر.س")} suffix={t("/ hour", "/ ساعة")} onChange={setHourlyCost} />
                  </div>
                  <DialogClose asChild><Button className="w-full rounded-xl">{t("Done", "تم")}</Button></DialogClose>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="calculator-results relative isolate flex min-h-[440px] flex-col justify-center overflow-hidden bg-[#0F0F12] p-6 text-[#F8F7F4] sm:p-8 lg:p-10" aria-live="polite">
            <p className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#F8F7F4]/70"><span className="size-1.5 rounded-full bg-[#F8F7F4]" />{t("The cost of unresolved returns", "تكلفة المرتجعات غير المعالجة")}</p>
            <ResultValue
              icon={<WalletCards className="size-5" />}
              label={t("Tied up in delayed returns", "قيمة معلّقة في مرتجعات متأخرة")}
              value={formatMoney(results.tiedUp)}
              emphasis
            />
            <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ResultValue icon={<Clock3 className="size-4" />} label={t("Estimated operational cost", "التكلفة التشغيلية التقديرية")} value={`${formatMoney(results.operatingCost)} ${t("/ month", "/ شهر")}`} />
              <ResultValue icon={<TimerReset className="size-4" />} label={t("Average return resolution", "متوسط مدة معالجة الإرجاع")} value={`${n(resolutionDays, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${t("days", "يوم")}`} />
            </div>
            <div className="relative mt-6 flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-xs text-[#F8F7F4]/75"><span>{t("Monthly staff time", "وقت العمل الشهري")}</span><span className="font-semibold tabular-nums latin-nums">{n(monthlyReturns * processingMinutes / 60, { maximumFractionDigits: 1 })} {t("hours", "ساعة")}</span></div>
            <div className="relative mt-7 border-t border-white/10 pt-6">
              <FinancingRequestForm
                snapshot={{
                  monthlyReturns,
                  orderValue,
                  processingMinutes,
                  resolutionDays,
                  hourlyCost,
                  tiedUp: results.tiedUp,
                  operatingCost: results.operatingCost,
                }}
              />
              <p className="mt-4 text-xs leading-relaxed text-[#F8F7F4]/65">
                {t("Planning estimate, not guaranteed savings or an offer of credit. Tied-up value assumes returns arrive evenly throughout a 30-day month. Operational cost uses processing time × staff cost.", "تقدير لأغراض التخطيط وليس توفيرًا مضمونًا ولا عرض تمويل. يفترض تقدير القيمة المعلّقة توزيع المرتجعات بالتساوي خلال شهر من 30 يومًا، وتُحسب التكلفة التشغيلية من وقت المعالجة وتكلفة الموظف.")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalculatorInput({ label, value, min, max, step, prefix, suffix, onChange, compact = false, className = "" }: {
  label: string; value: number; min: number; max: number; step: number; prefix?: string; suffix?: string;
  onChange: (value: number) => void; compact?: boolean; className?: string;
}) {
  const { isArabic } = useLanguage();
  const update = (next: number) => onChange(clamp(next, min, max));
  // Hold the raw string while editing so clearing the field doesn't snap to
  // `min` mid-keystroke; commit the clamped number on blur.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className={`group block ${className}`}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="mt-2 flex h-12 items-center rounded-xl border border-input bg-background px-3 shadow-sm transition-[border-color,box-shadow] duration-200 group-focus-within:border-primary group-focus-within:ring-4 group-focus-within:ring-primary/10 group-hover:border-primary/35">
        {prefix && <span className="me-2 text-xs font-semibold text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          aria-label={label}
          value={draft ?? value}
          min={min}
          max={max}
          step={step}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            if (raw !== "") update(Number(raw));
          }}
          onBlur={() => setDraft(null)}
          className="h-auto border-0 bg-transparent p-0 text-base font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent tabular-nums latin-nums"
        />
        {suffix && <span className="ms-2 whitespace-nowrap text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {!compact && <><input aria-label={`${label} slider`} type="range" value={value} min={min} max={max} step={step} style={{ background: `linear-gradient(to ${isArabic ? "left" : "right"}, var(--brand-accent-fill) ${(value-min)/(max-min)*100}%, var(--border) ${(value-min)/(max-min)*100}%)` }} onChange={(event) => { setDraft(null); update(Number(event.target.value)); }} className="calculator-range mt-4 w-full" />{/* The row mirrors with the page, which is correct: a native range input in
    RTL puts its minimum on the right, so min/max stay under their own ends. */}
<div aria-hidden="true" className="mt-2 flex justify-between text-[10px] tabular-nums latin-nums text-muted-foreground"><span>{min}</span><span>{formatNumber(max)}</span></div></>}
    </div>
  );
}

function ResultValue({ icon, label, value, emphasis = false }: {
  icon: React.ReactNode; label: string; value: string; emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? "relative mt-5" : "rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.07]"}>
      <div className="flex items-center gap-2 text-xs text-[#F8F7F4]/70">{icon}<span>{label}</span></div>
      {/* No `key` here: keying on the value remounts the node on every keystroke,
          which replays the fade and reads as a flicker while dragging a slider. */}
      <p className={emphasis ? "mt-2 text-[clamp(2.25rem,5vw,4.25rem)] font-semibold leading-none tabular-nums latin-nums" : "mt-2 text-lg font-semibold tracking-tight tabular-nums latin-nums"}>
        {value}
      </p>
    </div>
  );
}
