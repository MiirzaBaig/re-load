import type { Metadata } from "next";
import type { Locale } from "@/lib/locale-server";
export const SITE_URL = "https://www.reload.sa";
export const PUBLIC_PAGES = ["", "pricing", "faq", "how-it-works"] as const;
export type PublicPage = (typeof PUBLIC_PAGES)[number];
export function publicLocale(path: string): Locale | null {
  const first = path.split("/")[1];
  return first === "ar" || first === "en" ? first : path === "/" ? "ar" : null;
}
export function publicPath(locale: Locale, page: PublicPage = "") {
  return `/${locale}${page ? `/${page}` : ""}`;
}
export const PUBLIC_COPY = {
  "": {
    ar: {
      title: "ريلود | خدمة العملاء والمنتجات والمرتجعات عبر واتساب",
      description:
        "خدمة عملاء وأسئلة منتجات وطلبات إرجاع عبر واتساب. معلومات وسياسات تعتمدها أنت، وتحقّق من الطلبات، ومتابعة في مساحة واحدة. تعرّف على الخطط والمزايا القادمة.",
    },
    en: {
      title: "Reload | WhatsApp customer support, products and returns",
      description:
        "Customer support, product questions and returns on WhatsApp. Merchant-approved information, verified order requests and one workspace. Explore plans and upcoming features.",
    },
  },
  pricing: {
    ar: {
      title: "أسعار ريلود | اشتراكات الإرجاع وخدمة العملاء",
      description:
        "قارن ستاندرد بسعر 149 ريال وبريميوم بسعر 299 ريال شهريًا. خصم 20٪ للدفع السنوي، والأسعار شاملة الضريبة. رصيد الرسائل يتجدد شهريًا.",
    },
    en: {
      title: "Reload pricing | Standard and Premium plans",
      description:
        "Standard is SAR 149/month and Premium SAR 299/month, including VAT. Save 20% with annual billing. Compare features, message allowances and billing rules.",
    },
  },
  faq: {
    ar: {
      title: "الأسئلة الشائعة | ريلود للمتاجر الإلكترونية",
      description:
        "إجابات واضحة عن ريلود: الإعداد، والإرجاع، وخدمة العملاء، والتحقق من الطلبات، والرسائل المشمولة، والدفع السنوي، والترقية والإلغاء.",
    },
    en: {
      title: "Reload FAQ | Setup, WhatsApp, plans and billing",
      description:
        "Understand how Reload works: store setup, approved answers, return verification, message allowances, annual billing, upgrades and cancellation.",
    },
  },
  "how-it-works": {
    ar: {
      title: "كيف يعمل ريلود؟ | من إعداد المتجر إلى خدمة العميل",
      description:
        "تعرّف على رحلة التاجر والعميل مع ريلود: ربط المتجر، واعتماد السياسات والإجابات، ومشاركة رابط واتساب، والتحقق من الطلب، ومتابعة الحالات.",
    },
    en: {
      title: "How Reload works | Store setup and the customer journey",
      description:
        "See how merchants prepare their store, approve policies and answers, share a WhatsApp link and manage verified customer requests in Reload.",
    },
  },
} as const;
export function publicMetadata(
  locale: Locale,
  page: PublicPage = "",
): Metadata {
  return pageMetadata(locale, (l) => publicPath(l, page), PUBLIC_COPY[page][locale]);
}

/** Search and share tags for any public page that exists in both languages. */
export function pageMetadata(
  locale: Locale,
  pathFor: (locale: Locale) => string,
  copy: { title: string; description: string },
  type: "website" | "article" = "website",
): Metadata {
  const url = SITE_URL + pathFor(locale);
  const image = `${SITE_URL}/brand/reload-share-${locale}.png`;
  return {
    title: copy.title,
    description: copy.description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: url,
      languages: {
        ar: SITE_URL + pathFor("ar"),
        en: SITE_URL + pathFor("en"),
        "x-default": SITE_URL + pathFor("ar"),
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      type,
      url,
      siteName: "Reload | ريلود",
      locale: locale === "ar" ? "ar_SA" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_SA"],
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt:
            locale === "ar"
              ? "ريلود — الإرجاع وخدمة العملاء عبر واتساب"
              : "Reload — returns and customer support on WhatsApp",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [image],
    },
  };
}
