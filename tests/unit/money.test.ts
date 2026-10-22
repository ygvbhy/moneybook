import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT,
  formatCompactKRW,
  formatKRW,
  formatKRWDelta,
  parseAmountInput,
} from "@/lib/money";

describe("money", () => {
  it('"1,234" -> 1234', () => {
    expect(parseAmountInput("1,234")).toBe(1234);
    expect(parseAmountInput("1234")).toBe(1234);
    expect(parseAmountInput(" 12,500 ")).toBe(12500);
  });
  it("빈 값, 음수, 소수, 문자는 거부한다", () => {
    for (const v of ["", "  ", "-1", "1.5", "abc", "12a", "1,23", "1e3"]) {
      expect(parseAmountInput(v), v).toBeNull();
    }
  });
  it("0은 파싱되지만 범위 검증은 스키마가 거부한다 (파서는 정수만 판별)", () => {
    expect(parseAmountInput("0")).toBe(0);
  });
  it("10억 초과는 값이 그대로 파싱되고 상한은 MAX_AMOUNT로 구분된다", () => {
    expect(parseAmountInput("1,000,000,001")! > MAX_AMOUNT).toBe(true);
  });
  it('포맷 결과 "12,500"', () => {
    expect(formatKRW(12500)).toBe("12,500");
    expect(formatKRW(0)).toBe("0");
  });
  it('축약 표기 "1.2만"', () => {
    expect(formatCompactKRW(12000)).toBe("1.2만");
    expect(formatCompactKRW(500)).toBe("500");
    expect(formatCompactKRW(1250000)).toBe("125만");
  });
  it("증감 표기: 증가 ▲, 감소 ▼, 0은 변동 없음", () => {
    expect(formatKRWDelta(12000)).toBe("▲12,000원");
    expect(formatKRWDelta(-12000)).toBe("▼12,000원");
    expect(formatKRWDelta(0)).toBe("변동 없음");
  });
});
