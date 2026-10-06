import { Skeleton } from "@/components/admin/ui";

// Shaped like the admin list pages (title, filters, table), so nothing jumps when data arrives.
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-72" />
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="h-9 border-b border-line" />
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-6 border-b border-line px-4 last:border-0"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
