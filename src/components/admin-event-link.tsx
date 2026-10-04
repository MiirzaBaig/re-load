"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/components/language-provider";

export function AdminEventLink() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    const nextUrl = `${window.location.origin}/interest`;
    setUrl(nextUrl);
    void QRCode.toDataURL(nextUrl, { width: 512, margin: 2, color: { dark: "#0F0F12", light: "#FFFFFF" } }).then(setQr);
  }, [open]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2200); }
    catch { toast.error(t("Could not copy the link.", "تعذّر نسخ الرابط.")); }
  };
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}><Link2 className="size-4" />{t("Event signup link", "رابط تسجيل الفعالية")}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md rounded-2xl bg-card p-6"><DialogHeader className="text-start"><DialogTitle className="text-xl">{t("Event signups", "التسجيل في الفعاليات")}</DialogTitle><DialogDescription className="leading-6">{t("Share this link or show the code at your stand. Each form submission appears in Leads.", "شارك الرابط أو اعرض الرمز في جناحك. تظهر التسجيلات في قائمة العملاء المحتملين.")}</DialogDescription></DialogHeader><div className="mx-auto mt-2 grid size-56 place-items-center rounded-xl border border-border bg-white p-3">{qr ? <img src={qr} alt={t("QR code for the Reload event signup page", "رمز الاستجابة السريعة لصفحة تسجيل ريلود")} className="size-full" /> : <span className="text-xs text-muted-foreground">{t("Preparing QR code…", "جارٍ تجهيز الرمز…")}</span>}</div><div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"><span className="min-w-0 flex-1 truncate text-xs" dir="ltr">{url}</span><button onClick={() => void copy()} className="rounded-md p-1.5 hover:bg-muted" aria-label={t("Copy event link", "نسخ رابط الفعالية")}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button></div><p className="text-xs leading-5 text-muted-foreground">{t("For this event, the form records contact requests. Marketing permission is a separate, optional choice.", "يسجل النموذج طلبات التواصل لهذا الحدث. الموافقة على الرسائل التسويقية خيار منفصل واختياري.")}</p></DialogContent></Dialog>
  </>;
}
