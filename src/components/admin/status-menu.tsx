"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/desk/primitives";
import { STATUSES } from "@/components/admin/types";
import type { Labels } from "@/components/admin/use-labels";
import { cn } from "@/lib/utils";

/** Pick a pipeline stage. The trigger is the status pill itself, unless a
 *  custom trigger is passed (the board card's "Move to" button). */
export function StatusMenu({ status, onChange, labels, disabled, trigger, align = "start", label }: {
  status: string;
  onChange: (status: string) => void;
  labels: Labels;
  disabled?: boolean;
  trigger?: ReactNode;
  align?: "start" | "end";
  label?: string;
}) {
  const { t } = labels;
  if (disabled && !trigger) {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium"><StatusDot status={status} />{labels.status(status)}</span>;
  }
  return <DropdownMenu>
    <DropdownMenuTrigger asChild disabled={disabled}>
      {trigger ?? <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background ps-2.5 pe-2 text-xs font-medium transition-[background-color,border-color] duration-200 hover:border-foreground/25 data-[state=open]:border-foreground/30 data-[state=open]:bg-muted/60" aria-label={label ?? t("Change status", "تغيير الحالة")}>
        <StatusDot status={status} />{labels.status(status)}<ChevronDown className="size-3.5 text-muted-foreground" />
      </button>}
    </DropdownMenuTrigger>
    <DropdownMenuContent align={align} className="w-48" onClick={(event) => event.stopPropagation()}>
      <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">{t("Move to", "نقل إلى")}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {STATUSES.map((option) => <DropdownMenuItem key={option} onSelect={() => option !== status && onChange(option)} className={cn("gap-2 text-sm", option === status && "font-medium")}>
        <StatusDot status={option} />{labels.status(option)}{option === status && <Check className="ms-auto size-3.5" />}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
