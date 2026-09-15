import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function PurchaseReturnDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="grid gap-3 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={4} columns={7} />
    </div>
  );
}
