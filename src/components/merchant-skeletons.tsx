import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={cn(className)} />;
}

/** Generic /app route transition placeholder */
export function MerchantRouteSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-4 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2.5">
          <SkeletonBlock className="h-8 w-56 max-w-full sm:h-9 sm:w-72" />
          <SkeletonBlock className="h-4 w-36" />
        </div>
        <SkeletonBlock className="h-7 w-28 rounded-full" />
      </div>
      <SkeletonBlock className="h-64 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <SkeletonBlock className="h-48 w-full rounded-2xl" />
        <SkeletonBlock className="hidden h-48 w-full rounded-2xl lg:block" />
      </div>
    </div>
  );
}

export function OverviewPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 pb-4 sm:gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2.5">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-8 w-[min(100%,18rem)] sm:h-9 sm:w-80" />
          <SkeletonBlock className="h-4 w-28" />
        </div>
        <SkeletonBlock className="h-7 w-28 rounded-full" />
      </div>
      <div className="grid overflow-hidden rounded-3xl border border-border bg-card md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="space-y-4 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="size-14 shrink-0 rounded-full" />
            <div className="space-y-2"><SkeletonBlock className="h-3 w-24" /><SkeletonBlock className="h-6 w-52" /></div>
          </div>
          <SkeletonBlock className="h-4 w-full max-w-md" />
          <SkeletonBlock className="h-11 w-48 rounded-xl" />
          <div className="flex gap-2 pt-4"><SkeletonBlock className="h-6 w-20 rounded-full" /><SkeletonBlock className="h-6 w-20 rounded-full" /><SkeletonBlock className="h-6 w-24 rounded-full" /></div>
        </div>
        <div className="hidden border-s border-border bg-muted/25 p-6 md:flex md:items-center md:justify-center">
          <SkeletonBlock className="h-36 w-full max-w-[280px] rounded-2xl" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-[76px] rounded-2xl" />)}
      </div>
    </div>
  );
}

export function IntegrationsPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-7">
      <div className="space-y-3">
        <SkeletonBlock className="h-5 w-24 rounded-full" />
        <SkeletonBlock className="h-8 w-64 max-w-full sm:h-9" />
        <SkeletonBlock className="h-4 w-full max-w-xl" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-4">
            <SkeletonBlock className="size-12 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-2.5">
              <div className="flex gap-2">
                <SkeletonBlock className="h-5 w-16" />
                <SkeletonBlock className="h-5 w-20 rounded-full" />
              </div>
              <SkeletonBlock className="h-4 w-full max-w-lg" />
              <SkeletonBlock className="h-4 w-3/4 max-w-md" />
            </div>
          </div>
          <SkeletonBlock className="h-10 w-36 rounded-md" />
        </div>
        <div className="grid border-t border-border sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <SkeletonBlock className="size-4 rounded" />
              <SkeletonBlock className="h-4 flex-1 max-w-[8rem]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-32" />
        <SkeletonBlock className="h-4 w-72 max-w-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6">
          <SkeletonBlock className="mb-1 h-5 w-40" />
          <SkeletonBlock className="mb-6 h-4 w-56 max-w-full" />
          <div className="space-y-4">
            <SkeletonBlock className="h-10 w-full max-w-md rounded-md" />
            <SkeletonBlock className="h-10 w-full max-w-md rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CaseDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="size-9 rounded-lg" />
        <div className="space-y-2">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonBlock className="h-52 rounded-xl lg:col-span-2" />
        <SkeletonBlock className="h-52 rounded-xl" />
      </div>
      <SkeletonBlock className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function PolicyListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SkeletonBlock className="mb-3 h-5 w-24" />
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
          <SkeletonBlock className="size-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-3 w-48" />
          </div>
        </div>
      </div>
      <div>
        <SkeletonBlock className="mb-3 h-5 w-20" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-5"
            >
              <SkeletonBlock className="size-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="h-3 w-40" />
              </div>
              <SkeletonBlock className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CaseListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
        >
          <SkeletonBlock className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-3 w-48" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-5 w-20 rounded-full" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sidebar workspace card while auth/workspace is loading */
export function SidebarWorkspaceSkeleton() {
  return (
    <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 px-3 py-2.5">
      <SkeletonBlock className="mb-2 h-2.5 w-16" />
      <div className="flex items-center gap-2">
        <SkeletonBlock className="size-4 rounded-full" />
        <SkeletonBlock className="h-4 flex-1 max-w-[7rem]" />
      </div>
    </div>
  );
}
