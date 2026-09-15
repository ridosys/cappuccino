import {
  CardSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function BrandProfileLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={3} />
      <CardSkeleton lines={2} />
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
}
