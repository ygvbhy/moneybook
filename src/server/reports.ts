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
