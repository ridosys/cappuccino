import { Skeleton } from "@/components/ui/skeleton";

export default function CaisseInvoiceLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
