"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Labels } from "@/components/admin/use-labels";
import { cn } from "@/lib/utils";

/** Import an event sheet (CSV) into Leads. */
export function ImportDialog({ open, onOpenChange, labels, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; labels: Labels; onImported: () => void }) {
  const { t } = labels;
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const rows = csv ? Math.max(0, csv.trim().split(/\r?\n/).length - 1) : 0;

  const take = async (file?: File) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") { toast.error(t("Choose a .csv file.", "اختر ملف ‎.csv.")); return; }
    setCsv(await file.text());
    setFileName(file.name);
  };
  const reset = () => { setCsv(""); setFileName(""); setSource(""); };

  const submit = async () => {
    if (!csv || !source.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/leads/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, sourceLabel: source.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Import failed");
      toast.success(t(`${result.imported} leads imported, ${result.skipped} skipped.`, `تم استيراد ${result.imported}، وتجاوز ${result.skipped}.`));
      reset();
      onOpenChange(false);
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Import failed.", "تعذّر الاستيراد."));
    } finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
    <DialogContent className="rounded-2xl sm:max-w-lg">
      <DialogHeader className="text-start">
        <DialogTitle>{t("Import event sheet", "استيراد قائمة فعالية")}</DialogTitle>
        <DialogDescription>{t("A CSV with store_name, contact_name, and an email or phone column.", "ملف CSV بأعمدة store_name وcontact_name وبريد أو رقم هاتف.")}</DialogDescription>
      </DialogHeader>
      <label onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(event) => { event.preventDefault(); setOver(false); void take(event.dataTransfer.files[0]); }}
        className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-[background-color,border-color] duration-200", over ? "border-foreground/40 bg-muted" : fileName ? "border-foreground/25 bg-muted/40" : "border-border hover:border-foreground/25 hover:bg-muted/40")}>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void take(event.target.files?.[0])} />
        <span className="grid size-10 place-items-center rounded-full border border-border bg-background">{fileName ? <FileSpreadsheet className="size-4" /> : <Upload className="size-4" />}</span>
        {fileName ? <><span className="text-sm font-medium" dir="ltr">{fileName}</span><span className="text-xs text-muted-foreground">{t(`${rows} rows found. Click to choose another.`, `${rows} صفًا. انقر لاختيار ملف آخر.`)}</span></>
          : <><span className="text-sm font-medium">{t("Drop a CSV here, or click to choose", "أفلت ملف CSV هنا أو انقر للاختيار")}</span><span className="text-xs text-muted-foreground">{t("Up to 500 rows", "حتى 500 صف")}</span></>}
      </label>
      <label className="block text-sm font-medium">{t("Event or source name", "اسم الفعالية أو المصدر")}
        <Input className="mt-2" value={source} onChange={(event) => setSource(event.target.value)} maxLength={120} placeholder={t("Riyadh event, October 2026", "فعالية الرياض، أكتوبر 2026")} />
      </label>
      <p className="text-xs leading-5 text-muted-foreground">{t("Existing contacts are skipped. Marketing consent is never assumed from a sheet.", "يتم تجاوز جهات الاتصال الموجودة. لا تُفترض الموافقة التسويقية من القائمة.")}</p>
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
        <Button disabled={busy || !csv || !source.trim()} onClick={() => void submit()}>{busy && <Loader2 className="size-4 animate-spin" />}{t(rows ? `Import ${rows} leads` : "Import leads", rows ? `استيراد ${rows}` : "استيراد")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
