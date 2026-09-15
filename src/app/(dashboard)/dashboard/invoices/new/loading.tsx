import { PageHeaderSkeleton, FormFieldsSkeleton } from "@/components/shared/skeletons";

export default function NewInvoiceLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="max-w-3xl">
        <FormFieldsSkeleton fields={6} />
      </div>
    </div>
  );
}
