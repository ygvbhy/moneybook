import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { BudgetOverview } from "@/lib/budget";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

export function BudgetProgressCard({
  month,
  overview,
}: {
  month: string;
  overview: BudgetOverview;
}) {
  const hasTotal = overview.budget !== null && overview.budget > 0;
  const percent = Math.min(100, Math.max(0, overview.rate ?? 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle>전체 예산</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasTotal ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">전체 예산 미설정</p>
            <Link
              href={`/budgets?month=${month}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              예산 설정하기
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="tabular-nums">
                사용 {formatKRW(overview.spent)}원 / 예산 {formatKRW(overview.budget!)}원
              </span>
              <span className="flex items-center gap-2">
                {overview.over && (
                  <Badge variant="destructive">
                    초과 {formatKRW(overview.overAmount)}원
                  </Badge>
                )}
                <span className="font-semibold tabular-nums">{overview.rate?.toFixed(1)}%</span>
              </span>
            </div>
            <Progress
              value={percent}
              aria-label="전체 예산 사용률"
              className={cn(
                "h-2",
                overview.over && "*:data-[slot=progress-indicator]:bg-destructive",
              )}
            />
            {overview.allocationWarning && (
              <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert className="size-3.5" aria-hidden />
                카테고리 예산 합계({formatKRW(overview.allocated)}원)가 전체 예산보다 큽니다
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
