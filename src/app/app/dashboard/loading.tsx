import { Skeleton } from "@/components/ui/skeleton";
import { WidgetSkeleton } from "@/features/dashboard/components/widget";

export default function DashboardLoading() {
  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(300px,0.92fr)]" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-[290px] rounded-2xl lg:col-span-2 xl:col-span-3" />
      <WidgetSkeleton rows={6} />
      <WidgetSkeleton />
      <WidgetSkeleton />
      <WidgetSkeleton />
      <WidgetSkeleton />
    </div>
  );
}
