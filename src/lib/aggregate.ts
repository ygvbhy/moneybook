import { monthOf } from "@/lib/date";

export type TransactionTypeValue = "INCOME" | "EXPENSE";

export type AggregateRow = {
  type: TransactionTypeValue;
  amount: number;
  occurredOn: string; // YYYY-MM-DD
  categoryId: string;
};

export function summarize(rows: AggregateRow[]) {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.type === "INCOME") income += r.amount;
    else expense += r.amount;
  }
  return { income, expense, net: income - expense };
}

export type DayTotal = { income: number; expense: number; count: number };

export function dailyTotals(rows: AggregateRow[]): Record<string, DayTotal> {
  const result: Record<string, DayTotal> = {};
  for (const r of rows) {
    const day = (result[r.occurredOn] ??= { income: 0, expense: 0, count: 0 });
    if (r.type === "INCOME") day.income += r.amount;
    else day.expense += r.amount;
    day.count += 1;
  }
  return result;
}

/** 지정 유형의 카테고리별 합계, 금액 내림차순 (동률은 categoryId 순) */
export function categoryTotals(
  rows: AggregateRow[],
  type: TransactionTypeValue,
): { categoryId: string; total: number }[] {
  const sums = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== type) continue;
    sums.set(r.categoryId, (sums.get(r.categoryId) ?? 0) + r.amount);
  }
  return [...sums]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total || a.categoryId.localeCompare(b.categoryId));
}

export type MonthTotal = { month: string; income: number; expense: number };

/** months 순서대로 월별 수입·지출 합계 (거래 없는 달은 0, months에 없는 달의 행은 무시) */
export function monthlyTotals(
  rows: Pick<AggregateRow, "type" | "amount" | "occurredOn">[],
  months: string[],
): MonthTotal[] {
  const byMonth = new Map<string, MonthTotal>(
    months.map((month) => [month, { month, income: 0, expense: 0 }]),
  );
  for (const r of rows) {
    const total = byMonth.get(monthOf(r.occurredOn));
    if (!total) continue;
    if (r.type === "INCOME") total.income += r.amount;
    else total.expense += r.amount;
  }
  return months.map((month) => byMonth.get(month)!);
}
