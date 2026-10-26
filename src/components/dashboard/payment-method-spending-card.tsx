import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatKRW } from "@/lib/money";
import type { PaymentMethodSpending } from "@/server/dashboard";

export function PaymentMethodSpendingCard({
  month,
  spending,
}: {
  month: string;
  spending: PaymentMethodSpending[];
}) {
  const sum = spending.reduce((acc, s) => acc + s.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>결제수단별 지출</CardTitle>
      </CardHeader>
      <CardContent>
        {spending.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">이 달의 지출이 없습니다</p>
        ) : (
          <ul className="divide-y">
            {spending.map((s) => {
              const label = s.paymentMethod ? PAYMENT_METHOD_LABELS[s.paymentMethod] : "미지정";
              const share = Math.round((s.total / sum) * 1000) / 10;
              return (
                <li key={s.paymentMethod ?? "none"}>
                  <Link
                    href={`/transactions?${new URLSearchParams({ month, type: "EXPENSE", payment: s.paymentMethod ?? "none" })}`}
                    className="block space-y-1.5 rounded-md px-1 py-2.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{label}</span>
                      <span className="flex shrink-0 items-center gap-2 tabular-nums">
                        <span className="text-expense">-{formatKRW(s.total)}원</span>
                        <span className="w-12 text-right text-muted-foreground">
                          {share.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <Progress value={share} aria-label={`${label} 비중 ${share}%`} className="h-1.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
