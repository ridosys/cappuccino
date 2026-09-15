import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/shared/skeletons";

export default function ReportsIndexLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm"
          >
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
