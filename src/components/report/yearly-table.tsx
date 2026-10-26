import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MonthTotal } from "@/lib/aggregate";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

function NetCell({ net }: { net: number }) {
  const sign = net > 0 ? "+" : net < 0 ? "-" : "";
  return (
    <span className={cn(net > 0 && "text-income", net < 0 && "text-expense")}>
      {sign}
      {formatKRW(Math.abs(net))}원
    </span>
  );
}

export function YearlyTable({ months }: { months: MonthTotal[] }) {
  const income = months.reduce((s, m) => s + m.income, 0);
  const expense = months.reduce((s, m) => s + m.expense, 0);
  return (
    <div className="overflow-x-auto">
      <Table className="tabular-nums">
        <TableHeader>
          <TableRow>
            <TableHead>월</TableHead>
            <TableHead className="text-right">수입</TableHead>
            <TableHead className="text-right">지출</TableHead>
            <TableHead className="text-right">순수입</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {months.map((m) => (
            <TableRow key={m.month}>
              <TableCell>
                <Link
                  href={`/transactions?month=${m.month}`}
                  className="underline-offset-2 hover:underline"
                >
                  {Number(m.month.slice(5))}월
                </Link>
              </TableCell>
              <TableCell className={cn("text-right", m.income > 0 && "text-income")}>
                {m.income > 0 && "+"}
                {formatKRW(m.income)}원
              </TableCell>
              <TableCell className={cn("text-right", m.expense > 0 && "text-expense")}>
                {m.expense > 0 && "-"}
                {formatKRW(m.expense)}원
              </TableCell>
              <TableCell className="text-right">
                <NetCell net={m.income - m.expense} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">합계</TableCell>
            <TableCell className={cn("text-right font-semibold", income > 0 && "text-income")}>
              {income > 0 && "+"}
              {formatKRW(income)}원
            </TableCell>
            <TableCell className={cn("text-right font-semibold", expense > 0 && "text-expense")}>
              {expense > 0 && "-"}
              {formatKRW(expense)}원
            </TableCell>
            <TableCell className="text-right font-semibold">
              <NetCell net={income - expense} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
