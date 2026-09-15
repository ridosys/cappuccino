import { PageHeaderSkeleton, FormFieldsSkeleton } from "@/components/shared/skeletons";

export default function NewOrderLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormFieldsSkeleton fields={4} />
        </div>
        <FormFieldsSkeleton fields={3} />
      </div>
    </div>
  );
}
