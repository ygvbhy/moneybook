import { describe, expect, it } from "vitest";
import { pickRecentPresets, type TransactionPreset } from "@/lib/transaction-presets";

function preset(over: Partial<TransactionPreset> = {}): TransactionPreset {
  return {
    type: "EXPENSE",
    amount: 5_000,
    categoryId: "c1",
    categoryName: "식비",
    merchant: null,
    item: null,
    paymentMethod: null,
    ...over,
  };
}

describe("pickRecentPresets", () => {
  it("빈 입력이면 두 유형 모두 빈 배열이다", () => {
    expect(pickRecentPresets([])).toEqual({ INCOME: [], EXPENSE: [] });
  });

  it("같은 내용은 첫 번째(가장 최근)만 남긴다", () => {
    const first = preset({ merchant: "스타벅스" });
    const result = pickRecentPresets([first, preset({ merchant: "스타벅스" })]);
    expect(result.EXPENSE).toHaveLength(1);
    expect(result.EXPENSE[0]).toBe(first);
  });

  it("금액만 달라도 별개이고 입력 순서를 유지한다", () => {
    const result = pickRecentPresets([preset({ amount: 1_000 }), preset({ amount: 2_000 })]);
    expect(result.EXPENSE.map((p) => p.amount)).toEqual([1_000, 2_000]);
  });

  it("유형별로 나뉜다", () => {
    const result = pickRecentPresets([
      preset({ type: "INCOME", categoryId: "c2" }),
      preset({ type: "EXPENSE" }),
    ]);
    expect(result.INCOME).toHaveLength(1);
    expect(result.EXPENSE).toHaveLength(1);
  });

  it("유형당 5개까지만 고른다", () => {
    const rows = Array.from({ length: 8 }, (_, i) => preset({ amount: 1_000 + i }));
    const result = pickRecentPresets(rows);
    expect(result.EXPENSE.map((p) => p.amount)).toEqual([1_000, 1_001, 1_002, 1_003, 1_004]);
    expect(pickRecentPresets(rows, 2).EXPENSE).toHaveLength(2);
  });
});
