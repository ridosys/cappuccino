import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function PurchaseReturnsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <FilterBarSkeleton filters={0} />
      <TableSkeleton rows={10} columns={7} />
    </div>
  );
}
