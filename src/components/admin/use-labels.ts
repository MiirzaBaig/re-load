"use client";

import { useMemo } from "react";
import { useLanguage } from "@/components/language-provider";

const DAY = 86_400_000;

/** Every label and date format the desk shows, in both languages. */
export function useLabels() {
  const { t, locale, isArabic } = useLanguage();
  return useMemo(() => {
    const tag = isArabic ? "ar-SA" : "en-US";
    const dateFmt = new Intl.DateTimeFormat(tag, { dateStyle: "medium" });
    const shortFmt = new Intl.DateTimeFormat(tag, { month: "short", day: "numeric" });
    const timeFmt = new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" });
    const relFmt = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
    return {
      t,
      locale,
      isArabic,
      date: (value: string) => dateFmt.format(new Date(value)),
      shortDate: (value: string) => shortFmt.format(new Date(value)),
      datetime: (value: string) => timeFmt.format(new Date(value)),
      /** "3d", "5h", "now": compact age for cards. */
      age: (value: string) => {
        const ms = Date.now() - new Date(value).getTime();
        if (ms < 3_600_000) return t("now", "الآن");
        if (ms < DAY) return t(`${Math.floor(ms / 3_600_000)}h`, `${Math.floor(ms / 3_600_000)} س`);
        if (ms < 30 * DAY) return t(`${Math.floor(ms / DAY)}d`, `${Math.floor(ms / DAY)} ي`);
        return shortFmt.format(new Date(value));
      },
      /** "in 2 days", "yesterday": for follow-ups. */
      relative: (value: string) => {
        const days = Math.round((startOfDay(new Date(value)) - startOfDay(new Date())) / DAY);
        return relFmt.format(days, "day");
      },
      status: (value: string) => ({
        new: t("New", "جديد"),
        contacted: t("Contacted", "تم التواصل"),
        interested: t("Interested", "مهتم"),
        demo_booked: t("Demo booked", "حجز عرضًا"),
        customer: t("Customer", "عميل"),
        not_interested: t("Not interested", "غير مهتم"),
      }[value] ?? value),
      interest: (value: string | null) =>
        value === "returns" ? t("Returns", "الإرجاع")
          : value === "financing" ? t("Financing", "التمويل")
            : value === "both" ? t("Returns + financing", "الإرجاع والتمويل")
              : t("Not specified", "لم يُحدّد"),
      code: (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    };
  }, [t, locale, isArabic]);
}

export type Labels = ReturnType<typeof useLabels>;

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Counts per day for the last `days` days (oldest first), for sparklines. */
export function dailySeries(dates: string[], days = 14) {
  const today = startOfDay(new Date());
  const buckets = new Array(days).fill(0);
  for (const value of dates) {
    const index = days - 1 - Math.round((today - startOfDay(new Date(value))) / DAY);
    if (index >= 0 && index < days) buckets[index] += 1;
  }
  return buckets as number[];
}

export function isDue(lead: { next_follow_up_at: string | null; status: string }) {
  return !!lead.next_follow_up_at
    && new Date(lead.next_follow_up_at).getTime() <= Date.now()
    && !["customer", "not_interested"].includes(lead.status);
}

/** A follow-up `days` from now at 09:00 Riyadh time, as the API expects. */
export function followUpIn(days: number) {
  const d = new Date(Date.now() + days * DAY);
  return `${toIsoDay(d)}T09:00:00+03:00`;
}

export function toIsoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
