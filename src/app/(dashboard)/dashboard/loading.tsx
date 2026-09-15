import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  AnalyticsFilterBarSkeleton,
  ChartCardSkeleton,
  RankedListCardSkeleton,
} from "@/components/shared/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />

      <StatCardsSkeleton count={6} />

      <AnalyticsFilterBarSkeleton />

      <StatCardsSkeleton count={7} />

      <ChartCardSkeleton height="h-72" />

      <div className="grid gap-4 lg:grid-cols-2">
        <RankedListCardSkeleton />
        <RankedListCardSkeleton />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
