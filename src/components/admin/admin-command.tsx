"use client";

import { useCallback } from "react";
import { Download, Keyboard, Languages, Moon, Store, Sun, Upload, type LucideIcon } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { useLanguage } from "@/components/language-provider";
import { useTheme } from "@/components/theme-provider";
import { StatusDot } from "@/components/desk/primitives";
import type { Lead, Merchant } from "@/components/admin/types";
import type { View } from "@/components/admin/use-admin-state";
import type { Labels } from "@/components/admin/use-labels";

export type NavItem = { id: View; label: string; icon: LucideIcon; key: string };

/** ⌘K for the desk: jump to a view, a lead or a store, or run an action. */
export function AdminCommand({ open, onOpenChange, nav, leads, merchants, labels, canEdit, onView, onLead, onMerchant, onImport, onShortcuts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nav: NavItem[];
  leads: Lead[];
  merchants: Merchant[];
  labels: Labels;
  canEdit: boolean;
  onView: (view: View) => void;
  onLead: (id: string) => void;
  onMerchant: (id: string) => void;
  onImport: () => void;
  onShortcuts: () => void;
}) {
  const { t } = labels;
  const { toggleLocale } = useLanguage();
  const { resolvedTheme, toggleTheme } = useTheme();
  const run = useCallback((action: () => void) => {
    onOpenChange(false);
    requestAnimationFrame(action);
  }, [onOpenChange]);

  return <CommandDialog open={open} onOpenChange={onOpenChange} title={t("Command menu", "قائمة الأوامر")} description={t("Jump to a view, lead or store", "انتقل إلى عرض أو عميل أو متجر")} className="palette" showCloseButton={false}>
    <CommandInput placeholder={t("Search leads, stores, or jump to…", "ابحث عن عميل أو متجر أو انتقل إلى…")} />
    <CommandList className="palette-list">
      <CommandEmpty>{t("Nothing matches.", "لا توجد نتائج.")}</CommandEmpty>
      <CommandGroup heading={t("Go to", "انتقل إلى")}>
        {nav.map((item) => <CommandItem key={item.id} value={`go ${item.label} ${item.id}`} onSelect={() => run(() => onView(item.id))} className="palette-item">
          <item.icon className="size-4" /><span>{item.label}</span><CommandShortcut dir="ltr">G {item.key.toUpperCase()}</CommandShortcut>
        </CommandItem>)}
      </CommandGroup>
      {leads.length > 0 && <><CommandSeparator /><CommandGroup heading={t("Leads", "العملاء المحتملون")}>
        {leads.map((lead) => <CommandItem key={lead.id} value={`lead ${lead.store_name} ${lead.contact_name} ${lead.source_label} ${lead.store_platform ?? ""} ${lead.id}`} onSelect={() => run(() => onLead(lead.id))} className="palette-item">
          <StatusDot status={lead.status} /><span className="truncate" dir="auto">{lead.store_name}</span><span className="truncate text-xs text-muted-foreground" dir="auto">{lead.contact_name}</span><CommandShortcut>{labels.status(lead.status)}</CommandShortcut>
        </CommandItem>)}
      </CommandGroup></>}
      {merchants.length > 0 && <><CommandSeparator /><CommandGroup heading={t("Stores", "المتاجر")}>
        {merchants.map((m) => <CommandItem key={m.id} value={`store ${m.name} ${m.id}`} onSelect={() => run(() => onMerchant(m.id))} className="palette-item">
          <Store className="size-4" /><span className="truncate" dir="auto">{m.name}</span>
        </CommandItem>)}
      </CommandGroup></>}
      <CommandSeparator />
      <CommandGroup heading={t("Actions", "إجراءات")}>
        {canEdit && <CommandItem value="import event sheet csv" onSelect={() => run(onImport)} className="palette-item"><Upload className="size-4" /><span>{t("Import event sheet", "استيراد قائمة فعالية")}</span></CommandItem>}
        {canEdit && <CommandItem value="export leads csv download" onSelect={() => run(() => { window.location.href = "/api/admin/leads/export"; })} className="palette-item"><Download className="size-4" /><span>{t("Export leads (CSV)", "تصدير العملاء (CSV)")}</span></CommandItem>}
        <CommandItem value="theme dark light mode" onSelect={() => run(toggleTheme)} className="palette-item">{resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}<span>{resolvedTheme === "dark" ? t("Light mode", "الوضع الفاتح") : t("Dark mode", "الوضع الداكن")}</span></CommandItem>
        <CommandItem value="language arabic english عربي" onSelect={() => run(toggleLocale)} className="palette-item"><Languages className="size-4" /><span>{t("العربية", "English")}</span></CommandItem>
        <CommandItem value="keyboard shortcuts help" onSelect={() => run(onShortcuts)} className="palette-item"><Keyboard className="size-4" /><span>{t("Keyboard shortcuts", "اختصارات لوحة المفاتيح")}</span><CommandShortcut>?</CommandShortcut></CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>;
}
