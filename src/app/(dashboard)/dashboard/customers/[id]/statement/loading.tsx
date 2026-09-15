import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerStatementLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 border-b pb-5 sm:flex-row">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2 sm:flex sm:flex-col sm:items-end">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t pt-4 sm:items-end">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-48" />
        </div>
      </section>
    </div>
  );
}
