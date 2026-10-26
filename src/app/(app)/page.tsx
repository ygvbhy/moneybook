import { requireSession } from "@/lib/auth/dal";
import { isValidYearMonth, normalizeMonthParam, shiftMonth, todayInSeoul } from "@/lib/date";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetProgressCard } from "@/components/dashboard/budget-progress-card";
import {
  CategorySpendingChart,
  type CategorySpendingDatum,
} from "@/components/dashboard/category-spending-chart";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { PaymentMethodSpendingCard } from "@/components/dashboard/payment-method-spending-card";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { UpcomingRecurringCard } from "@/components/dashboard/upcoming-recurring-card";
import { dailyAllowance } from "@/lib/budget";
import { upcomingIn } from "@/lib/recurring";
import { getBudgetPage } from "@/server/budgets";
import {
  getCategorySpending,
  getMonthSummary,
  getMonthlyTrend,
  getPaymentMethodSpending,
  getRecentTransactions,
} from "@/server/dashboard";
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

  // 1900-01은 전월이 유효 범위 밖이라 비교하지 않는다
  const prevMonth = shiftMonth(month, -1);
  const [summary, spending, prevSpending, trend, recent, budget, recurring, paymentSpending] = await Promise.all([
    getMonthSummary(month),
    getCategorySpending(month),
    isValidYearMonth(prevMonth) ? getCategorySpending(prevMonth) : Promise.resolve([]),
    getMonthlyTrend(month),
    getRecentTransactions(month, 5),
    getBudgetPage(month),
    listRecurring(),
    getPaymentMethodSpending(month),
  ]);
  const upcoming = upcomingIn(month, recurring);
  const allowance = dailyAllowance({
    month,
    today,
    overview: budget.overview,
    upcomingTotal: upcoming.reduce((sum, u) => sum + u.amount, 0),
  });

  const prevTrend = trend.find((t) => t.month === prevMonth);
  const prev = prevTrend && {
    income: prevTrend.income,
    expense: prevTrend.expense,
    net: prevTrend.income - prevTrend.expense,
  };
  const prevByCategory = new Map(prevSpending.map((s) => [s.categoryId, s.total]));
  const hasTrend = trend.some((t) => t.income > 0 || t.expense > 0);

  const budgetByCategory = new Map(budget.categories.map((c) => [c.categoryId, c]));
  const chartData: CategorySpendingDatum[] = spending.map((s) => {
    const b = budgetByCategory.get(s.categoryId);
    return {
      categoryId: s.categoryId,
      name: s.archived ? `${s.name} (보관됨)` : s.name,
      total: s.total,
      rate: b?.rate ?? null,
      over: b?.over ?? false,
      delta: isValidYearMonth(prevMonth) ? s.total - (prevByCategory.get(s.categoryId) ?? 0) : null,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader title="대시보드">
        <MonthSwitcher month={month} basePath="/" searchParams={sp} />
      </PageHeader>
      <SummaryCards month={month} {...summary} overview={budget.overview} prev={prev} />
      <BudgetProgressCard month={month} overview={budget.overview} allowance={allowance} />
      <UpcomingRecurringCard upcoming={upcoming} />
      <Card>
        <CardHeader>
          <CardTitle>월별 추이</CardTitle>
          <p className="text-xs text-muted-foreground">최근 6개월</p>
        </CardHeader>
        <CardContent>
          {hasTrend ? (
            <MonthlyTrendChart data={trend} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              최근 6개월 거래가 없습니다
            </p>
          )}
        </CardContent>
      </Card>
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
              <CategorySpendingChart month={month} data={chartData} />
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
      <PaymentMethodSpendingCard month={month} spending={paymentSpending} />
    </div>
  );
}
