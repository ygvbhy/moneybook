/** 사용률(%) 소수 1자리. 예산이 없거나 0 이하면 null */
export function usageRate(spent: number, budget: number | null): number | null {
  if (budget === null || budget <= 0) return null;
  return Math.round((spent / budget) * 1000) / 10;
}

export type BudgetStatus = {
  budget: number | null;
  spent: number;
  remaining: number | null;
  rate: number | null;
  over: boolean;
  overAmount: number;
};

export function budgetStatus(spent: number, budget: number | null): BudgetStatus {
  const hasBudget = budget !== null && budget > 0;
  const over = hasBudget && spent > budget;
  return {
    budget,
    spent,
    remaining: hasBudget ? budget - spent : null,
    rate: usageRate(spent, budget),
    over,
    overAmount: over ? spent - budget : 0,
  };
}

export type BudgetOverview = BudgetStatus & {
  allocated: number;
  unallocated: number | null;
  allocationWarning: boolean;
};

export function budgetOverview(input: {
  total: number | null;
  categoryBudgets: { categoryId: string; amount: number }[];
  totalSpent: number;
}): BudgetOverview {
  const allocated = input.categoryBudgets.reduce((sum, b) => sum + b.amount, 0);
  const hasTotal = input.total !== null;
  return {
    ...budgetStatus(input.totalSpent, input.total),
    allocated,
    unallocated: hasTotal ? input.total! - allocated : null,
    allocationWarning: hasTotal && allocated > input.total!,
  };
}
