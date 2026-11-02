import localFont from "next/font/local";
import { Manrope, Sora } from "next/font/google";

export const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

export const sora = Sora({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sora",
  display: "swap",
});

/**
 * Arabic — Thmanyah Sans (self-hosted), used for all Arabic text, headings
 * included (owner, 2026-11-01).
 * - Only Arabic letters use it (unicode-range), so digits, English words and
 *   brand names inside Arabic sentences fall through to Manrope and match
 *   the Latin text. No automatic Arial fallback face, which would otherwise
 *   catch those characters first.
 * - Preloaded, with a very short block period, so Arabic headings don't
 *   flash in a system font on first load.
 * Previous settings: display "swap", preload false, default fallback face.
 */
export const thmanyahSans = localFont({
  src: [
    {
      path: "../../public/fonts/thmanyah/sans/woff2/thmanyah-sans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/thmanyah/sans/woff2/thmanyah-sans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/thmanyah/sans/woff2/thmanyah-sans-Bold.woff2",
      weight: "600 700",
      style: "normal",
    },
  ],
  variable: "--font-thmanyah-sans",
  display: "fallback",
  preload: true,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F" },
  ],
  fallback: ["system-ui", "sans-serif"],
});

/** Thmanyah Serif Display: no longer used for headings (one Arabic family,
 *  2026-11-01). Kept registered, not preloaded, so it costs nothing unless a
 *  page opts back in via --font-thmanyah-display. */
export const thmanyahSerifDisplay = localFont({
  src: [
    {
      path: "../../public/fonts/thmanyah/serif-display/woff2/thmanyah-serif-display-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/thmanyah/serif-display/woff2/thmanyah-serif-display-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/thmanyah/serif-display/woff2/thmanyah-serif-display-Bold.woff2",
      weight: "600 700",
      style: "normal",
    },
  ],
  variable: "--font-thmanyah-display",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "serif"],
});

export const fontClassNames = `${manrope.variable} ${sora.variable} ${thmanyahSans.variable} ${thmanyahSerifDisplay.variable}`;
