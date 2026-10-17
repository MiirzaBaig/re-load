"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Locale } from "@/lib/locale-server";
import { usePathname, useRouter } from "next/navigation";
import { publicLocale } from "@/lib/public-site";
import { persistLocale } from "@/lib/locale-client";
import { formatNumber, normalizeWesternNumerals } from "@/lib/numerals";

export type { Locale };

interface LanguageContextValue {
  locale: Locale;
  isArabic: boolean;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (english: string, arabic: string) => string;
  /** Localized number with Western digits in all locales. */
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLocale = "en",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [preferredLocale, setLocaleState] = useState<Locale>(initialLocale);
  const fixedLocale = publicLocale(pathname);
  const locale = fixedLocale || preferredLocale;

  const setLocale = useCallback(
    (next: Locale) => {
      persistLocale(next);
      setLocaleState(next);
      if (fixedLocale && next !== fixedLocale) {
        const suffix =
          pathname === "/" ? "" : pathname.replace(/^\/(ar|en)/, "");
        router.push(
          `/${next}${suffix}${window.location.search}${window.location.hash}`,
        );
      }
    },
    [fixedLocale, pathname, router],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.locale = locale;
    document.documentElement.dataset.localeReady = "true";
    persistLocale(locale);
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      isArabic: locale === "ar",
      setLocale,
      toggleLocale: () => setLocale(locale === "ar" ? "en" : "ar"),
      t: (english, arabic) =>
        normalizeWesternNumerals(locale === "ar" ? arabic : english, locale),
      n: (value, options) => formatNumber(value, options, locale),
    }),
    [locale, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
