import { PageHeaderSkeleton, FormFieldsSkeleton } from "@/components/shared/skeletons";

export default function NewPurchaseOrderLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="max-w-2xl">
        <FormFieldsSkeleton fields={4} />
      </div>
    </div>
  );
}
