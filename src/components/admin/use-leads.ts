"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import type { Lead, LeadChanges } from "@/components/admin/types";

type SaveState = "saving" | "saved";

/**
 * Leads held on the client with optimistic edits. A change shows at once;
 * if the server refuses it, it is rolled back and the toast offers a retry.
 * Nothing reloads the page, so the board never flashes.
 */
export function useLeads(initial: Lead[]) {
  const { t } = useLanguage();
  const [leads, setLeads] = useState(initial);
  const leadsRef = useRef(initial);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const timers = useRef<Record<string, number>>({});

  // A server refresh (after an import) replaces the list.
  useEffect(() => {
    leadsRef.current = initial;
    setLeads(initial);
  }, [initial]);

  const apply = useCallback((id: string, changes: LeadChanges) => {
    const next = leadsRef.current.map((lead) => (lead.id === id ? { ...lead, ...changes } : lead));
    leadsRef.current = next;
    setLeads(next);
  }, []);

  const mark = useCallback((id: string, state: SaveState | null) => {
    window.clearTimeout(timers.current[id]);
    setSaveState((current) => {
      const next = { ...current };
      if (state) next[id] = state;
      else delete next[id];
      return next;
    });
    if (state === "saved") timers.current[id] = window.setTimeout(() => mark(id, null), 1600);
  }, []);

  const update = useCallback(async function update(
    id: string,
    changes: LeadChanges,
    options: { message?: string; undoable?: boolean } = {},
  ): Promise<boolean> {
    const before = leadsRef.current.find((lead) => lead.id === id);
    if (!before) return false;
    const previous = Object.fromEntries(
      Object.keys(changes).map((key) => [key, before[key as keyof Lead]]),
    ) as LeadChanges;

    apply(id, changes);
    mark(id, "saving");
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      apply(id, previous);
      mark(id, null);
      toast.error(t("Couldn't save, so the change was undone.", "تعذّر الحفظ، لذا أُلغي التغيير."), {
        action: { label: t("Retry", "إعادة المحاولة"), onClick: () => void update(id, changes, options) },
      });
      return false;
    }
    mark(id, "saved");
    if (options.message) {
      toast.success(options.message, options.undoable ? {
        action: { label: t("Undo", "تراجع"), onClick: () => void update(id, previous, { message: t("Change undone.", "تم التراجع.") }) },
      } : undefined);
    }
    return true;
  }, [apply, mark, t]);

  return { leads, update, saveState };
}
