import { requireSession } from "@/lib/auth/dal";
import { normalizeYearParam, todayInSeoul } from "@/lib/date";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageEmpty, PageHeader } from "@/components/app-shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { CategoryTotalsCard } from "@/components/report/category-totals-card";
import { MerchantTotalsCard } from "@/components/report/merchant-totals-card";
import { YearSwitcher } from "@/components/report/year-switcher";
import { YearlyTable } from "@/components/report/yearly-table";
import { getMonthlyTrend } from "@/server/dashboard";
import { materializeRecurring } from "@/server/recurring";
import { getYearCategoryTotals, getYearMerchantSpending } from "@/server/reports";

function Stat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-semibold tabular-nums sm:text-xl">{children}</div>
      </CardContent>
    </Card>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireSession();
  const today = todayInSeoul();
  await materializeRecurring(today);
  const sp = await searchParams;
  const yearParam = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  const year = normalizeYearParam(yearParam, today);

  const [months, categories, merchants] = await Promise.all([
    getMonthlyTrend(`${year}-12`, 12),
    getYearCategoryTotals(year),
    getYearMerchantSpending(year),
  ]);
  const income = months.reduce((s, m) => s + m.income, 0);
  const expense = months.reduce((s, m) => s + m.expense, 0);
  const net = income - expense;
  const netSign = net > 0 ? "+" : net < 0 ? "-" : "";
  const hasData = months.some((m) => m.income > 0 || m.expense > 0);
  const isCurrentYear = year === Number(today.slice(0, 4));

  return (
    <div className="space-y-4">
      <PageHeader title="연간 요약">
        <YearSwitcher year={year} />
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat title="연 총수입">
          <span className={cn(income > 0 && "text-income")}>
            {income > 0 && "+"}
            {formatKRW(income)}원
          </span>
        </Stat>
        <Stat title="총지출">
          <span className={cn(expense > 0 && "text-expense")}>
            {expense > 0 && "-"}
            {formatKRW(expense)}원
          </span>
        </Stat>
        <Stat title="순수입">
          <span className={cn(net > 0 && "text-income", net < 0 && "text-expense")}>
            {netSign}
            {formatKRW(Math.abs(net))}원
          </span>
        </Stat>
      </div>
      {!hasData ? (
        <PageEmpty message="이 해에는 거래가 없습니다" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>월별 추이</CardTitle>
              <p className="text-xs text-muted-foreground">{year}년 1월 ~ 12월</p>
            </CardHeader>
            <CardContent>
              <MonthlyTrendChart data={months} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>월별 수입·지출</CardTitle>
            </CardHeader>
            <CardContent>
              <YearlyTable months={months} />
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <CategoryTotalsCard
              title="카테고리별 지출"
              emptyText="이 해의 지출이 없습니다"
              year={year}
              isCurrentYear={isCurrentYear}
              type="EXPENSE"
              totals={categories.expense}
            />
            <CategoryTotalsCard
              title="카테고리별 수입"
              emptyText="이 해의 수입이 없습니다"
              year={year}
              isCurrentYear={isCurrentYear}
              type="INCOME"
              totals={categories.income}
            />
          </div>
          <MerchantTotalsCard year={year} isCurrentYear={isCurrentYear} data={merchants} />
        </>
      )}
    </div>
  );
}
