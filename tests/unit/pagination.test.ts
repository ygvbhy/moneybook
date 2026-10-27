import { describe, expect, it } from "vitest";
import { paginate } from "@/lib/pagination";

describe("paginate: page 파라미터 해석", () => {
  it.each([
    ["undefined", undefined],
    ["빈 문자열", ""],
    ["0", "0"],
    ["음수", "-1"],
    ["소수", "1.5"],
    ["문자", "abc"],
    ["앞자리 0", "01"],
    ["안전 정수 초과", "99999999999999999999"],
  ])("잘못된 값(%s)은 1페이지", (_name, raw) => {
    expect(paginate(raw, 1000, 100).page).toBe(1);
  });

  it("배열이면 첫 값을 쓴다", () => {
    expect(paginate(["3", "4"], 1000, 100).page).toBe(3);
  });

  it.each([
    [0, 1],
    [100, 1],
    [101, 2],
  ])("total %i -> pageCount %i", (total, pageCount) => {
    expect(paginate(undefined, total, 100).pageCount).toBe(pageCount);
  });

  it("total 0이면 1페이지, skip 0", () => {
    expect(paginate("5", 0, 100)).toEqual({ page: 1, pageCount: 1, skip: 0 });
  });

  it("total 230, page 3 -> skip 200", () => {
    expect(paginate("3", 230, 100)).toEqual({ page: 3, pageCount: 3, skip: 200 });
  });

  it("마지막 페이지를 넘으면 마지막 페이지로 맞춘다", () => {
    expect(paginate("99", 230, 100).page).toBe(3);
  });
});
