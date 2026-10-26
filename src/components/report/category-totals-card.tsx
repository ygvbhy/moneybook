import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatKRW } from "@/lib/money";
import type { CategorySpending } from "@/server/dashboard";

type Props = {
  title: string;
  emptyText: string;
  year: number;
  /** 연도가 올해가 아니면 거래 내역 링크에 month=YYYY-12를 붙인다 */
  isCurrentYear: boolean;
  type: "INCOME" | "EXPENSE";
  totals: CategorySpending[];
};

export function CategoryTotalsCard({ title, emptyText, year, isCurrentYear, type, totals }: Props) {
  const sum = totals.reduce((acc, c) => acc + c.total, 0);
  const sign = type === "INCOME" ? "+" : "-";
  const colorClass = type === "INCOME" ? "text-income" : "text-expense";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {totals.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y">
            {totals.map((c) => {
              const label = c.archived ? `${c.name} (보관됨)` : c.name;
              const share = Math.round((c.total / sum) * 1000) / 10;
              const params = new URLSearchParams({
                from: `${year}-01-01`,
                to: `${year}-12-31`,
                type,
                category: c.categoryId,
              });
              if (!isCurrentYear) params.set("month", `${year}-12`);
              return (
                <li key={c.categoryId}>
                  <Link
                    href={`/transactions?${params}`}
                    className="block space-y-1.5 rounded-md px-1 py-2.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{label}</span>
                      <span className="flex shrink-0 items-center gap-2 tabular-nums">
                        <span className={colorClass}>
                          {sign}
                          {formatKRW(c.total)}원
                        </span>
                        <span className="w-12 text-right text-muted-foreground">
                          {share.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <Progress value={share} aria-label={`${label} 비중 ${share}%`} className="h-1.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
