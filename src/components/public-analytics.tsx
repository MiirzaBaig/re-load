"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { publicLocale } from "@/lib/public-site";

/** Anonymous public intent only. No query strings, store IDs, contacts or payment data. */
export function publicEvent(
  event: string,
  fields: Record<string, string> = {},
) {
  if (typeof window === "undefined") return;
  const target = window as typeof window & {
    dataLayer?: Record<string, unknown>[];
  };
  target.dataLayer = target.dataLayer || [];
  target.dataLayer.push({ event, ...fields });
}
export function PublicAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    const locale = publicLocale(pathname);
    if (!locale) return;
    const pricing = document.getElementById("pricing");
    let observer: IntersectionObserver | undefined;
    if (pricing) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            publicEvent("reload_pricing_view", { language: locale });
            observer?.disconnect();
          }
        },
        { threshold: 0.2 },
      );
      observer.observe(pricing);
    }
    const clicked = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a");
      if (!anchor) return;
      const url = new URL(anchor.href, location.origin);
      if (url.origin !== location.origin) return;
      if (url.pathname === "/auth")
        publicEvent("reload_signup_click", { language: locale });
      if (url.hash === "#contact")
        publicEvent("reload_contact_click", { language: locale });
    };
    document.addEventListener("click", clicked);
    return () => {
      observer?.disconnect();
      document.removeEventListener("click", clicked);
    };
  }, [pathname]);
  return null;
}
