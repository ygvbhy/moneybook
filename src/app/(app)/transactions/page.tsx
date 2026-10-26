import Link from "next/link";
import { requireSession } from "@/lib/auth/dal";
import { todayInSeoul } from "@/lib/date";
import { formatKRW } from "@/lib/money";
import { listCategories } from "@/server/categories";
import { materializeRecurring } from "@/server/recurring";
import { listTransactions, parseListParams } from "@/server/transactions";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageEmpty, PageHeader } from "@/components/app-shell/page-header";
import { TransactionCardList } from "@/components/transaction/transaction-card-list";
import { TransactionCsvMenu } from "@/components/transaction/transaction-csv-menu";
import { TransactionFilters } from "@/components/transaction/transaction-filters";
import { TransactionTable } from "@/components/transaction/transaction-table";

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  await requireSession();
  const today = todayInSeoul();
  await materializeRecurring(today);
  const sp = await searchParams;
  const params = await parseListParams(sp, today);
  const [transactions, categories] = await Promise.all([
    listTransactions(params),
    listCategories(),
  ]);

  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "INCOME") income += tx.amount;
    else expense += tx.amount;
  }
  // 필터 초기화는 month와 기간 파라미터를 유지한다
  const resetParams = new URLSearchParams({ month: params.month });
  if (params.period === "all") resetParams.set("range", "all");
  else if (params.period) {
    resetParams.set("from", params.period.from);
    resetParams.set("to", params.period.to);
  }
  const resetQuery = resetParams.toString();
  const filtered = !!(params.type || params.categoryId || params.paymentMethod || params.q);

  return (
    <>
      <PageHeader title="거래 내역">
        <div className="flex items-center gap-2">
          {params.period ? (
            <p className="text-sm font-medium tabular-nums" aria-live="polite">
              {params.period === "all"
                ? "전체 기간"
                : `${params.period.from.replaceAll("-", ".")} ~ ${params.period.to.replaceAll("-", ".")}`}
            </p>
          ) : (
            <MonthSwitcher month={params.month} basePath="/transactions" searchParams={sp} />
          )}
          <TransactionCsvMenu />
        </div>
      </PageHeader>
      <TransactionFilters
        categories={categories}
        month={params.month}
        period={params.period}
        type={params.type}
        categoryId={params.categoryId}
        paymentMethod={params.paymentMethod}
        q={params.q}
        sort={params.sort}
      />
      <p className="mb-4 text-sm tabular-nums" aria-label="필터 결과 합계">
        <span className="text-income">수입 +{formatKRW(income)}원</span>
        {" · "}
        <span className="text-expense">지출 -{formatKRW(expense)}원</span>
      </p>
      {transactions.length === 0 ? (
        filtered ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-sm text-muted-foreground">
            <p>조건에 맞는 거래가 없습니다</p>
            <Link
              href={`/transactions?${resetQuery}`}
              className="font-medium text-foreground underline underline-offset-4"
            >
              필터 초기화
            </Link>
          </div>
        ) : (
          <PageEmpty
            message={
              !params.period
                ? "이 달에는 거래가 없습니다"
                : params.period === "all"
                  ? "거래가 없습니다"
                  : "이 기간에는 거래가 없습니다"
            }
          />
        )
      ) : (
        <>
          <div className="hidden md:block">
            <TransactionTable transactions={transactions} />
          </div>
          <div className="md:hidden">
            <TransactionCardList transactions={transactions} showYear={!!params.period} />
          </div>
        </>
      )}
    </>
  );
}
