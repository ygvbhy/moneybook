"use client";

import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { AmountText } from "@/components/transaction/amount-text";
import { useTransactionDialog } from "@/components/transaction/transaction-dialog-provider";
import { PAYMENT_METHOD_LABELS, TYPE_LABELS, formatDateLabel } from "@/lib/labels";
import type { TransactionDto } from "@/server/transactions";

export function TransactionCardList({
  transactions,
  showYear = false,
  selectMode,
  selectedIds,
  onToggle,
}: {
  transactions: TransactionDto[];
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  showYear?: boolean;
}) {
  const { openEdit } = useTransactionDialog();
  // 입력 순서(정렬된 결과)를 유지하며 날짜별로 묶는다
  const groups: { date: string; items: TransactionDto[] }[] = [];
  for (const tx of transactions) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.occurredOn) last.items.push(tx);
    else groups.push({ date: tx.occurredOn, items: [tx] });
  }
  // 여러 해에 걸칠 수 있는 기간·전체 모드에서는 제목에 연도를 붙인다
  const heading = (date: string) =>
    showYear ? `${date.slice(0, 4)}년 ${formatDateLabel(date)}` : formatDateLabel(date);
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.date} aria-label={heading(g.date)}>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">{heading(g.date)}</h2>
          <ul className="flex flex-col gap-2">
            {g.items.map((tx) => {
              const label = [tx.merchant, tx.item].filter(Boolean).join(" · ");
              const selected = selectedIds.has(tx.id);
              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => (selectMode ? onToggle(tx.id) : openEdit(tx))}
                    aria-pressed={selectMode ? selected : undefined}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {selectMode &&
                      (selected ? (
                        <CheckCircle2Icon aria-hidden className="size-5 shrink-0 text-primary" />
                      ) : (
                        <CircleIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                      ))}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {TYPE_LABELS[tx.type]} · {tx.categoryName}
                        {tx.categoryArchived ? " (보관됨)" : ""}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[label, tx.paymentMethod ? PAYMENT_METHOD_LABELS[tx.paymentMethod] : ""]
                          .filter(Boolean)
                          .join(" · ") || "-"}
                      </span>
                    </span>
                    <AmountText type={tx.type} amount={tx.amount} className="shrink-0 text-sm font-semibold" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
