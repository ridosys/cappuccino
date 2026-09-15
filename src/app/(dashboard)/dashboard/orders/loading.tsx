import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton filters={2} />
      <TableSkeleton columns={6} />
    </div>
  );
}
