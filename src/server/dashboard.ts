import "server-only";
import { db } from "@/lib/db";
import { monthRange, toDbDate } from "@/lib/date";
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
