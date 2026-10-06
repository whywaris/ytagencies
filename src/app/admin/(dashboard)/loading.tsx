import { Skeleton } from "@/components/admin/ui";

// Shaped like the dashboard: title + period, KPI row, chart, two rows of panels.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-bg p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-64 w-full" />
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
