import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, FormFieldsSkeleton, CardSkeleton } from "@/components/shared/skeletons";

export default function InvoiceDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="max-w-3xl lg:col-span-2">
          <FormFieldsSkeleton fields={5} />
        </div>
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
