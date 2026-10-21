"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmountText } from "@/components/transaction/amount-text";
import { useTransactionDialog } from "@/components/transaction/transaction-dialog-provider";
import { formatDateLabel } from "@/lib/labels";
import { formatKRW } from "@/lib/money";
import type { UpcomingItem } from "@/lib/recurring";
import type { TransactionDto } from "@/server/transactions";

export function DayPanel({
  date,
  transactions,
  upcoming,
}: {
  date: string | null;
  transactions: TransactionDto[];
  upcoming: UpcomingItem[];
}) {
  const { openCreate, openEdit } = useTransactionDialog();

  if (!date) {
    return (
      <section
        aria-label="선택한 날짜"
        className="flex min-h-32 items-center justify-center rounded-xl border border-dashed p-4 text-sm text-muted-foreground"
      >
        날짜를 선택하세요
      </section>
    );
  }

  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "INCOME") income += tx.amount;
    else expense += tx.amount;
  }

  const upcomingSum = upcoming.reduce((sum, u) => sum + u.amount, 0);

  return (
    <section aria-label="선택한 날짜" className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{formatDateLabel(date)}</h2>
          <p className="mt-1 text-sm tabular-nums">
            <span className="text-income">수입 +{formatKRW(income)}원</span>
            {" · "}
            <span className="text-expense">지출 -{formatKRW(expense)}원</span>
            {upcoming.length > 0 && (
              <>
                {" · "}
                <span className="text-muted-foreground">예정 -{formatKRW(upcomingSum)}원</span>
              </>
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => openCreate({ date })}>
          <Plus aria-hidden /> 이 날짜에 추가
        </Button>
      </div>
      {transactions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">거래가 없습니다</p>
      ) : (
        <ul className="mt-3 divide-y">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <button
                type="button"
                onClick={() => openEdit(tx)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {tx.merchant || tx.item || tx.categoryName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {tx.categoryName}
                    {tx.categoryArchived ? " (보관됨)" : ""}
                  </span>
                </span>
                <AmountText type={tx.type} amount={tx.amount} className="shrink-0 text-sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {upcoming.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-medium text-muted-foreground">예정</h3>
          <ul className="divide-y">
            {upcoming.map((u) => (
              <li key={u.recurringId}>
                <Link
                  href="/recurring"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{u.item}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u.categoryName}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    -{formatKRW(u.amount)}원
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
