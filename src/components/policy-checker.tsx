"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CircleAlert, X } from "lucide-react";
import { CountUp, TWEEN } from "@/components/desk/primitives";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/locale-server";
import { cn } from "@/lib/utils";

/*
 * Rule-based policy checker. Runs entirely in the browser: no AI call, no
 * network, nothing stored. It looks for the topics customers ask about most,
 * in Arabic or English. It cannot judge legal compliance and says so.
 */

type Check = { key: string; en: string; ar: string; fixEn: string; fixAr: string; test: (s: string) => boolean };

const days = /(\d+|سبعة|سبع|عشرة|ثلاثين|أربعة عشر)\s*(يوم|أيام|يومًا|يوما|days?|business days)/i;

const CHECKS: Check[] = [
  {
    key: "window",
    en: "Return window in days",
    ar: "مدة الإرجاع بالأيام",
    fixEn: "Write a number of days, e.g. “within 14 days of delivery”.",
    fixAr: "اكتب عدد الأيام، مثل «خلال 14 يومًا من تاريخ الاستلام».",
    test: (s) => days.test(s),
  },
  {
    key: "start",
    en: "When the window starts",
    ar: "متى تبدأ المدة",
    fixEn: "Say whether days count from delivery or from the order date.",
    fixAr: "وضّح هل تبدأ المدة من تاريخ الاستلام أم من تاريخ الطلب.",
    test: (s) => /(استلام|الاستلام|التسليم|وصول|تاريخ الطلب|delivery|deliver|receiv|order date|purchase date)/i.test(s),
  },
  {
    key: "condition",
    en: "Accepted item condition",
    ar: "حالة المنتج المقبولة",
    fixEn: "Describe the condition you accept: unused, tags, original packaging.",
    fixAr: "صِف الحالة المقبولة: غير مستخدم، مع البطاقات، في التغليف الأصلي.",
    test: (s) => /(غير مستخدم|حالته الأصلية|حالة المنتج|التغليف|تغليف|العبوة|البطاقات|الملصقات|مغلق|unused|unworn|original packaging|original condition|tags|sealed)/i.test(s),
  },
  {
    key: "exclusions",
    en: "Items that can’t be returned",
    ar: "المنتجات غير القابلة للإرجاع",
    fixEn: "List excluded items by name (e.g. opened cosmetics, custom items).",
    fixAr: "اذكر المنتجات المستثناة بالاسم (مثل مستحضرات التجميل المفتوحة، والمنتجات المخصصة).",
    test: (s) => /(لا يمكن إرجاع|لا يمكن استرجاع|غير قابل|غير قابلة|لا تُرجع|لا ترجع|مستثن|استثناء|cannot be returned|can't be returned|non-returnable|not eligible|excluded|final sale)/i.test(s),
  },
  {
    key: "damaged",
    en: "Damaged or wrong items",
    ar: "المنتج التالف أو الخاطئ",
    fixEn: "Say what happens if an item arrives damaged or isn’t what was ordered.",
    fixAr: "وضّح ما يحدث إذا وصل المنتج تالفًا أو مختلفًا عن الطلب.",
    test: (s) => /(تالف|معيب|عيب|مكسور|خاطئ|مختلف|خطأ|damaged|defective|faulty|broken|wrong item|incorrect)/i.test(s),
  },
  {
    key: "refund",
    en: "How refunds are paid",
    ar: "طريقة الاسترداد",
    fixEn: "Say how money comes back: original payment method or store credit.",
    fixAr: "وضّح كيف يعود المبلغ: إلى وسيلة الدفع الأصلية أو رصيدًا في المتجر.",
    test: (s) => /(وسيلة الدفع|طريقة الدفع|رصيد|محفظة|استرداد المبلغ|إعادة المبلغ|refund to|original payment|store credit|wallet)/i.test(s),
  },
  {
    key: "timing",
    en: "How long a refund takes",
    ar: "مدة الاسترداد",
    fixEn: "Give a refund timeframe, e.g. “within 7 days of inspection”.",
    fixAr: "حدّد مدة الاسترداد، مثل «خلال 7 أيام من فحص المنتج».",
    test: (s) => (s.match(new RegExp(days.source, "gi")) ?? []).length >= 2 || /(أيام عمل|business days)/i.test(s),
  },
  {
    key: "shipping",
    en: "Who pays return shipping",
    ar: "من يتحمل شحن الإرجاع",
    fixEn: "Say who pays return shipping, and when the store covers it.",
    fixAr: "وضّح من يتحمل تكلفة شحن الإرجاع، ومتى يتحملها المتجر.",
    test: (s) => /((شحن|التوصيل|الشحن)[\s\S]{0,60}(يتحمل|تكلفة|رسوم|مجان|على حساب))|((يتحمل|تكلفة|رسوم)[\s\S]{0,60}(شحن|الشحن|التوصيل))|(return shipping|shipping (cost|fee)|pays? (for )?(the )?shipping|free returns?)/i.test(s),
  },
  {
    key: "exchange",
    en: "Exchanges",
    ar: "الاستبدال",
    fixEn: "Say whether exchanges are allowed, and within how many days.",
    fixAr: "وضّح هل الاستبدال متاح، وخلال كم يومًا.",
    test: (s) => /(استبدال|تبديل|exchange)/i.test(s),
  },
  {
    key: "start-return",
    en: "How to start a return",
    ar: "كيف يبدأ العميل الإرجاع",
    fixEn: "End with one clear first step: where to write and what to send.",
    fixAr: "اختم بخطوة أولى واضحة: أين يكتب العميل وماذا يرسل.",
    test: (s) => /(واتساب|whatsapp|تواصل|راسلنا|contact|email|البريد|رقم الطلب|order number|نموذج|form)/i.test(s),
  },
];

const VAGUE = /(فترة مناسبة|حسب تقدير|وفق تقدير|يحق للمتجر رفض|at our discretion|reasonable (time|period)|may refuse any)/i;

export function PolicyChecker({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text);
  const ready = deferred.trim().length >= 40;

  const result = useMemo(() => {
    const s = deferred.normalize("NFKC");
    const checks = CHECKS.map((c) => ({ ...c, ok: c.test(s) }));
    const passed = checks.filter((c) => c.ok).length;
    const shortest = [...s.matchAll(new RegExp(days.source, "gi"))]
      .map((m) => Number(m[1]))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)[0];
    return {
      checks,
      score: Math.round((passed / CHECKS.length) * 100),
      vague: VAGUE.test(s),
      short: shortest !== undefined && shortest < 7,
      long: s.split(/\s+/).length > 700,
    };
  }, [deferred]);

  const tone = result.score >= 80 ? "text-eligible" : result.score >= 50 ? "text-review" : "text-destructive";
  const verdict =
    result.score >= 80
      ? t("Clear and complete", "واضحة ومكتملة")
      : result.score >= 50
        ? t("Good start, a few gaps", "بداية جيدة مع بعض النواقص")
        : t("Customers will have questions", "سيكون لدى العملاء أسئلة");

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
      <div>
        <label htmlFor="pc-text" className="text-sm font-medium">
          {t("Your current return policy", "سياسة الاسترجاع الحالية")}
        </label>
        <Textarea
          id="pc-text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 12000))}
          rows={16}
          placeholder={t("Paste your return and exchange policy here…", "الصق سياسة الاسترجاع والاستبدال هنا…")}
          className="mt-2 min-h-[22rem] rounded-2xl leading-7"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {t("Arabic or English. Checked in your browser; nothing is sent or saved.", "بالعربية أو الإنجليزية. يُفحص في متصفحك ولا يُرسل أو يُحفظ أي شيء.")}
        </p>
      </div>

      <section aria-live="polite" className="lg:border-s lg:ps-10">
        <AnimatePresence mode="wait" initial={false}>
          {!ready ? (
            <motion.p
              key="wait"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              className="text-sm leading-7 text-muted-foreground"
            >
              {t(
                "Your result appears here as you paste. No policy yet? Start from the ",
                "تظهر النتيجة هنا بمجرد اللصق. لا توجد لديك سياسة بعد؟ ابدأ من ",
              )}
              <Link href={`/${locale}/return-policy-template`} className="text-foreground underline underline-offset-4">
                {t("free policy template", "نموذج السياسة المجاني")}
              </Link>
              .
            </motion.p>
          ) : (
            <motion.div
              key="result"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ ...TWEEN, duration: 0.3 }}
            >
              <div className="flex items-baseline gap-3">
                <CountUp value={result.score} className={cn("font-display text-6xl font-semibold tracking-[-.04em] transition-colors duration-500", tone)} />
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <p className={cn("mt-1 text-sm font-medium transition-colors duration-500", tone)}>{verdict}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={cn("h-full rounded-full transition-colors duration-500", result.score >= 80 ? "bg-eligible" : result.score >= 50 ? "bg-review" : "bg-destructive")}
                  initial={false}
                  animate={{ width: `${result.score}%` }}
                  transition={{ ...TWEEN, duration: reduce ? 0 : 0.5 }}
                />
              </div>

              <ul className="mt-8 divide-y border-y">
                {result.checks.map((c) => (
                  <li key={c.key} className="flex gap-3 py-3 text-sm">
                    <span
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-300",
                        c.ok ? "bg-eligible/15 text-eligible" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {c.ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0">
                      <p className={cn("font-medium", !c.ok && "text-muted-foreground")}>{t(c.en, c.ar)}</p>
                      <AnimatePresence initial={false}>
                        {!c.ok && (
                          <motion.p
                            initial={reduce ? false : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={reduce ? undefined : { height: 0, opacity: 0 }}
                            transition={{ ...TWEEN, duration: 0.22 }}
                            className="overflow-hidden text-xs leading-6 text-muted-foreground"
                          >
                            {t(c.fixEn, c.fixAr)}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </li>
                ))}
              </ul>

              {(result.vague || result.short || result.long) && (
                <ul className="mt-6 space-y-3">
                  {result.vague && (
                    <Warn>{t("Vague wording found (e.g. “reasonable period”, “at our discretion”). Replace it with clear rules so every customer gets the same answer.", "وُجدت عبارات غامضة (مثل «فترة مناسبة» أو «حسب تقدير المتجر»). استبدلها بقواعد واضحة ليحصل كل عميل على الإجابة نفسها.")}</Warn>
                  )}
                  {result.short && (
                    <Warn>{t("One period is under 7 days. Check it meets current Saudi consumer rules.", "إحدى المدد أقل من 7 أيام. تأكد من توافقها مع أنظمة حماية المستهلك الحالية في السعودية.")}</Warn>
                  )}
                  {result.long && (
                    <Warn>{t("The policy is long. Customers read short policies; keep the key rules near the top.", "السياسة طويلة. العملاء يقرؤون السياسات القصيرة؛ ضع القواعد الأساسية في البداية.")}</Warn>
                  )}
                </ul>
              )}

              <p className="mt-8 text-sm leading-7 text-muted-foreground">
                {t("Fix the gaps quickly with the ", "أصلح النواقص بسرعة باستخدام ")}
                <Link href={`/${locale}/return-policy-template`} className="text-foreground underline underline-offset-4">
                  {t("free policy template", "نموذج السياسة المجاني")}
                </Link>
                {t(", then let ", "، ثم دع ")}
                <Link href={`/${locale}/how-it-works`} className="text-foreground underline underline-offset-4">
                  {t("Reload apply it on WhatsApp", "ريلود يطبّقها عبر واتساب")}
                </Link>
                .
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-10 border-t pt-4 text-xs leading-6 text-muted-foreground">
          {t(
            "Checks clarity and completeness, not legal compliance. Review current requirements on the Ministry of Commerce website.",
            "يفحص الوضوح والاكتمال وليس التوافق النظامي. راجع المتطلبات الحالية على موقع وزارة التجارة.",
          )}
        </p>
      </section>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-s-2 border-review ps-3 text-xs leading-6 text-muted-foreground">
      <CircleAlert className="mt-1 size-3.5 shrink-0 text-review" />
      {children}
    </li>
  );
}
