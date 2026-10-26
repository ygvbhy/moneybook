"use client";

import { AmountText } from "@/components/transaction/amount-text";
import { useTransactionDialog } from "@/components/transaction/transaction-dialog-provider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAYMENT_METHOD_LABELS, TYPE_LABELS } from "@/lib/labels";
import { formatKRW } from "@/lib/money";
import type { TransactionDto } from "@/server/transactions";

export function TransactionTable({
  transactions,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  transactions: TransactionDto[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const { openEdit } = useTransactionDialog();
  const selectedCount = transactions.filter((tx) => selectedIds.has(tx.id)).length;
  const allChecked: boolean | "indeterminate" =
    selectedCount === 0 ? false : selectedCount === transactions.length ? true : "indeterminate";
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(checked) => onToggleAll(checked === true)}
              aria-label="전체 선택"
            />
          </TableHead>
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
            <TableRow
              key={tx.id}
              className="cursor-pointer"
              data-state={selectedIds.has(tx.id) ? "selected" : undefined}
              onClick={() => openEdit(tx)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(tx.id)}
                  onCheckedChange={() => onToggle(tx.id)}
                  aria-label={`선택: ${tx.occurredOn} ${tx.categoryName} ${formatKRW(tx.amount)}원`}
                />
              </TableCell>
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
