import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function InventoryLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={4} columns={4} />
      <TableSkeleton rows={6} columns={6} />
    </div>
  );
}
