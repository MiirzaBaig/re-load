"use client";

import { useCallback, useEffect, useState } from "react";
import { Bug, CheckCircle2, MessageSquareText, MessageSquareWarning, RefreshCw } from "lucide-react";
import { Key, PageHeader } from "@/components/desk/page-header";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabase";
import { formatDateTimeString } from "@/lib/numerals";
import { cn } from "@/lib/utils";

type Report = { id: string; report_type: "BUG" | "FEEDBACK"; status: "NEW" | "REVIEWING" | "PLANNED" | "RESOLVED" | "CLOSED"; message: string; source_channel: "WHATSAPP" | "WEB"; context: Record<string, unknown>; created_at: string };

export function ReportsPage() {
  const { workspace } = useAuth();
  const { t, locale } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<"ALL" | "BUG" | "FEEDBACK">("ALL");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !workspace) return setLoading(false);
    const { data, error } = await supabase.from("product_reports").select("id,report_type,status,message,source_channel,context,created_at").eq("store_id", workspace.storeId).order("created_at", { ascending: false });
    if (error) toast.error(t("Could not load reports.", "تعذّر تحميل البلاغات."));
    setReports((data ?? []) as Report[]);
    setLoading(false);
  }, [workspace, t]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (id: string, status: Report["status"]) => {
    if (!supabase) return;
    setUpdating(id);
    const { error } = await supabase.functions.invoke("product-report-update", { body: { reportId: id, status } });
    if (error) toast.error(t("Could not update this report.", "تعذّر تحديث البلاغ."));
    else setReports((current) => current.map((report) => report.id === id ? { ...report, status } : report));
    setUpdating(null);
  };

  const visible = filter === "ALL" ? reports : reports.filter((report) => report.report_type === filter);

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 animate-fade-in">
    <PageHeader icon={MessageSquareWarning} title={t("Feedback", "الملاحظات")}
      actions={<Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={() => void load()}><RefreshCw className="size-4" />{t("Refresh", "تحديث")}</Button>}>
      {t("Problems and suggestions reported from WhatsApp.", "المشكلات والاقتراحات المبلَّغ عنها من واتساب.")} <Key>{t("Each one keeps the step it happened at.", "كل بلاغ يحتفظ بالخطوة التي حدث عندها.")}</Key>
    </PageHeader>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("Filter reports", "تصفية البلاغات")}>
      {(["ALL", "BUG", "FEEDBACK"] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{value === "ALL" ? t("All", "الكل") : value === "BUG" ? t("Problems", "المشكلات") : t("Feedback", "الملاحظات")}</Button>)}
    </div>
    {loading ? <div className="grid min-h-48 place-items-center"><Spinner /></div> : visible.length === 0 ? <Card className="border-dashed"><CardContent className="grid min-h-48 place-items-center text-center"><div><MessageSquareText className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">{t("Nothing here yet", "لا توجد بلاغات بعد")}</p><p className="mt-1 text-xs text-muted-foreground">{t("WhatsApp reports will appear here as soon as they are submitted.", "ستظهر بلاغات واتساب هنا فور إرسالها.")}</p></div></CardContent></Card> : <div className="grid gap-3">{visible.map((report) => {
      const Icon = report.report_type === "BUG" ? Bug : MessageSquareText;
      return <Card key={report.id} className="overflow-hidden rounded-2xl border-border/70"><CardContent className="p-5"><div className="flex items-start gap-3"><span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", report.report_type === "BUG" ? "bg-not-eligible-muted text-not-eligible" : "bg-primary/10 text-primary")}><Icon className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{report.report_type === "BUG" ? t("Problem", "مشكلة") : t("Feedback", "ملاحظة")}</Badge><Badge variant="outline">{report.status}</Badge><span className="text-xs text-muted-foreground">{report.source_channel} · {formatDateTimeString(report.created_at, { dateStyle: "medium", timeStyle: "short" }, locale)}</span></div><p dir="auto" className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{report.message}</p><div className="mt-4 flex flex-wrap gap-2">{report.status === "NEW" && <Button size="sm" variant="outline" onClick={() => void setStatus(report.id, "REVIEWING")} disabled={updating === report.id}>{updating === report.id && <Spinner />}{t("Start reviewing", "بدء المراجعة")}</Button>}{!(["RESOLVED", "CLOSED"] as string[]).includes(report.status) && <Button size="sm" onClick={() => void setStatus(report.id, "RESOLVED")} disabled={updating === report.id}><CheckCircle2 className="size-4" />{t("Mark resolved", "تم الحل")}</Button>}</div></div></div></CardContent></Card>;
    })}</div>}
  </div>;
}
