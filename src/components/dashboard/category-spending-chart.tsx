"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactKRW, formatKRW } from "@/lib/money";

export type CategorySpendingDatum = {
  categoryId: string;
  name: string;
  total: number;
  /** 카테고리 예산 사용률(%), 예산이 없으면 null */
  rate: number | null;
  over: boolean;
};

const ROW_HEIGHT = 40;

function label(d: CategorySpendingDatum) {
  return d.rate === null ? `${formatKRW(d.total)}원` : `${formatKRW(d.total)}원 · ${d.rate.toFixed(1)}%`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CategorySpendingDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{d.name}</p>
      <p className="tabular-nums">지출 {formatKRW(d.total)}원</p>
      <p className="text-muted-foreground tabular-nums">
        {d.rate === null ? "예산 없음" : `예산 사용률 ${d.rate.toFixed(1)}%${d.over ? " (초과)" : ""}`}
      </p>
    </div>
  );
}

export function CategorySpendingChart({ data }: { data: CategorySpendingDatum[] }) {
  return (
    <div className="viz-root">
      <style>{`
        .viz-root {
          --viz-series-1: #2a78d6;
          --viz-axis: #52514e;
          --viz-grid: #e4e3df;
        }
        .dark .viz-root {
          --viz-series-1: #3987e5;
          --viz-axis: #c3c2b7;
          --viz-grid: #3a3a38;
        }
        .viz-root .recharts-cartesian-axis-tick-value { fill: var(--viz-axis); }
        .viz-root .viz-bar { fill: var(--viz-series-1); }
        .viz-root .viz-label { fill: var(--viz-axis); font-variant-numeric: tabular-nums; }
      `}</style>
      <div role="img" aria-label="카테고리별 지출 막대 차트. 아래 표에 같은 수치가 있습니다.">
        <ResponsiveContainer width="100%" height={data.length * ROW_HEIGHT + 8}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 128, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <XAxis type="number" hide domain={[0, "dataMax"]} tickFormatter={formatCompactKRW} />
            <YAxis
              type="category"
              dataKey="name"
              width={88}
              tickLine={false}
              axisLine={{ stroke: "var(--viz-grid)" }}
              tick={{ fontSize: 12 }}
              interval={0}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.categoryId} className="viz-bar" />
              ))}
              <LabelList
                dataKey="total"
                position="right"
                className="viz-label"
                fontSize={12}
                content={(props) => {
                  const { x, y, width, height, index } = props as {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    index: number;
                  };
                  const d = data[index];
                  if (!d) return null;
                  return (
                    <text
                      x={Number(x) + Number(width) + 6}
                      y={Number(y) + Number(height) / 2}
                      dominantBaseline="central"
                      fontSize={12}
                      className="viz-label"
                    >
                      {label(d)}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>카테고리별 지출</caption>
        <thead>
          <tr>
            <th scope="col">카테고리</th>
            <th scope="col">지출</th>
            <th scope="col">예산 사용률</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.categoryId}>
              <th scope="row">{d.name}</th>
              <td>{formatKRW(d.total)}원</td>
              <td>{d.rate === null ? "예산 없음" : `${d.rate.toFixed(1)}%${d.over ? " 초과" : ""}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
