"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/components/language-provider";
import { CaseDetail } from "@/views/cases/detail";

/**
 * The case open in the drawer, kept in the URL (`?case=<id>`) so refresh,
 * back/forward and shared links land on the same case. History is written
 * directly; nothing here needs a server round-trip.
 */
export function useOpenCase() {
  const [caseId, setCaseId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setCaseId(new URLSearchParams(window.location.search).get("case"));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const open = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("case", id);
    else url.searchParams.delete("case");
    // Opening adds a history entry (back closes it); closing replaces it.
    if (id && !new URLSearchParams(window.location.search).get("case")) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    setCaseId(id);
  }, []);
  return [caseId, open] as const;
}

/** A case slides in over the page, so the list underneath never moves. */
export function CaseDrawer({ caseId, onOpenChange }: { caseId: string | null; onOpenChange: (id: string | null) => void }) {
  const { t, isArabic } = useLanguage();
  return (
    <Sheet open={!!caseId} onOpenChange={(open) => { if (!open) onOpenChange(null); }}>
      <SheetContent side={isArabic ? "left" : "right"} showCloseButton={false} className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[620px]" onOpenAutoFocus={(event) => event.preventDefault()}>
        <SheetTitle className="sr-only">{t("Return case", "حالة إرجاع")}</SheetTitle>
        <SheetDescription className="sr-only">{t("Decision receipt and case status", "إيصال القرار وحالة الطلب")}</SheetDescription>
        {caseId && (
          <div key={caseId} className="admin-fade px-5 py-5 sm:px-7 sm:py-6">
            <CaseDetail caseId={caseId} variant="drawer" onClose={() => onOpenChange(null)} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
