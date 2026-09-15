import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function InventoryLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={8} columns={4} />
    </div>
  );
}
