import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BudgetOverview } from "@/lib/budget";
import { formatKRW, formatKRWDelta } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  income: number;
  expense: number;
  net: number;
  overview: BudgetOverview;
  /** 전월 합계, 비교할 전월이 없으면 undefined */
  prev?: { income: number; expense: number; net: number };
};

function DeltaLine({ delta }: { delta: number }) {
  const text = formatKRWDelta(delta);
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      전월 대비{" "}
      {delta === 0 ? (
        text
      ) : (
        <>
          <span aria-hidden>{text.slice(0, 1)}</span>
          <span className="sr-only">{delta > 0 ? "증가" : "감소"}</span>
          {text.slice(1)}
        </>
      )}
    </p>
  );
}

function Stat({
  title,
  children,
  delta,
  helper,
}: {
  title: string;
  children: React.ReactNode;
  delta?: number;
  helper?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-lg font-semibold tabular-nums sm:text-xl">{children}</div>
        {delta !== undefined && <DeltaLine delta={delta} />}
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ month, income, expense, net, overview, prev }: Props) {
  const netSign = net > 0 ? "+" : net < 0 ? "-" : "";
  const hasBudget = overview.budget !== null && overview.budget > 0;
  const remaining = overview.remaining ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat title="총수입" delta={prev && income - prev.income}>
        <span className={cn(income > 0 && "text-income")}>
          {income > 0 && "+"}
          {formatKRW(income)}원
        </span>
      </Stat>
      <Stat title="총지출" delta={prev && expense - prev.expense}>
        <span className={cn(expense > 0 && "text-expense")}>
          {expense > 0 && "-"}
          {formatKRW(expense)}원
        </span>
      </Stat>
      <Stat title="순현금흐름" delta={prev && net - prev.net} helper="수입 - 지출 · 계좌 잔고 아님">
        <span className={cn(net > 0 && "text-income", net < 0 && "text-expense")}>
          {netSign}
          {formatKRW(Math.abs(net))}원
        </span>
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
            <span className="text-destructive">-{formatKRW(Math.abs(remaining))}원</span>
            <Badge variant="destructive">초과</Badge>
          </span>
        ) : (
          <>{formatKRW(remaining)}원</>
        )}
      </Stat>
    </div>
  );
}
