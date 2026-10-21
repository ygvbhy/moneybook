import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/money";
import type { BudgetStatus } from "@/lib/budget";

/** 사용액/잔여/사용률/진행바/초과 표시. 예산이 없으면 사용액만 보여준다 */
export function BudgetMeter({ status }: { status: BudgetStatus }) {
  const { budget, spent, remaining, rate, over, overAmount } = status;
  return (
    <div className="space-y-1.5 text-sm tabular-nums">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={spent > 0 ? "text-expense" : undefined}>사용 {formatKRW(spent)}원</span>
        {budget !== null && remaining !== null && !over && (
          <span className="text-muted-foreground">잔여 {formatKRW(remaining)}원</span>
        )}
        {rate !== null && <span className="text-muted-foreground">{rate}%</span>}
        {over && (
          <Badge variant="destructive">초과 {formatKRW(overAmount)}원</Badge>
        )}
      </div>
      {rate !== null && (
        <Progress
          value={Math.min(rate, 100)}
          aria-label={`사용률 ${rate}%`}
          className={over ? "bg-destructive/20 [&>div]:bg-destructive" : undefined}
        />
      )}
    </div>
  );
}
