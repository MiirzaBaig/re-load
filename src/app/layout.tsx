import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import { Providers } from "./providers";
import { fontClassNames, manrope } from "@/lib/fonts";
import { LOCALE_COOKIE, resolveRequestLocale } from "@/lib/locale-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reload — Returns, handled.",
  description:
    "Turn approved return rules into clear answers for customers—and a decision trail your team can inspect.",
  openGraph: {
    title: "Reload — Returns, handled.",
    description:
      "Turn approved return rules into clear answers for customers—and a decision trail your team can inspect.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reload — Returns, handled.",
  },
  icons: {
    icon: "/brand/reload-favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const initialLocale = resolveRequestLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headersList.get("accept-language") ?? undefined,
  );

  return (
    <html
      lang={initialLocale}
      dir={initialLocale === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <body className={`${fontClassNames} ${manrope.className} antialiased`}>
        <Script id="locale-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var k="${LOCALE_COOKIE}";var m=document.cookie.match(new RegExp("(?:^|; )"+k+"=([^;]*)"));var fromCookie=m&&(m[1]==="ar"||m[1]==="en")?m[1]:null;var s=localStorage.getItem(k);var l=fromCookie||(s==="ar"||s==="en"?s:(navigator.language.toLowerCase().startsWith("ar")?"ar":"en"));document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";document.documentElement.dataset.locale=l;localStorage.setItem(k,l);document.cookie=k+"="+l+";path=/;max-age=31536000;SameSite=Lax";}catch(e){}})();`}
        </Script>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var stored=localStorage.getItem("theme");var dark=stored==="dark"||((!stored||stored==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.classList.toggle("light",!dark);}catch(e){}})();`}
        </Script>
        <Providers initialLocale={initialLocale}>{children}</Providers>
      </body>
    </html>
  );
}
