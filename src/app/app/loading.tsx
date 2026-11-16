import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="mx-auto grid max-w-3xl gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-48 rounded-lg" />
      <Skeleton className="h-4 w-80 rounded-md" />
      <Skeleton className="mt-2 h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
