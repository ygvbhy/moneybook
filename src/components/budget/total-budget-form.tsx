"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AmountInput } from "@/components/amount-input";
import { BudgetMeter } from "@/components/budget/budget-meter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { setTotalBudget } from "@/server/actions/budgets";
import { formatKRW } from "@/lib/money";
import type { BudgetOverview } from "@/lib/budget";

export function TotalBudgetForm({
  month,
  total,
  overview,
}: {
  month: string;
  total: number | null;
  overview: BudgetOverview;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number | null>(total);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setTotalBudget({ yearMonth: month, amount: value });
      if (!res.ok) {
        setError(res.fieldErrors?.amount?.[0] ?? res.error);
        return;
      }
      toast.success(value === null ? "전체 예산을 해제했습니다" : "전체 예산을 저장했습니다");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>전체 예산</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="total-budget" className="sr-only">
              전체 예산
            </Label>
            <AmountInput
              id="total-budget"
              value={value}
              onChange={setValue}
              placeholder="비워두면 미설정"
              aria-invalid={!!error}
              aria-describedby={error ? "total-budget-error" : undefined}
            />
            {error && (
              <p id="total-budget-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "저장 중..." : "저장"}
          </Button>
        </form>

        {total === null ? (
          <p className="text-sm text-muted-foreground">
            이번 달 전체 예산을 설정하세요
            {overview.spent > 0 && ` (이번 달 지출 ${formatKRW(overview.spent)}원)`}
          </p>
        ) : (
          <>
            <BudgetMeter status={overview} />
            <p className="text-sm tabular-nums text-muted-foreground">
              미배정 금액 {formatKRW(overview.unallocated ?? 0)}원
            </p>
            {overview.allocationWarning && (
              <p role="alert" className="text-sm font-medium text-destructive">
                카테고리 예산 합계가 전체 예산보다 큽니다
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
