"use client";

import { AmountText } from "@/components/transaction/amount-text";
import { useTransactionDialog } from "@/components/transaction/transaction-dialog-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAYMENT_METHOD_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { TransactionDto } from "@/server/transactions";

export function TransactionTable({ transactions }: { transactions: TransactionDto[] }) {
  const { openEdit } = useTransactionDialog();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>날짜</TableHead>
          <TableHead>유형 / 카테고리</TableHead>
          <TableHead>거래처 · 구매 항목</TableHead>
          <TableHead>결제 수단</TableHead>
          <TableHead className="text-right">금액</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => {
          const label = [tx.merchant, tx.item].filter(Boolean).join(" · ");
          return (
            <TableRow key={tx.id} className="cursor-pointer" onClick={() => openEdit(tx)}>
              <TableCell className="tabular-nums">
                <button
                  type="button"
                  className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={`거래 수정: ${tx.occurredOn} ${tx.categoryName}`}
                >
                  {tx.occurredOn}
                </button>
              </TableCell>
              <TableCell>
                {TYPE_LABELS[tx.type]} · {tx.categoryName}
                {tx.categoryArchived ? " (보관됨)" : ""}
              </TableCell>
              <TableCell className="max-w-72 truncate">{label || "-"}</TableCell>
              <TableCell>{tx.paymentMethod ? PAYMENT_METHOD_LABELS[tx.paymentMethod] : "-"}</TableCell>
              <TableCell className="text-right font-medium">
                <AmountText type={tx.type} amount={tx.amount} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
