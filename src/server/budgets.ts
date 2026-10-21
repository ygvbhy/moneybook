import "server-only";
import { db } from "@/lib/db";
import { budgetOverview, budgetStatus, type BudgetStatus } from "@/lib/budget";
import { monthRange, toDbDate } from "@/lib/date";
import { CATEGORY_NOT_FOUND, ServiceError } from "@/server/service-error";

export type CategoryBudgetRow = BudgetStatus & {
  categoryId: string;
  name: string;
  archived: boolean;
};

export async function getBudgetPage(month: string) {
  const { start, endExclusive } = monthRange(month);
  const [totalRow, budgets, spending] = await Promise.all([
    db.monthlyBudget.findUnique({ where: { yearMonth: month } }),
    db.categoryBudget.findMany({ where: { yearMonth: month } }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        type: "EXPENSE",
        occurredOn: { gte: toDbDate(start), lt: toDbDate(endExclusive) },
      },
      _sum: { amount: true },
    }),
  ]);

  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b.amount]));
  const spentByCategory = new Map(spending.map((s) => [s.categoryId, s._sum.amount ?? 0]));
  const relevantIds = [...new Set([...budgetByCategory.keys(), ...spentByCategory.keys()])];

  // 활성 지출 카테고리 + 해당 월에 예산이나 지출이 있는 보관 카테고리
  const categories = await db.category.findMany({
    where: {
      type: "EXPENSE",
      OR: [{ archivedAt: null }, { id: { in: relevantIds } }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const rows: CategoryBudgetRow[] = categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    archived: c.archivedAt !== null,
    ...budgetStatus(spentByCategory.get(c.id) ?? 0, budgetByCategory.get(c.id) ?? null),
  }));

  const totalSpent = [...spentByCategory.values()].reduce((a, b) => a + b, 0);
  const total = totalRow?.totalAmount ?? null;
  const overview = budgetOverview({
    total,
    categoryBudgets: budgets.map((b) => ({ categoryId: b.categoryId, amount: b.amount })),
    totalSpent,
  });

  return { month, total, totalSpent, overview, categories: rows };
}

/** amount가 null이면 미설정(행 삭제), 아니면 upsert */
export async function setTotalBudget(month: string, amount: number | null): Promise<void> {
  if (amount === null) {
    await db.monthlyBudget.deleteMany({ where: { yearMonth: month } });
    return;
  }
  await db.monthlyBudget.upsert({
    where: { yearMonth: month },
    update: { totalAmount: amount },
    create: { yearMonth: month, totalAmount: amount },
  });
}

/** 지출 카테고리만 허용. amount가 null이면 행 삭제 */
export async function setCategoryBudget(
  month: string,
  categoryId: string,
  amount: number | null,
): Promise<void> {
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ServiceError(CATEGORY_NOT_FOUND);
  if (category.type !== "EXPENSE") {
    throw new ServiceError("지출 카테고리에만 예산을 설정할 수 있습니다");
  }
  if (amount === null) {
    await db.categoryBudget.deleteMany({ where: { yearMonth: month, categoryId } });
    return;
  }
  await db.categoryBudget.upsert({
    where: { yearMonth_categoryId: { yearMonth: month, categoryId } },
    update: { amount },
    create: { yearMonth: month, categoryId, amount },
  });
}
