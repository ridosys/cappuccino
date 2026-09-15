import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function UsersSettingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <FilterBarSkeleton filters={0} />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
