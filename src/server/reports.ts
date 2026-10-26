import "server-only";
import { db } from "@/lib/db";
import { monthRange, toDbDate } from "@/lib/date";
import type { CategorySpending } from "@/server/dashboard";

/** 한 해(1/1 ~ 12/31)의 카테고리별 수입·지출 합계, 금액 내림차순 (동률은 categoryId 순) */
export async function getYearCategoryTotals(
  year: number,
): Promise<{ income: CategorySpending[]; expense: CategorySpending[] }> {
  const groups = await db.transaction.groupBy({
    by: ["categoryId", "type"],
    where: {
      occurredOn: {
        gte: toDbDate(monthRange(`${year}-01`).start),
        lt: toDbDate(monthRange(`${year}-12`).endExclusive),
      },
    },
    _sum: { amount: true },
  });
  const categories = await db.category.findMany({
    where: { id: { in: groups.map((g) => g.categoryId) } },
    select: { id: true, name: true, archivedAt: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));
  const toRows = (type: "INCOME" | "EXPENSE") =>
    groups
      .filter((g) => g.type === type)
      .map((g) => ({
        categoryId: g.categoryId,
        name: byId.get(g.categoryId)?.name ?? "",
        archived: byId.get(g.categoryId)?.archivedAt != null,
        total: g._sum.amount ?? 0,
      }))
      .sort((a, b) => b.total - a.total || a.categoryId.localeCompare(b.categoryId));
  return { income: toRows("INCOME"), expense: toRows("EXPENSE") };
}

export type MerchantSpending = { merchant: string; total: number };

/** 거래처 순위에 보여줄 상위 개수 */
export const MERCHANT_RANK_LIMIT = 10;

/**
 * 한 해의 거래처별 지출 상위 목록. 거래처 미입력(null) 지출은 순위에서 빼고 unnamedTotal로 따로 준다.
 * total은 미입력을 포함한 그 해 지출 전체(비중 분모).
 * 금액 내림차순, 동률은 거래처 이름 코드포인트 순(로캘 영향을 피하려 localeCompare를 쓰지 않는다).
 */
export async function getYearMerchantSpending(
  year: number,
): Promise<{ top: MerchantSpending[]; total: number; unnamedTotal: number }> {
  const groups = await db.transaction.groupBy({
    by: ["merchant"],
    where: {
      type: "EXPENSE",
      occurredOn: {
        gte: toDbDate(monthRange(`${year}-01`).start),
        lt: toDbDate(monthRange(`${year}-12`).endExclusive),
      },
    },
    _sum: { amount: true },
  });
  let total = 0;
  let unnamedTotal = 0;
  const rows: MerchantSpending[] = [];
  for (const g of groups) {
    const sum = g._sum.amount ?? 0;
    total += sum;
    if (g.merchant === null) unnamedTotal += sum;
    else rows.push({ merchant: g.merchant, total: sum });
  }
  rows.sort((a, b) => b.total - a.total || (a.merchant < b.merchant ? -1 : 1));
  return { top: rows.slice(0, MERCHANT_RANK_LIMIT), total, unnamedTotal };
}
