import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ cards = 0, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-8 w-52" />
      </div>
      {cards > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: cards }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
