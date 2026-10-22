import { requireSession } from "@/lib/auth/dal";
import { normalizeMonthParam, todayInSeoul } from "@/lib/date";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetProgressCard } from "@/components/dashboard/budget-progress-card";
import {
  CategorySpendingChart,
  type CategorySpendingDatum,
} from "@/components/dashboard/category-spending-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { UpcomingRecurringCard } from "@/components/dashboard/upcoming-recurring-card";
import { upcomingIn } from "@/lib/recurring";
import { getBudgetPage } from "@/server/budgets";
import { getCategorySpending, getMonthSummary, getRecentTransactions } from "@/server/dashboard";
import { listRecurring, materializeRecurring } from "@/server/recurring";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  await requireSession();
  const today = todayInSeoul();
  await materializeRecurring(today);
  const sp = await searchParams;
  const month = normalizeMonthParam(
    typeof sp.month === "string" ? sp.month : undefined,
    today,
  );

  const [summary, spending, recent, budget, recurring] = await Promise.all([
    getMonthSummary(month),
    getCategorySpending(month),
    getRecentTransactions(month, 5),
    getBudgetPage(month),
    listRecurring(),
  ]);
  const upcoming = upcomingIn(month, recurring);

  const budgetByCategory = new Map(budget.categories.map((c) => [c.categoryId, c]));
  const chartData: CategorySpendingDatum[] = spending.map((s) => {
    const b = budgetByCategory.get(s.categoryId);
    return {
      categoryId: s.categoryId,
      name: s.archived ? `${s.name} (보관됨)` : s.name,
      total: s.total,
      rate: b?.rate ?? null,
      over: b?.over ?? false,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader title="대시보드">
        <MonthSwitcher month={month} basePath="/" searchParams={sp} />
      </PageHeader>
      <SummaryCards month={month} {...summary} overview={budget.overview} />
      <BudgetProgressCard month={month} overview={budget.overview} />
      <UpcomingRecurringCard upcoming={upcoming} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 지출</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                이 달의 지출이 없습니다
              </p>
            ) : (
              <CategorySpendingChart data={chartData} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>최근 거래</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactions month={month} transactions={recent} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
