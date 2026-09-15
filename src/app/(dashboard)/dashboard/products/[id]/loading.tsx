import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  CardSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function ProductProfileLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <StatCardsSkeleton count={3} />
      <CardSkeleton lines={4} />
      <TableSkeleton rows={5} columns={5} />
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}
