import "server-only";
import { db } from "@/lib/db";
import { fromDbDate, monthRange, toDbDate } from "@/lib/date";
import type { DayTotal } from "@/lib/aggregate";
import { toTransactionDto, type TransactionDto } from "@/server/transactions";

/** 선택 월의 일별 합계 (거래가 있는 날짜만 키로 존재) */
export async function getDailyTotals(month: string): Promise<Record<string, DayTotal>> {
  const { start, endExclusive } = monthRange(month);
  const groups = await db.transaction.groupBy({
    by: ["occurredOn", "type"],
    where: { occurredOn: { gte: toDbDate(start), lt: toDbDate(endExclusive) } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const result: Record<string, DayTotal> = {};
  for (const g of groups) {
    const day = (result[fromDbDate(g.occurredOn)] ??= { income: 0, expense: 0, count: 0 });
    if (g.type === "INCOME") day.income += g._sum.amount ?? 0;
    else day.expense += g._sum.amount ?? 0;
    day.count += g._count._all;
  }
  return result;
}

/** 하루의 거래 (생성 순) */
export async function listTransactionsByDate(date: string): Promise<TransactionDto[]> {
  const rows = await db.transaction.findMany({
    where: { occurredOn: toDbDate(date) },
    include: { category: { select: { name: true, archivedAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toTransactionDto);
}
