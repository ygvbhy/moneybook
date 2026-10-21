import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

/** 수입은 +, 지출은 -. 색만으로 구분하지 않는다 */
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
        income ? "text-income" : "text-expense",
        className,
      )}
    >
      {income ? "+" : "-"}
      {formatKRW(amount)}원
    </span>
  );
}
