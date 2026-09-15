import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function CustomersLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton filters={1} />
      <TableSkeleton columns={7} />
    </div>
  );
}
