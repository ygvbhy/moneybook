import "server-only";
import { db } from "@/lib/db";
import { fromDbDate, monthRange, recentMonths, toDbDate } from "@/lib/date";
import { monthlyTotals, type MonthTotal } from "@/lib/aggregate";
import { pickRecentPresets, type TransactionPreset } from "@/lib/transaction-presets";
import { toTransactionDto, type TransactionDto } from "@/server/transactions";

function monthWhere(month: string) {
  const { start, endExclusive } = monthRange(month);
  return { occurredOn: { gte: toDbDate(start), lt: toDbDate(endExclusive) } };
}

export async function getMonthSummary(month: string) {
  const groups = await db.transaction.groupBy({
    by: ["type"],
    where: monthWhere(month),
    _sum: { amount: true },
  });
  let income = 0;
  let expense = 0;
  for (const g of groups) {
    if (g.type === "INCOME") income = g._sum.amount ?? 0;
    else expense = g._sum.amount ?? 0;
  }
  return { income, expense, net: income - expense };
}

export type CategorySpending = {
  categoryId: string;
  name: string;
  archived: boolean;
  total: number;
};

/** 선택 월 지출의 카테고리별 합계, 금액 내림차순 (동률은 categoryId 순) */
export async function getCategorySpending(month: string): Promise<CategorySpending[]> {
  const groups = await db.transaction.groupBy({
    by: ["categoryId"],
    where: { ...monthWhere(month), type: "EXPENSE" },
    _sum: { amount: true },
  });
  const categories = await db.category.findMany({
    where: { id: { in: groups.map((g) => g.categoryId) } },
    select: { id: true, name: true, archivedAt: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));
  return groups
    .map((g) => ({
      categoryId: g.categoryId,
      name: byId.get(g.categoryId)?.name ?? "",
      archived: byId.get(g.categoryId)?.archivedAt != null,
      total: g._sum.amount ?? 0,
    }))
    .sort((a, b) => b.total - a.total || a.categoryId.localeCompare(b.categoryId));
}

/** 선택 월을 끝으로 최근 count개월의 월별 수입·지출 합계 (오래된 순, 거래 없는 달은 0) */
export async function getMonthlyTrend(month: string, count = 6): Promise<MonthTotal[]> {
  const months = recentMonths(month, count);
  const groups = await db.transaction.groupBy({
    by: ["occurredOn", "type"],
    where: {
      occurredOn: {
        gte: toDbDate(monthRange(months[0]).start),
        lt: toDbDate(monthRange(month).endExclusive),
      },
    },
    _sum: { amount: true },
  });
  return monthlyTotals(
    groups.map((g) => ({
      type: g.type,
      amount: g._sum.amount ?? 0,
      occurredOn: fromDbDate(g.occurredOn),
    })),
    months,
  );
}

/** 선택 월 안에서 가장 최근 거래 (occurredOn desc, createdAt desc) */
export async function getRecentTransactions(month: string, limit = 5): Promise<TransactionDto[]> {
  const rows = await db.transaction.findMany({
    where: monthWhere(month),
    include: { category: { select: { name: true, archivedAt: true } } },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toTransactionDto);
}

/** 해당 유형에서 최근에 쓴 보관되지 않은 카테고리 id (최근 사용 순, 중복 없음) */
export async function getRecentCategoryIds(
  type: "INCOME" | "EXPENSE",
  limit = 5,
): Promise<string[]> {
  const rows = await db.transaction.findMany({
    where: { type, category: { archivedAt: null } },
    select: { categoryId: true },
    distinct: ["categoryId"],
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
  });
  return rows.slice(0, limit).map((r) => r.categoryId);
}

/**
 * 거래 추가 폼의 "최근 거래" 칩 원본: 수동 입력 거래 + 활성 카테고리만,
 * 최근 100건에서 같은 내용을 합쳐 유형별 최대 5개
 */
export async function getRecentTransactionPresets(): Promise<
  Record<"INCOME" | "EXPENSE", TransactionPreset[]>
> {
  const rows = await db.transaction.findMany({
    where: { recurringExpenseId: null, category: { archivedAt: null } },
    select: {
      type: true,
      amount: true,
      categoryId: true,
      merchant: true,
      item: true,
      paymentMethod: true,
      category: { select: { name: true } },
    },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return pickRecentPresets(
    rows.map((r) => ({
      type: r.type,
      amount: r.amount,
      categoryId: r.categoryId,
      categoryName: r.category.name,
      merchant: r.merchant,
      item: r.item,
      paymentMethod: r.paymentMethod,
    })),
  );
}
