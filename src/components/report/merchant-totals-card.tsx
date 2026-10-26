import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatKRW } from "@/lib/money";
import { MERCHANT_RANK_LIMIT, type MerchantSpending } from "@/server/reports";

type Props = {
  year: number;
  /** 연도가 올해가 아니면 거래 내역 링크에 month=YYYY-12를 붙인다 */
  isCurrentYear: boolean;
  data: { top: MerchantSpending[]; total: number; unnamedTotal: number };
};

export function MerchantTotalsCard({ year, isCurrentYear, data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>거래처별 지출</CardTitle>
        <p className="text-xs text-muted-foreground">상위 {MERCHANT_RANK_LIMIT}곳</p>
      </CardHeader>
      <CardContent>
        {data.top.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            거래처가 입력된 지출이 없습니다
          </p>
        ) : (
          <ul className="divide-y">
            {data.top.map((m) => {
              const share = Math.round((m.total / data.total) * 1000) / 10;
              const params = new URLSearchParams({
                from: `${year}-01-01`,
                to: `${year}-12-31`,
                type: "EXPENSE",
                q: m.merchant,
              });
              if (!isCurrentYear) params.set("month", `${year}-12`);
              return (
                <li key={m.merchant}>
                  <Link
                    href={`/transactions?${params}`}
                    className="block space-y-1.5 rounded-md px-1 py-2.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{m.merchant}</span>
                      <span className="flex shrink-0 items-center gap-2 tabular-nums">
                        <span className="text-expense">-{formatKRW(m.total)}원</span>
                        <span className="w-12 text-right text-muted-foreground">
                          {share.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <Progress
                      value={share}
                      aria-label={`${m.merchant} 비중 ${share}%`}
                      className="h-1.5"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {data.unnamedTotal > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            거래처 미입력 지출 {formatKRW(data.unnamedTotal)}원은 순위에서 제외했습니다
          </p>
        )}
      </CardContent>
    </Card>
  );
}
