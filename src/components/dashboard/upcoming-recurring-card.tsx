import Link from "next/link";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateLabel } from "@/lib/labels";
import { formatKRW } from "@/lib/money";
import type { UpcomingItem } from "@/lib/recurring";

export function UpcomingRecurringCard({ upcoming }: { upcoming: UpcomingItem[] }) {
  const total = upcoming.reduce((sum, u) => sum + u.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>남은 고정지출</CardTitle>
        {upcoming.length > 0 && (
          <CardAction className="text-sm font-medium text-muted-foreground tabular-nums">
            -{formatKRW(total)}원
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {upcoming.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">남은 고정지출이 없습니다</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((u) => (
              <li key={u.recurringId}>
                <Link
                  href="/recurring"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-2.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{u.item}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDateLabel(u.date)} · {u.categoryName}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums">
                    -{formatKRW(u.amount)}원
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="text-right">
          <Link
            href="/recurring"
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            고정지출 관리
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
