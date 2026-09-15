import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ScanPurchaseInvoiceLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}
