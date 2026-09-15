import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  FormFieldsSkeleton,
} from "@/components/shared/skeletons";

export default function NewPurchaseReturnLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <div className="space-y-3 rounded-lg border p-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-full max-w-sm" />
      </div>
      <FormFieldsSkeleton fields={3} />
    </div>
  );
}
