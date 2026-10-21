import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

/** 수입은 +, 지출은 −(U+2212). 색만으로 구분하지 않는다 */
export function AmountText({
  type,
  amount,
  className,
}: {
  type: "INCOME" | "EXPENSE";
  amount: number;
  className?: string;
}) {
  const income = type === "INCOME";
  return (
    <span
      className={cn(
        "tabular-nums",
        income && "text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      {income ? "+" : "−"}
      {formatKRW(amount)}원
    </span>
  );
}
