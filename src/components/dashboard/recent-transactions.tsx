"use client";

import Link from "next/link";
import { AmountText } from "@/components/transaction/amount-text";
import { useTransactionDialog } from "@/components/transaction/transaction-dialog-provider";
import { formatDateLabel } from "@/lib/labels";
import type { TransactionDto } from "@/server/transactions";

export function RecentTransactions({
  month,
  transactions,
}: {
  month: string;
  transactions: TransactionDto[];
}) {
  const { openEdit } = useTransactionDialog();

  return (
    <div className="space-y-2">
      {transactions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">이 달의 거래가 없습니다</p>
      ) : (
        <ul className="divide-y">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <button
                type="button"
                onClick={() => openEdit(tx)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-2.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {tx.merchant || tx.item || tx.categoryName}
                    {tx.categoryArchived && " (보관됨)"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDateLabel(tx.occurredOn)} · {tx.categoryName}
                  </span>
                </span>
                <AmountText type={tx.type} amount={tx.amount} className="shrink-0 text-sm font-medium" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="text-right">
        <Link
          href={`/transactions?month=${month}`}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          전체 보기
        </Link>
      </div>
    </div>
  );
}
