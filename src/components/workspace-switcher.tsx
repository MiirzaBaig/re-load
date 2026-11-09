"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { StoreIdentity } from "@/components/store-identity";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function WorkspaceSwitcher({ fallbackName }: { fallbackName: string }) {
  const auth = useAuth();
  const { t, isArabic } = useLanguage();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const name = auth.workspace?.storeName ?? fallbackName;
  const display = <><span className="block text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/55">{t("Workspace", "مساحة العمل")}</span><span className="mt-1 block text-sm font-medium text-sidebar-foreground"><StoreIdentity name={name} markSize="sm" /></span></>;
  const classes = "w-full rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 px-3 py-2.5 text-start transition-colors";
  if (auth.workspaces.length < 2) return <div className={classes}>{display}</div>;
  function select(id: string) {
    setSwitching(true); setError("");
    try { auth.switchWorkspace(id); }
    catch { setSwitching(false); setError(t("Couldn’t switch workspace. Refresh and try again.", "تعذّر تبديل مساحة العمل. حدّث الصفحة وحاول مرة أخرى.")); }
  }
  return <div>
    <DropdownMenu dir={isArabic ? "rtl" : "ltr"}>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={switching} className={`${classes} flex items-center justify-between gap-2 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} aria-label={t("Switch workspace", "تبديل مساحة العمل")}>
          <span className="min-w-0">{display}</span>
          {switching ? <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-xl p-2">
        <DropdownMenuLabel>{t("Your workspaces", "مساحات عملك")}</DropdownMenuLabel>
        {auth.workspaces.map((workspace) => <DropdownMenuItem key={workspace.storeId} disabled={switching || workspace.storeId === auth.workspace?.storeId} onSelect={() => select(workspace.storeId)} className="justify-between gap-2 rounded-lg py-3">
          <span className="truncate" dir="auto">{workspace.storeName}</span>
          {workspace.storeId === auth.workspace?.storeId && <Check className="size-4 shrink-0" />}
        </DropdownMenuItem>)}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs leading-5 text-muted-foreground">{t("Switching closes open forms. Save your changes first.", "التبديل يغلق النماذج المفتوحة. احفظ تعديلاتك أولًا.")}</p>
      </DropdownMenuContent>
    </DropdownMenu>
    {error && <p role="alert" className="mt-2 text-xs leading-5 text-destructive">{error}</p>}
  </div>;
}
