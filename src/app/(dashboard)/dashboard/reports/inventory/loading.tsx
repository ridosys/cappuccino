import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function InventoryReportLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <Skeleton className="h-8 w-48" />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
