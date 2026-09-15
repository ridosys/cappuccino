import { PageHeaderSkeleton, CardSkeleton } from "@/components/shared/skeletons";

export default function PurchaseOrderDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSkeleton lines={4} />
        </div>
        <div className="space-y-6">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    </div>
  );
}
