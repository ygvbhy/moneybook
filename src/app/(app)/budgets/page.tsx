import { requireSession } from "@/lib/auth/dal";
import { normalizeMonthParam, todayInSeoul } from "@/lib/date";
import { getBudgetPage } from "@/server/budgets";
import { listCategories } from "@/server/categories";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader } from "@/components/app-shell/page-header";
import { CategoryBudgetList } from "@/components/budget/category-budget-list";
import { CategoryManager } from "@/components/budget/category-manager";
import { TotalBudgetForm } from "@/components/budget/total-budget-form";

export default async function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  await requireSession();
  const sp = await searchParams;
  const month = normalizeMonthParam(
    typeof sp.month === "string" ? sp.month : undefined,
    todayInSeoul(),
  );
  const [page, categories] = await Promise.all([getBudgetPage(month), listCategories()]);

  return (
    <>
      <PageHeader title="예산">
        <MonthSwitcher month={month} basePath="/budgets" searchParams={sp} />
      </PageHeader>
      <div className="space-y-6">
        <TotalBudgetForm
          key={`total-${month}-${page.total ?? "none"}`}
          month={month}
          total={page.total}
          overview={page.overview}
        />
        <CategoryBudgetList month={month} rows={page.categories} />
        <CategoryManager categories={categories} />
      </div>
    </>
  );
}
