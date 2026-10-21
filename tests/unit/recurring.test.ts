import { describe, expect, it } from "vitest";
import { dueDates, occurrenceIn, occurrenceOnOrAfter, upcomingIn } from "@/lib/recurring";

describe("recurring: occurrenceIn", () => {
  it.each([
    ["2026-02", 31, "2026-02-28"],
    ["2028-02", 31, "2028-02-29"],
    ["2026-04", 31, "2026-04-30"],
    ["2026-10", 5, "2026-10-05"],
  ])("(%s, %i) -> %s", (ym, day, expected) => {
    expect(occurrenceIn(ym, day)).toBe(expected);
  });
});

describe("recurring: occurrenceOnOrAfter", () => {
  it.each([
    [5, "2026-10-21", "2026-11-05"],
    [21, "2026-10-21", "2026-10-21"],
    [25, "2026-10-21", "2026-10-25"],
    [5, "2026-12-21", "2027-01-05"],
    [31, "2026-09-30", "2026-09-30"],
    [31, "2027-02-28", "2027-02-28"],
  ])("(%i, %s) -> %s", (day, date, expected) => {
    expect(occurrenceOnOrAfter(day, date)).toBe(expected);
  });

  describe("일자 변경 규칙: occurrenceOnOrAfter(day, max(today, lastRunOn 다음 달 1일))", () => {
    it("커서 11-25, today 10-21, 28일로 변경 -> 11-28", () => {
      expect(occurrenceOnOrAfter(28, "2026-11-01")).toBe("2026-11-28");
    });
    it("커서 10-25, today 10-21, 10일로 변경 -> 11-10", () => {
      expect(occurrenceOnOrAfter(10, "2026-10-21")).toBe("2026-11-10");
    });
    it("28일로 변경, today 10-21 -> 10-28", () => {
      expect(occurrenceOnOrAfter(28, "2026-10-21")).toBe("2026-10-28");
    });
    it("오늘과 같은 21일로 변경 -> 10-21", () => {
      expect(occurrenceOnOrAfter(21, "2026-10-21")).toBe("2026-10-21");
    });
  });
});

describe("recurring: dueDates", () => {
  it("밀린 2건과 다음 발생일 (31일 -> 9월 30일 -> 10월 31일)", () => {
    expect(dueDates("2026-08-31", 31, "2026-10-21")).toEqual({
      dates: ["2026-08-31", "2026-09-30"],
      next: "2026-10-31",
    });
  });
  it("아직 도래하지 않았으면 빈 목록", () => {
    expect(dueDates("2026-10-25", 25, "2026-10-21")).toEqual({
      dates: [],
      next: "2026-10-25",
    });
  });
  it("연도를 넘겨 몰아서 생성 (2월 말일 보정, 3월 31일로 복귀)", () => {
    expect(dueDates("2026-12-31", 31, "2027-03-01")).toEqual({
      dates: ["2026-12-31", "2027-01-31", "2027-02-28"],
      next: "2027-03-31",
    });
  });
});

describe("recurring: upcomingIn", () => {
  const make = (id: string, dayOfMonth: number, nextRunOn: string) => ({
    id,
    item: `item-${id}`,
    categoryName: "주거",
    amount: 1000,
    dayOfMonth,
    nextRunOn,
  });
  const dates = (month: string, items: ReturnType<typeof make>[]) =>
    upcomingIn(month, items).map((u) => u.date);

  it("같은 달, 발생일 >= nextRunOn이면 포함", () => {
    expect(dates("2026-10", [make("a", 25, "2026-10-25")])).toEqual(["2026-10-25"]);
  });
  it("이미 등록된 달은 제외", () => {
    expect(dates("2026-10", [make("a", 21, "2026-11-21")])).toEqual([]);
  });
  it("다음 달은 포함", () => {
    expect(dates("2026-11", [make("a", 21, "2026-11-21")])).toEqual(["2026-11-21"]);
  });
  it("이전 달은 제외", () => {
    expect(dates("2026-09", [make("a", 21, "2026-10-25")])).toEqual([]);
  });
  it("말일 보정 (31일 -> 2월 28일)", () => {
    expect(dates("2027-02", [make("a", 31, "2026-11-30")])).toEqual(["2027-02-28"]);
  });
  it("여러 항목은 날짜 오름차순, 같은 날짜는 모두 포함", () => {
    const result = upcomingIn("2026-11", [
      make("a", 25, "2026-10-25"),
      make("b", 5, "2026-10-05"),
      make("c", 25, "2026-10-25"),
    ]);
    expect(result.map((u) => [u.date, u.recurringId])).toEqual([
      ["2026-11-05", "b"],
      ["2026-11-25", "a"],
      ["2026-11-25", "c"],
    ]);
  });
});
