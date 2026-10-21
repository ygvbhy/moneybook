"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AmountInput } from "@/components/amount-input";
import { BudgetMeter } from "@/components/budget/budget-meter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { setCategoryBudget } from "@/server/actions/budgets";
import type { CategoryBudgetRow } from "@/server/budgets";

function Row({ month, row }: { month: string; row: CategoryBudgetRow }) {
  const router = useRouter();
  const [value, setValue] = useState<number | null>(row.budget);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = `cat-budget-${row.categoryId}`;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setCategoryBudget({
        yearMonth: month,
        categoryId: row.categoryId,
        amount: value,
      });
      if (!res.ok) {
        setError(res.fieldErrors?.amount?.[0] ?? res.error);
        return;
      }
      toast.success(`${row.name} 예산을 ${value === null ? "해제했습니다" : "저장했습니다"}`);
      router.refresh();
    });
  }

  return (
    <li className="grid gap-3 py-4 md:grid-cols-[10rem_16rem_1fr] md:items-start">
      <div className="font-medium">
        {row.name}
        {row.archived && <span className="ml-1 text-sm text-muted-foreground">(보관됨)</span>}
      </div>
      <form
        className="space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor={inputId} className="sr-only">
              {row.name} 예산
            </Label>
            <AmountInput
              id={inputId}
              value={value}
              onChange={setValue}
              placeholder="미설정"
              aria-invalid={!!error}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            <span className="sr-only">{row.name} 예산 </span>
            {pending ? "저장 중..." : "저장"}
          </Button>
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      <BudgetMeter status={row} />
    </li>
  );
}

export function CategoryBudgetList({
  month,
  rows,
}: {
  month: string;
  rows: CategoryBudgetRow[];
}) {
  const hasAny = rows.some((r) => r.budget !== null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>카테고리 예산</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAny && (
          <p className="mb-2 text-sm text-muted-foreground">
            아직 설정된 카테고리 예산이 없습니다. 금액을 입력해 저장하세요.
          </p>
        )}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">지출 카테고리가 없습니다</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <Row key={`${month}-${r.categoryId}`} month={month} row={r} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
