import { describe, expect, it } from "vitest";
import {
  pickMerchantSuggestions,
  pickRecentPresets,
  type MerchantGroup,
  type TransactionPreset,
} from "@/lib/transaction-presets";

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

function group(over: Partial<MerchantGroup> = {}): MerchantGroup {
  return {
    type: "EXPENSE",
    merchant: "GS25",
    categoryId: "c1",
    paymentMethod: null,
    count: 1,
    lastOn: "2026-10-01",
    ...over,
  };
}

describe("pickMerchantSuggestions", () => {
  it("빈 입력이면 두 유형 모두 빈 배열이다", () => {
    expect(pickMerchantSuggestions([])).toEqual({ INCOME: [], EXPENSE: [] });
  });

  it("카테고리는 건수가 가장 많은 것을 고른다", () => {
    const r = pickMerchantSuggestions([
      group({ categoryId: "c1", count: 1 }),
      group({ categoryId: "c2", count: 3 }),
    ]);
    expect(r.EXPENSE).toEqual([{ merchant: "GS25", categoryId: "c2", paymentMethod: null }]);
  });

  it("카테고리 건수가 같으면 최근 날짜, 날짜도 같으면 id 오름차순이다", () => {
    const byDate = pickMerchantSuggestions([
      group({ categoryId: "c1", lastOn: "2026-10-01" }),
      group({ categoryId: "c2", lastOn: "2026-10-05" }),
    ]);
    expect(byDate.EXPENSE[0].categoryId).toBe("c2");
    const byId = pickMerchantSuggestions([group({ categoryId: "c2" }), group({ categoryId: "c1" })]);
    expect(byId.EXPENSE[0].categoryId).toBe("c1");
  });

  it("결제수단은 null을 제외하고 센다", () => {
    const r = pickMerchantSuggestions([
      group({ paymentMethod: null, count: 10 }),
      group({ paymentMethod: "CASH", count: 1 }),
    ]);
    expect(r.EXPENSE[0].paymentMethod).toBe("CASH");
  });

  it("결제수단이 전부 null이면 null이다", () => {
    const r = pickMerchantSuggestions([group({ paymentMethod: null })]);
    expect(r.EXPENSE[0].paymentMethod).toBeNull();
  });

  it("결제수단 건수가 같으면 최근 날짜, 날짜도 같으면 PAYMENT_METHODS 순서다", () => {
    const byDate = pickMerchantSuggestions([
      group({ paymentMethod: "CASH", lastOn: "2026-10-01" }),
      group({ paymentMethod: "CREDIT_CARD", lastOn: "2026-10-02" }),
    ]);
    expect(byDate.EXPENSE[0].paymentMethod).toBe("CREDIT_CARD");
    const byOrder = pickMerchantSuggestions([
      group({ paymentMethod: "CREDIT_CARD" }),
      group({ paymentMethod: "CASH" }),
    ]);
    expect(byOrder.EXPENSE[0].paymentMethod).toBe("CASH");
  });

  it("수입과 지출을 분리한다", () => {
    const r = pickMerchantSuggestions([
      group({ type: "EXPENSE", merchant: "A" }),
      group({ type: "INCOME", merchant: "B", categoryId: "c9" }),
    ]);
    expect(r.EXPENSE.map((s) => s.merchant)).toEqual(["A"]);
    expect(r.INCOME.map((s) => s.merchant)).toEqual(["B"]);
  });

  it("거래처는 총 건수 → 최근 날짜 → 이름 순으로 정렬한다", () => {
    const r = pickMerchantSuggestions([
      group({ merchant: "나", count: 1, lastOn: "2026-10-01" }),
      group({ merchant: "가", count: 1, lastOn: "2026-10-01" }),
      group({ merchant: "다", count: 1, lastOn: "2026-10-09" }),
      group({ merchant: "라", categoryId: "c1", count: 2, lastOn: "2026-09-01" }),
      group({ merchant: "라", categoryId: "c2", count: 1, lastOn: "2026-09-01" }),
    ]);
    expect(r.EXPENSE.map((s) => s.merchant)).toEqual(["라", "다", "가", "나"]);
  });

  it("유형당 limit개까지만 반환한다", () => {
    const rows = ["a", "b", "c"].map((m) => group({ merchant: m }));
    expect(pickMerchantSuggestions(rows, 2).EXPENSE.map((s) => s.merchant)).toEqual(["a", "b"]);
  });
});
