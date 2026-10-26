import { describe, expect, it } from "vitest";
import { budgetOverview, budgetStatus, dailyAllowance, usageRate } from "@/lib/budget";

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

describe("budget: 하루 사용 가능 금액", () => {
  const allowance = (
    month: string,
    today: string,
    budget: number | null,
    spent: number,
    upcomingTotal = 0,
  ) =>
    dailyAllowance({
      month,
      today,
      overview: budgetOverview({ total: budget, categoryBudgets: [], totalSpent: spent }),
      upcomingTotal,
    });

  it.each([
    ["지난달", "2026-09", "2026-10-26"],
    ["다음 달", "2026-11", "2026-10-26"],
  ])("이번 달이 아니면 null (%s)", (_name, month, today) => {
    expect(allowance(month, today, 500_000, 0)).toBeNull();
  });

  it("전체 예산이 없으면 null", () => {
    expect(allowance("2026-10", "2026-10-26", null, 10_000)).toBeNull();
  });

  it("예산을 초과하면 null", () => {
    expect(allowance("2026-10", "2026-10-26", 100_000, 100_001)).toBeNull();
  });

  it.each([
    ["2026-10-26 -> 6일", "2026-10", "2026-10-26", 6],
    ["말일 당일 -> 1일", "2026-10", "2026-10-31", 1],
    ["1일 -> 말일 수", "2026-10", "2026-10-01", 31],
    ["평년 2월 1일 -> 28일", "2026-02", "2026-02-01", 28],
    ["윤년 2월 1일 -> 29일", "2028-02", "2028-02-01", 29],
  ])("남은 일수(오늘 포함): %s", (_name, month, today, daysLeft) => {
    expect(allowance(month, today, 500_000, 0)?.daysLeft).toBe(daysLeft);
  });

  it("남은 예산에서 예정 고정지출을 빼고 내림한다", () => {
    expect(allowance("2026-10", "2026-10-26", 100_000, 0, 30_000)).toEqual({
      daysLeft: 6,
      upcomingTotal: 30_000,
      available: 70_000,
      perDay: 11_666,
    });
  });

  it.each([
    ["예정액이 남은 예산과 같음", 100_000, 0, 100_000, 0],
    ["예정액이 남은 예산보다 큼", 100_000, 0, 130_000, -30_000],
    ["예산을 정확히 다 씀", 100_000, 100_000, 0, 0],
  ])("available이 0 이하면 perDay 0 (%s)", (_name, budget, spent, upcoming, available) => {
    const a = allowance("2026-10", "2026-10-26", budget, spent, upcoming);
    expect(a?.available).toBe(available);
    expect(a?.perDay).toBe(0);
  });
});
