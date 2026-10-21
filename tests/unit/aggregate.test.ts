import { describe, expect, it } from "vitest";
import { categoryTotals, dailyTotals, summarize, type AggregateRow } from "@/lib/aggregate";

const rows: AggregateRow[] = [
  { type: "EXPENSE", amount: 9000, occurredOn: "2026-10-31", categoryId: "food" },
  { type: "EXPENSE", amount: 1000, occurredOn: "2026-10-31", categoryId: "food" },
  { type: "INCOME", amount: 50000, occurredOn: "2026-10-31", categoryId: "salary" },
  { type: "EXPENSE", amount: 30000, occurredOn: "2026-11-01", categoryId: "rent" },
];

describe("aggregate", () => {
  it("월 요약: 수입/지출/순수입", () => {
    expect(summarize(rows)).toEqual({ income: 50000, expense: 40000, net: 10000 });
    expect(summarize([])).toEqual({ income: 0, expense: 0, net: 0 });
  });
  it("일별 수입/지출 분리 합계", () => {
    const d = dailyTotals(rows);
    expect(d["2026-10-31"]).toEqual({ income: 50000, expense: 10000, count: 3 });
    expect(d["2026-11-01"]).toEqual({ income: 0, expense: 30000, count: 1 });
  });
  it("카테고리 합계는 금액 내림차순", () => {
    expect(categoryTotals(rows, "EXPENSE")).toEqual([
      { categoryId: "rent", total: 30000 },
      { categoryId: "food", total: 10000 },
    ]);
    expect(categoryTotals(rows, "INCOME")).toEqual([{ categoryId: "salary", total: 50000 }]);
  });
});
