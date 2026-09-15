import { Skeleton } from "@/components/ui/skeleton";

export default function CaisseLoading() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex h-14 items-center gap-3 border-b bg-card px-4">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-9 max-w-md flex-1" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex flex-1 gap-4 p-4">
        <Skeleton className="hidden w-56 lg:block" />
        <Skeleton className="flex-1" />
        <Skeleton className="hidden w-80 xl:block" />
      </div>
    </div>
  );
}
