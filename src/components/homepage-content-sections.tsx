"use client";

import Link from "next/link";
import { ArrowRight, FileCheck2, Headphones, ShoppingBag, Truck } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Mark, Tone } from "@/components/heading-accent";
import { SOLUTIONS } from "@/lib/public-solutions";
import { Button } from "@/components/ui/button";

/** Additive content only: existing hero, phone walkthrough and motion remain intact. */
export function HomepageSolutions() {
  const { t, locale, isArabic } = useLanguage();
  const i = isArabic ? 1 : 0;
  const icons = [Headphones, FileCheck2, ShoppingBag, Truck];
  return <section id="solutions" className="scroll-mt-24">
    <div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28">
      <ScrollReveal><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-medium text-muted-foreground">{t("More than a return request", "أكثر من طلب إرجاع")}</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-balance md:text-[42px] md:leading-[1.15]">{t("Support, products and returns. ", "خدمة العملاء والمنتجات والمرتجعات. ")}<Tone>{t("One conversation.", "في محادثة واحدة.")}</Tone></h2><p className="mt-4 text-base leading-8 text-muted-foreground">{t("Your customer asks. Reload uses your approved information. Your team handles the decisions that need a person.", "عميلك يسأل، وريلود يرد من معلوماتك المعتمدة. والقرارات اللي تحتاج شخص، تبقى مع فريقك.")}</p></div></ScrollReveal>
      <div className="solutions-grid mt-12 grid min-w-0 grid-cols-[minmax(0,1fr)] border-t sm:grid-cols-2">{SOLUTIONS.map((sol,n)=>{const Icon=icons[n];const tag=n===3?t("Coming soon · Premium", "قريبًا · بريميوم"):n===2?t("Product links · checkout planned", "روابط المنتجات · الدفع قريبًا"):null;return <ScrollReveal key={sol.slug} delay={n*70} className="h-full"><Link href={`/${locale}/solutions/${sol.slug}`} className="solution-row group flex h-full min-w-0 flex-col border-b py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-8"><div className="flex items-center gap-3"><Icon className="size-5 text-muted-foreground transition-colors duration-300 group-hover:text-foreground" strokeWidth={1.75}/>{tag&&<span className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground">{tag}</span>}</div><h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{sol.title[i]}</h3><p className="mt-2.5 flex-1 text-sm leading-7 text-muted-foreground">{sol.description[i]}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-medium">{t("See how it works", "اعرف التفاصيل")}<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 motion-reduce:transform-none"/></span></Link></ScrollReveal>;})}</div>
    </div>
  </section>;
}

export function HomepageSetup() {
  const { t } = useLanguage();
  const steps = [
    [t("Sign in with email", "سجّل ببريدك"), t("Create your workspace with the secure email sign-in flow.", "أنشئ مساحة عملك عبر تسجيل الدخول الآمن بالبريد الإلكتروني.")],
    [t("Connect your store", "اربط متجرك"), t("Use the available integration and check your product and order access.", "استخدم الربط المتاح وتحقّق من الوصول للمنتجات والطلبات.")],
    [t("Review your information", "راجع معلوماتك"), t("Import a help page or answer guided questions. Approve answers and policies before use.", "استورد صفحة مساعدة أو أجب عن أسئلة موجّهة. اعتمد الإجابات والسياسات قبل استخدامها.")],
    [t("Test, then share", "جرّب ثم شارك"), t("Test the journey, activate eligible access and share your store’s own WhatsApp link.", "اختبر الرحلة، وفعّل الوصول المستحق، ثم شارك رابط واتساب الخاص بمتجرك.")],
  ];
  return <section id="store-setup" className="scroll-mt-24 bg-muted/30"><div className="mx-auto max-w-[1200px] px-5 py-20 md:py-28"><ScrollReveal><div className="max-w-2xl"><p className="text-sm font-medium text-muted-foreground">{t("Start with your store", "ابدأ بمتجرك")}</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-[40px]">{t("Prepare. Approve. ", "جهّز. اعتمد. ")}<Mark>{t("Then share.", "ثم شارك.")}</Mark></h2></div></ScrollReveal><ol className="mt-10 grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-4">{steps.map(([title,body],n)=><li key={title}><ScrollReveal delay={n*70}><div className="border-t pt-5"><span className="text-xs tabular-nums text-muted-foreground">0{n+1}</span><h3 className="mt-4 text-base font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p></div></ScrollReveal></li>)}</ol>{/* Replaced by the "Why trust Reload" section (owner, 2026-10-20), kept for revert:
<ScrollReveal delay={120}><ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">{[t("You stay in control of every decision", "القرار النهائي دائمًا بيدك"),t("Answers only from what you approve", "الإجابات فقط مما تعتمده"),t("Order details shared only after verification", "تفاصيل الطلب بعد التحقق فقط"),t("Saudi Arabic and English", "عربي سعودي وإنجليزي")].map(item=><li key={item} className="inline-flex items-center gap-2"><Check className="size-4 text-foreground" strokeWidth={2.25}/>{item}</li>)}</ul></ScrollReveal> */}</div></section>;
}

export function HomepageContact() {
  const { t }=useLanguage();
  return <section id="contact" className="scroll-mt-24 border-y bg-muted/30"><div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-14 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{t("Tell us about your store", "خلّنا نتعرّف على متجرك")}</p><p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">{t("Leave your details and the team will help you get started. Financing enquiries register interest only; financing and instant refunds are not offered today.", "اترك بياناتك ويساعدك الفريق تبدأ. استفسارات التمويل لتسجيل الاهتمام فقط؛ التمويل والاسترداد الفوري غير متاحين حاليًا.")}</p></div><Button asChild variant="outline" className="shrink-0"><Link href="/interest">{t("Leave your store details", "اترك بيانات متجرك")}<ArrowRight className="size-4 rtl:rotate-180"/></Link></Button></div></section>;
}
