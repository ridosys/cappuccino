import { Skeleton } from "@/components/ui/skeleton";

export default function InvoicePrintLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="space-y-8 rounded-xl border p-8">
        <div className="flex items-start justify-between">
          <Skeleton className="h-7 w-24" />
          <div className="space-y-2 text-end">
            <Skeleton className="ms-auto h-5 w-20" />
            <Skeleton className="ms-auto h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-6 w-40" />
      </div>
    </div>
  );
}
