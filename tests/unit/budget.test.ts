import { describe, expect, it } from "vitest";
import { budgetOverview, budgetStatus, usageRate } from "@/lib/budget";

describe("budget: 사용률", () => {
  it("예산 null -> null", () => expect(usageRate(5000, null)).toBeNull());
  it("예산 0 -> null", () => expect(usageRate(5000, 0)).toBeNull());
  it("소수 1자리 반올림", () => {
    expect(usageRate(1, 3)).toBe(33.3);
    expect(usageRate(2, 3)).toBe(66.7);
  });
  it("예산 없음 상태도 안전", () => {
    const s = budgetStatus(5000, null);
    expect(s).toMatchObject({ rate: null, over: false, overAmount: 0, remaining: null });
  });
});

describe("budget: 초과 판정", () => {
  it("예산 100,000에 지출 100,000 -> 100%, 초과 아님", () => {
    expect(budgetStatus(100_000, 100_000)).toEqual({
      budget: 100_000,
      spent: 100_000,
      remaining: 0,
      rate: 100,
      over: false,
      overAmount: 0,
    });
  });
  it("지출 100,001 -> 초과, 초과액 1", () => {
    const s = budgetStatus(100_001, 100_000);
    expect(s.over).toBe(true);
    expect(s.overAmount).toBe(1);
    expect(s.remaining).toBe(-1);
  });
});

describe("budget: 미배정 계산", () => {
  it("미배정 = 전체 - 카테고리 합계", () => {
    const o = budgetOverview({
      total: 500_000,
      categoryBudgets: [
        { categoryId: "a", amount: 200_000 },
        { categoryId: "b", amount: 100_000 },
      ],
      totalSpent: 120_000,
    });
    expect(o.allocated).toBe(300_000);
    expect(o.unallocated).toBe(200_000);
    expect(o.allocationWarning).toBe(false);
    expect(o.rate).toBe(24);
  });
  it("카테고리 합계가 전체보다 크면 경고", () => {
    const o = budgetOverview({
      total: 100_000,
      categoryBudgets: [{ categoryId: "a", amount: 150_000 }],
      totalSpent: 0,
    });
    expect(o.unallocated).toBe(-50_000);
    expect(o.allocationWarning).toBe(true);
  });
  it("전체 없이 카테고리만 있는 경우: unallocated null, 경고 없음", () => {
    const o = budgetOverview({
      total: null,
      categoryBudgets: [{ categoryId: "a", amount: 150_000 }],
      totalSpent: 30_000,
    });
    expect(o.allocated).toBe(150_000);
    expect(o.unallocated).toBeNull();
    expect(o.allocationWarning).toBe(false);
    expect(o.rate).toBeNull();
  });
});
