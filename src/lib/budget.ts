import { lastDayOfMonth, monthOf } from "@/lib/date";

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

export type DailyAllowance = {
  daysLeft: number;
  upcomingTotal: number;
  available: number;
  perDay: number;
};

/**
 * 오늘부터 월말까지(오늘 포함) 하루에 쓸 수 있는 금액.
 * 이번 달이 아니거나 전체 예산이 없거나 초과면 null.
 * 남은 고정지출 예정액을 뺀 뒤 내림한다.
 */
export function dailyAllowance(input: {
  month: string;
  today: string;
  overview: BudgetStatus;
  upcomingTotal: number;
}): DailyAllowance | null {
  const { month, today, overview, upcomingTotal } = input;
  if (monthOf(today) !== month) return null;
  if (overview.remaining === null || overview.over) return null;
  const daysLeft = lastDayOfMonth(month) - Number(today.slice(8, 10)) + 1;
  const available = overview.remaining - upcomingTotal;
  return {
    daysLeft,
    upcomingTotal,
    available,
    perDay: available > 0 ? Math.floor(available / daysLeft) : 0,
  };
}
