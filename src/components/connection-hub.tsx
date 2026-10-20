"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { Headset, RotateCcw, ShoppingCart } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { ReloadMark } from "@/components/reload-logo";
import { WhatsAppLogo } from "@/components/phone-frame";
import { ScrollReveal } from "@/components/scroll-reveal";
import { cn } from "@/lib/utils";

/*
 * "Reload at the heart of your store" (from the v201 reference): store
 * platforms and shipping companies feed into Reload, which serves customers
 * on WhatsApp. A short light runs along each connector in one 4s cycle:
 * into Reload from both sides, down the stem, out along the bracket and into
 * the three services. The loop only runs while the diagram is on screen and
 * is removed for reduced motion (see .rh-* in index.css).
 */

const CARRIERS = [
  ["smsa", "SMSA"], ["aramex", "Aramex"], ["spl", "SPL"], ["naqel", "Naqel Express"],
  ["aymakan", "AyMakan"], ["jt", "J&T Express"], ["imile", "iMile"], ["dhl", "DHL Express"],
  ["fedex", "FedEx"], ["ups", "UPS"], ["tam", "TAM"],
] as const;

export function ConnectionHub() {
  const { t, locale } = useLanguage();
  const stage = useRef<HTMLDivElement>(null);
  const seen = useInView(stage, { amount: 0.3, once: true });
  const visible = useInView(stage, { amount: 0.2 });
  // ready: hydrated, so the build-in may hide pieces (without JS everything shows).
  // built: the one-time build-in has finished, so the light loop may run.
  const [ready, setReady] = useState(false);
  const [built, setBuilt] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!seen) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setBuilt(true), reduce ? 0 : 2300);
    return () => window.clearTimeout(id);
  }, [seen]);

  const platforms = [
    { slug: "salla", name: t("Salla", "سلة") },
    { slug: "zid", name: t("Zid", "زد") },
    { slug: "shopify", name: "Shopify" },
  ];
  const services = [
    { icon: Headset, title: t("Customer support", "خدمة العملاء"), body: t("Answers order and tracking questions", "يرد على أسئلة الطلبات والتتبع"), href: `/${locale}/solutions/customer-support` },
    { icon: RotateCcw, title: t("Returns", "الإرجاع"), body: t("Organizes the request and next steps", "يرتّب الطلب والخطوات التالية"), href: `/${locale}/solutions/returns` },
    { icon: ShoppingCart, title: t("Sales", "المبيعات"), body: t("Suggests products and sends their links", "يقترح منتجات ويرسل روابطها"), href: `/${locale}/solutions/sales` },
  ];

  return (
    <section id="integrations" className="scroll-mt-24" aria-labelledby="rh-heading">
      <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
        <ScrollReveal>
          <div className="mx-auto flex max-w-[680px] flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("Integrations", "التكاملات")}</p>
            <h2 id="rh-heading" className="font-display text-3xl font-semibold tracking-[-0.025em] text-balance md:text-[42px] md:leading-[1.15]">
              {t("Reload at the heart of your store", "ريلود في قلب متجرك")}
            </h2>
            <p className="max-w-[60ch] text-base leading-8 text-muted-foreground text-pretty">
              {t(
                "Connects to your store platform and shipping companies, and serves your customers on WhatsApp: customer support, returns and sales.",
                "يرتبط بمنصة متجرك وشركات الشحن، ويرد على عملائك في واتساب: خدمة العملاء، والإرجاع، والمبيعات.",
              )}
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <div ref={stage} className={cn("rh-stage mt-14", ready && "rh-ready", seen && "rh-in", built && visible && "rh-live")}>
            {/* Top row: platforms · Reload · couriers */}
            <div className="rh-top">
              <div className="rh-panel rh-platforms">
                <span className="rh-label">{t("Store platforms", "منصات المتاجر")}</span>
                <div className="rh-logos rh-logos-platforms">
                  {platforms.map((p, n) => (
                    <span key={p.slug} className="rh-logo" title={p.name} style={{ ["--i" as string]: n }}>
                      <img src={`/brand/connections/${p.slug}.png`} alt={p.name} width={96} height={96} loading="lazy" decoding="async" />
                    </span>
                  ))}
                </div>
              </div>

              {/* Phones: each platform's line merges into one stem into Reload. */}
              <div className="rh-merge" aria-hidden="true">
                <span className="rh-m-drop rh-pos-start"><i /></span>
                <span className="rh-m-drop rh-pos-mid"><i /></span>
                <span className="rh-m-drop rh-pos-end"><i /></span>
                <span className="rh-m-bar rh-m-bar-start"><i /></span>
                <span className="rh-m-bar rh-m-bar-end"><i /></span>
                <span className="rh-m-stem"><i /></span>
              </div>

              <div className="rh-centre">
                <span className="rh-line rh-line-in-start" aria-hidden="true"><i /></span>
                <div className="rh-mark">
                  <span className="rh-pulse" aria-hidden="true" />
                  <ReloadMark className="relative size-16 sm:size-[76px]" />
                </div>
                <span className="rh-line rh-line-in-end" aria-hidden="true"><i /></span>
              </div>

              {/* Phones: from Reload the line fans out to the couriers. */}
              <div className="rh-fan" aria-hidden="true">
                <span className="rh-f-stem"><i /></span>
                <span className="rh-f-bar rh-f-bar-start"><i /></span>
                <span className="rh-f-bar rh-f-bar-end"><i /></span>
                <span className="rh-f-drop rh-pos-start"><i /></span>
                <span className="rh-f-drop rh-pos-mid"><i /></span>
                <span className="rh-f-drop rh-pos-end"><i /></span>
              </div>

              <Link href={`/${locale}/solutions/shipping`} className="rh-panel rh-carriers">
                <span className="rh-label">{t("Shipping companies", "شركات الشحن")}</span>
                <div className="rh-marquee">
                  <div className="rh-logos rh-track">
                    {CARRIERS.map(([slug, name], n) => (
                      <span key={slug} className="rh-logo" title={name} style={{ ["--i" as string]: n }}>
                        <img src={`/brand/connections/${slug}.png`} alt={name} width={96} height={96} loading="lazy" decoding="async" />
                      </span>
                    ))}
                    {/* Second copy for the seamless scrolling row on phones (hidden on desktop). */}
                    {CARRIERS.map(([slug], n) => (
                      <span key={`dup-${slug}`} className="rh-logo rh-dup" aria-hidden="true" style={{ ["--i" as string]: n }}>
                        <img src={`/brand/connections/${slug}.png`} alt="" width={96} height={96} loading="lazy" decoding="async" />
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </div>

            {/* Stem from Reload through the WhatsApp label, then the bracket into the three services */}
            <div className="rh-branch">
              <span className="rh-stem" aria-hidden="true"><i /></span>
              <p className="rh-wa">
                <WhatsAppLogo className="size-[18px]" />
                {t("Your customers on WhatsApp", "عملاؤك على واتساب")}
              </p>
              <span className="rh-stem rh-stem-2" aria-hidden="true"><i /></span>
              <span className="rh-bracket" aria-hidden="true">
                <span className="rh-bar rh-bar-start"><i /></span>
                <span className="rh-bar rh-bar-end"><i /></span>
                <span className="rh-drop rh-drop-start"><i /></span>
                <span className="rh-drop rh-drop-mid"><i /></span>
                <span className="rh-drop rh-drop-end"><i /></span>
              </span>
            </div>

            <ul className="rh-services">
              {services.map(({ icon: Icon, title, body, href }, n) => (
                <li key={href} className="rh-service-item" style={{ ["--i" as string]: n }}>
                  <Link href={href} className="rh-service group">
                    <span className="rh-service-icon">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="mt-3 block text-[15px] font-semibold">{title}</span>
                    <span className="mt-1.5 block text-[13px] leading-[1.6] text-muted-foreground text-balance">{body}</span>
                  </Link>
                  {n < services.length - 1 && <span className="rh-link" aria-hidden="true"><i /></span>}
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
