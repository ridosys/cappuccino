import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function RolesSettingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={6} columns={4} />
    </div>
  );
}
