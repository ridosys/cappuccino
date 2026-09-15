import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  CardSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function CustomerProfileLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <StatCardsSkeleton count={3} />
      <CardSkeleton lines={5} />
      <div className="space-y-2">
        <TableSkeleton rows={3} columns={5} />
      </div>
      <div className="space-y-2">
        <TableSkeleton rows={3} columns={6} />
      </div>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={3} />
    </div>
  );
}
