/*
 * Store platforms a lead can be on. The event form and the team desk save one
 * of these labels; the website's contact form is free text ("salla", "سلة",
 * "Zid store"…), so anything else is read through platformOf().
 * Server-safe (no "use client"): the lead API validates with it too.
 */

export const PLATFORMS = ["Salla", "Zid", "Shopify", "Other"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** A free-text platform as one of PLATFORMS, or null when not given. */
export function platformOf(value: string | null | undefined): Platform | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  if (/salla|سلة|سله/.test(v)) return "Salla";
  if (/\bzid\b|^zid|زد/.test(v)) return "Zid";
  if (/shopify|شوبيفاي|شوبفاي/.test(v)) return "Shopify";
  return "Other";
}

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/** Display names in both languages. */
export const PLATFORM_LABEL: Record<Platform, { en: string; ar: string }> = {
  Salla: { en: "Salla", ar: "سلة" },
  Zid: { en: "Zid", ar: "زد" },
  Shopify: { en: "Shopify", ar: "شوبيفاي" },
  Other: { en: "Other", ar: "أخرى" },
};

/** A quiet identifying tint per platform (dots and bars only, never fills). */
export const PLATFORM_COLOR: Record<Platform | "unknown", string> = {
  Salla: "#14b8a6",
  Zid: "#8b5cf6",
  Shopify: "#84cc16",
  Other: "var(--chart-3)",
  unknown: "color-mix(in oklab, var(--muted-foreground) 35%, transparent)",
};
