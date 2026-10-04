"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function InterestSignup() {
  const { t } = useLanguage();
  const [store, setStore] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState<"returns" | "financing" | "both">("both");
  const [marketing, setMarketing] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() && !phone.trim()) { setError(t("Add an email or phone number.", "أضف بريدًا إلكترونيًا أو رقم هاتف.")); return; }
    const client = getSupabaseBrowserClient();
    if (!client) { setError(t("Registration is unavailable right now.", "التسجيل غير متاح حاليًا.")); return; }
    setState("sending"); setError("");
    const { error: submitError } = await client.from("leads").insert({
      store_name: store.trim(), contact_name: name.trim(), email: email.trim() || null,
      phone: phone.trim() || null, interest, source_type: "qr", source_label: "Event signup",
      contact_consent: true, marketing_consent: marketing,
    });
    if (submitError) { setState("idle"); setError(t("We couldn't save this yet. Please try again.", "تعذّر حفظ بياناتك. حاول مرة أخرى.")); return; }
    setState("sent");
  };

  return <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-20 sm:px-8 sm:pt-28">
    <div className="grid items-start gap-12 lg:grid-cols-[.85fr_1fr] lg:gap-20">
      <div className="animate-fade-in"><span className="text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">{t("Meet Reload", "تعرّف على ريلود")}</span><h1 className="mt-5 max-w-lg font-display text-4xl font-semibold leading-[1.1] tracking-[-.055em] sm:text-6xl">{t("A clearer way to handle returns.", "طريقة أوضح لإدارة المرتجعات.")}</h1><p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">{t("Tell us about your store. We'll get in touch to show how Reload can help with return decisions and explore financing when it's available.", "عرّفنا بمتجرك. سنتواصل معك لنوضح كيف يساعدك ريلود في قرارات الإرجاع، ونناقش فرص التمويل عند توفرها.")}</p><div className="mt-10 flex items-center gap-3 border-t border-border pt-5 text-sm text-muted-foreground"><span className="grid size-8 place-items-center rounded-full border border-border"><Check className="size-4" /></span>{t("No commitment. Just a conversation.", "لا يوجد أي التزام؛ نبدأ بمحادثة.")}</div></div>
      <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-[0_24px_70px_-55px_rgba(15,15,18,.35)] sm:p-9">
        {state === "sent" ? <div role="status" className="py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-eligible-muted text-eligible"><Check className="size-6" /></span><h2 className="mt-5 text-2xl font-semibold">{t("You're on our list.", "وصلتنا بياناتك.")}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t("Thanks for your interest. The Reload team will follow up using the details you shared.", "شكرًا لاهتمامك. سيتواصل معك فريق ريلود عبر البيانات التي قدمتها.")}</p><Link href="/" className="mt-6 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">{t("Explore Reload", "اكتشف ريلود")}<ArrowUpRight className="size-4 rtl:-scale-x-100" /></Link></div> : <form onSubmit={(event) => void submit(event)} className="space-y-5"><div><h2 className="text-xl font-semibold">{t("Register your interest", "سجّل اهتمامك")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("A few details so we can reach the right person.", "بعض البيانات لنتواصل مع الشخص المناسب.")}</p></div><label className="block text-sm font-medium">{t("Store name", "اسم المتجر")}<Input className="mt-2" value={store} onChange={(event) => setStore(event.target.value)} required maxLength={120} autoComplete="organization" /></label><label className="block text-sm font-medium">{t("Your name", "اسمك")}<Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" /></label><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">{t("Work email", "البريد الإلكتروني")}<Input className="mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" /></label><label className="block text-sm font-medium">{t("Mobile number", "رقم الجوال")}<Input className="mt-2" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={25} autoComplete="tel" /></label></div><label className="block text-sm font-medium">{t("I'm interested in", "أهتم بـ")}<select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={interest} onChange={(event) => setInterest(event.target.value as typeof interest)}><option value="both">{t("Returns and financing", "الإرجاع والتمويل")}</option><option value="returns">{t("Returns", "الإرجاع")}</option><option value="financing">{t("Financing", "التمويل")}</option></select></label><p className="text-xs leading-5 text-muted-foreground">{t("By submitting, you ask Reload to contact you about this request. See our", "بإرسال الطلب، فإنك تطلب من ريلود التواصل معك بشأنه. راجع")} <Link href="/privacy" className="underline underline-offset-4">{t("privacy policy", "سياسة الخصوصية")}</Link>.</p><label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground"><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1 size-4 accent-foreground" /><span>{t("I also agree to receive occasional Reload product updates. Optional.", "أوافق أيضًا على تلقي تحديثات ريلود من حين لآخر. هذا الخيار اختياري.")}</span></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={state === "sending"}>{state === "sending" ? <Loader2 className="size-4 animate-spin" /> : null}{t("Send my details", "إرسال بياناتي")}</Button></form>}
      </div>
    </div>
  </main>;
}
