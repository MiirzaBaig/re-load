import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import { Providers } from "./providers";
import { WELCOME_BOOTSTRAP } from "@/components/admin/welcome-script";
import { fontClassNames, manrope } from "@/lib/fonts";
import { LOCALE_COOKIE, resolveRequestLocale } from "@/lib/locale-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reload · Returns, handled.",
  description:
    "Turn approved return rules into clear answers for customers—and a decision trail your team can inspect.",
  openGraph: {
    title: "Reload · Returns, handled.",
    description:
      "Turn approved return rules into clear answers for customers—and a decision trail your team can inspect.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reload · Returns, handled.",
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
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-KTFN869F');`,
          }}
        />
        {/* Decides whether the brand intro plays, before anything is drawn:
            only on a fresh open of the home page (not on refresh, not on a link with a query or hash,
            deep link, not with Reduce motion). It must be a plain inline
            script here: as a next/script it ran after the JS bundle on slow
            networks, so the page painted first and the intro popped in late.
            The overlay stays hidden unless this marks it "play". */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var play=location.pathname==="/"&&!location.hash&&!location.search&&!sessionStorage.getItem("reload-intro-seen")&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches;d.setAttribute("data-intro",play?"play":"skip");}catch(e){}})();`,
          }}
        />
        {/* Same idea for the team desk's post-sign-in welcome (only on /admin). */}
        <script dangerouslySetInnerHTML={{ __html: WELCOME_BOOTSTRAP }} />
      </head>
      <body className={`${fontClassNames} ${manrope.className} antialiased`}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KTFN869F"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
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
