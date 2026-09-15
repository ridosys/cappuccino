import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function CategoriesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton filters={0} />
      <TableSkeleton columns={5} />
    </div>
  );
}
