import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  fromDbDate,
  isValidDateString,
  monthOf,
  monthRange,
  normalizeMonthParam,
  parseYearMonth,
  shiftMonth,
  toDbDate,
  todayInSeoul,
} from "@/lib/date";

describe("date: 서울 기준 오늘", () => {
  it("2026-10-21T15:30Z -> 2026-10-22", () => {
    expect(todayInSeoul(new Date("2026-10-21T15:30:00Z"))).toBe("2026-10-22");
  });
  it("2026-10-21T14:59Z -> 2026-10-21", () => {
    expect(todayInSeoul(new Date("2026-10-21T14:59:00Z"))).toBe("2026-10-21");
  });
});

describe("date: 월 범위와 월 이동", () => {
  it("12월 -> 1월", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("1월 -> 12월", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("여러 달 이동", () => {
    expect(shiftMonth("2026-10", 14)).toBe("2027-12");
  });
  it("monthRange는 반열린 구간", () => {
    expect(monthRange("2026-10")).toEqual({ start: "2026-10-01", endExclusive: "2026-11-01" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", endExclusive: "2027-01-01" });
  });
  it("monthOf", () => {
    expect(monthOf("2026-10-31")).toBe("2026-10");
  });
});

describe("date: 6주 그리드 (2026-02, 월요일 시작)", () => {
  const grid = buildMonthGrid("2026-02");
  it("42칸", () => expect(grid).toHaveLength(42));
  it("첫 칸은 2026-01-26 (월요일), 월 밖", () => {
    expect(grid[0]).toEqual({ date: "2026-01-26", inMonth: false });
  });
  it("2026-02-01(일)은 7번째 칸", () => {
    expect(grid[6]).toEqual({ date: "2026-02-01", inMonth: true });
  });
  it("월 안 칸은 28개, 마지막 칸은 2026-03-08", () => {
    expect(grid.filter((c) => c.inMonth)).toHaveLength(28);
    expect(grid[41].date).toBe("2026-03-08");
  });
});

describe("date: DB 변환 왕복", () => {
  it("toDbDate는 UTC 자정, fromDbDate로 되돌아온다", () => {
    const d = toDbDate("2026-10-21");
    expect(d.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(fromDbDate(d)).toBe("2026-10-21");
    expect(fromDbDate(toDbDate("2026-02-28"))).toBe("2026-02-28");
  });
  it("잘못된 날짜는 던진다", () => {
    expect(() => toDbDate("2026-02-30")).toThrow();
  });
});

describe("date: 잘못된 month 파라미터는 fallback", () => {
  const today = "2026-10-21";
  it.each([undefined, null, "", "2026", "2026-13", "2026-00", "abc", "2026-1", "2026-10-01"])(
    "%s -> 현재 서울 월",
    (v) => {
      expect(normalizeMonthParam(v as string | null | undefined, today)).toBe("2026-10");
    },
  );
  it("유효하면 그대로", () => {
    expect(normalizeMonthParam("2025-03", today)).toBe("2025-03");
  });
  it("parseYearMonth / isValidDateString", () => {
    expect(parseYearMonth("2026-02")).toEqual({ year: 2026, month: 2 });
    expect(parseYearMonth("2026-14")).toBeNull();
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(isValidDateString("2026-1-1")).toBe(false);
  });
});
