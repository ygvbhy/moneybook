"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthTotal } from "@/lib/aggregate";
import { formatCompactKRW, formatKRW } from "@/lib/money";

/** "YYYY-MM" → "M월", 1월은 연도를 붙여 "YY년 1월" */
function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return m === "01" ? `${y.slice(2)}년 1월` : `${Number(m)}월`;
}

function fullMonthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: MonthTotal }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{fullMonthLabel(d.month)}</p>
      <p className="tabular-nums">수입 <span className="text-income">+{formatKRW(d.income)}원</span></p>
      <p className="tabular-nums">지출 <span className="text-expense">-{formatKRW(d.expense)}원</span></p>
    </div>
  );
}

export function MonthlyTrendChart({ data }: { data: MonthTotal[] }) {
  return (
    <div className="viz-trend">
      <style>{`
        .viz-trend {
          --viz-income: var(--income);
          --viz-expense: var(--expense);
          --viz-axis: #52514e;
          --viz-grid: #e4e3df;
        }
        .dark .viz-trend {
          --viz-axis: #c3c2b7;
          --viz-grid: #3a3a38;
        }
        .viz-trend .recharts-cartesian-axis-tick-value { fill: var(--viz-axis); }
        .viz-trend .recharts-legend-item-text { color: var(--viz-axis) !important; }
        .viz-trend .viz-bar-income { fill: var(--viz-income); }
        .viz-trend .viz-bar-expense { fill: var(--viz-expense); }
      `}</style>
      <div role="img" aria-label="월별 수입·지출 막대 차트. 아래 표에 같은 수치가 있습니다.">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tickLine={false}
              axisLine={{ stroke: "var(--viz-grid)" }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              width={48}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={formatCompactKRW}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="income"
              name="수입"
              fill="var(--viz-income)"
              className="viz-bar-income"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expense"
              name="지출"
              fill="var(--viz-expense)"
              className="viz-bar-expense"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>월별 수입·지출</caption>
        <thead>
          <tr>
            <th scope="col">월</th>
            <th scope="col">수입</th>
            <th scope="col">지출</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{fullMonthLabel(d.month)}</th>
              <td>{formatKRW(d.income)}원</td>
              <td>{formatKRW(d.expense)}원</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
