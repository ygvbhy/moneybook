"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Text, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactKRW, formatKRW, formatKRWDelta } from "@/lib/money";

export type CategorySpendingDatum = {
  categoryId: string;
  name: string;
  total: number;
  /** 카테고리 예산 사용률(%), 예산이 없으면 null */
  rate: number | null;
  over: boolean;
  /** 전월 대비 지출 증감, 비교할 전월이 없으면 null */
  delta: number | null;
};

const ROW_HEIGHT = 48;

function href(month: string, d: CategorySpendingDatum) {
  return `/transactions?${new URLSearchParams({ month, type: "EXPENSE", category: d.categoryId })}`;
}

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
      <p className="tabular-nums">지출 <span className="text-expense">{formatKRW(d.total)}원</span></p>
      <p className="text-muted-foreground tabular-nums">
        {d.rate === null ? "예산 없음" : `예산 사용률 ${d.rate.toFixed(1)}%${d.over ? " (초과)" : ""}`}
      </p>
      {d.delta !== null && (
        <p className="text-muted-foreground tabular-nums">전월 대비 {formatKRWDelta(d.delta)}</p>
      )}
    </div>
  );
}

export function CategorySpendingChart({
  month,
  data,
}: {
  month: string;
  data: CategorySpendingDatum[];
}) {
  const router = useRouter();
  return (
    <div className="viz-root">
      <style>{`
        .viz-root {
          --viz-series-1: var(--expense);
          --viz-axis: #52514e;
          --viz-grid: #e4e3df;
        }
        .dark .viz-root {
          --viz-axis: #c3c2b7;
          --viz-grid: #3a3a38;
        }
        .viz-root .recharts-cartesian-axis-tick-value { fill: var(--viz-axis); }
        .viz-root .viz-bar { fill: var(--viz-series-1); cursor: pointer; }
        .viz-root a:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
        .viz-root .viz-label { fill: var(--viz-axis); font-variant-numeric: tabular-nums; }
      `}</style>
      <div role="figure" aria-label="카테고리별 지출 막대 차트. 아래 표에 같은 수치가 있습니다.">
        <ResponsiveContainer width="100%" height={data.length * ROW_HEIGHT + 8}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 152, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <XAxis type="number" hide domain={[0, "dataMax"]} tickFormatter={formatCompactKRW} />
            <YAxis
              type="category"
              dataKey="name"
              width={88}
              tickLine={false}
              axisLine={{ stroke: "var(--viz-grid)" }}
              tick={(props) => {
                const { payload } = props;
                const d = data[payload.index] ?? data.find((item) => item.name === payload.value);
                // 기본 tick과 같은 렌더(줄바꿈·위치 포함)를 위해 recharts Text에 props를 그대로 넘긴다
                const text = (
                  <Text {...props} fontSize={12}>
                    {payload.value}
                  </Text>
                );
                if (!d) return text;
                const link = href(month, d);
                return (
                  <a
                    href={link}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(link);
                    }}
                  >
                    {text}
                  </a>
                );
              }}
              interval={0}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }} />
            <Bar
              dataKey="total"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              isAnimationActive={false}
              onClick={(_, index) => {
                const d = data[index];
                if (d) router.push(href(month, d));
              }}
            >
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
                      <tspan x={Number(x) + Number(width) + 6} dy={d.delta === null ? 0 : "-0.6em"}>
                        {label(d)}
                      </tspan>
                      {d.delta !== null && (
                        <tspan x={Number(x) + Number(width) + 6} dy="1.4em" fontSize={11}>
                          전월 대비 {formatKRWDelta(d.delta)}
                        </tspan>
                      )}
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
            <th scope="col">전월 대비</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.categoryId}>
              <th scope="row">{d.name}</th>
              <td>{formatKRW(d.total)}원</td>
              <td>{d.rate === null ? "예산 없음" : `${d.rate.toFixed(1)}%${d.over ? " 초과" : ""}`}</td>
              <td>{d.delta === null ? "비교 불가" : formatKRWDelta(d.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
