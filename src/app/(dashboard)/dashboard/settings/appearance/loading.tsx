import {
  PageHeaderSkeleton,
  CardSkeleton,
} from "@/components/shared/skeletons";

export default function AppearanceSettingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={6} />
    </div>
  );
}
