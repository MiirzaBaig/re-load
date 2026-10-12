import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-5">
      <Skeleton className="h-16 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
