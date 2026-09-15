import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  CardSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

export default function SupplierProfileLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <StatCardsSkeleton count={4} />
      <CardSkeleton lines={3} />
      <TableSkeleton rows={5} columns={6} />
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
}
