import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BudgetOverview } from "@/lib/budget";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  income: number;
  expense: number;
  net: number;
  overview: BudgetOverview;
};

function Stat({
  title,
  children,
  helper,
}: {
  title: string;
  children: React.ReactNode;
  helper?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-lg font-semibold tabular-nums sm:text-xl">{children}</div>
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ month, income, expense, net, overview }: Props) {
  const netSign = net > 0 ? "+" : net < 0 ? "−" : "";
  const hasBudget = overview.budget !== null && overview.budget > 0;
  const remaining = overview.remaining ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat title="총수입">
        <span className={cn(income > 0 && "text-emerald-700 dark:text-emerald-400")}>
          {income > 0 && "+"}
          {formatKRW(income)}원
        </span>
      </Stat>
      <Stat title="총지출">
        {expense > 0 && "−"}
        {formatKRW(expense)}원
      </Stat>
      <Stat title="순현금흐름" helper="수입 − 지출 · 계좌 잔고 아님">
        {netSign}
        {formatKRW(Math.abs(net))}원
      </Stat>
      <Stat
        title="남은 예산"
        helper={
          hasBudget ? undefined : (
            <Link href={`/budgets?month=${month}`} className="underline underline-offset-2">
              예산 미설정
            </Link>
          )
        }
      >
        {!hasBudget ? (
          <span aria-label="남은 예산 없음">—</span>
        ) : overview.over ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-destructive">−{formatKRW(Math.abs(remaining))}원</span>
            <Badge variant="destructive">초과</Badge>
          </span>
        ) : (
          <>{formatKRW(remaining)}원</>
        )}
      </Stat>
    </div>
  );
}
