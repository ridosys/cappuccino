import { PageHeaderSkeleton, TableSkeleton, CardSkeleton } from "@/components/shared/skeletons";

export default function OrderDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TableSkeleton rows={3} columns={4} />
          <CardSkeleton lines={3} />
        </div>
        <div className="space-y-6">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    </div>
  );
}
