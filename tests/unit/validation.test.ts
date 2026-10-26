import { describe, expect, it } from "vitest";
import { transactionSchema } from "@/lib/validation/transaction";
import { categoryBudgetSchema, totalBudgetSchema } from "@/lib/validation/budget";
import { categorySchema } from "@/lib/validation/category";
import { adminPasswordError, loginSchema } from "@/lib/validation/auth";

const valid = {
  type: "EXPENSE",
  amount: 12500,
  occurredOn: "2026-10-21",
  categoryId: "c1",
};

describe("zod: 거래 스키마", () => {
  it("최소 필수값으로 통과, 선택값은 null", () => {
    const r = transactionSchema.parse(valid);
    expect(r).toMatchObject({ merchant: null, item: null, purpose: null, memo: null, paymentMethod: null });
  });
  it("필수 누락", () => {
    for (const key of ["type", "amount", "occurredOn", "categoryId"]) {
      const { [key]: _omit, ...rest } = valid as Record<string, unknown>;
      void _omit;
      expect(transactionSchema.safeParse(rest).success, key).toBe(false);
    }
  });
  it("금액 범위: 0, 음수, 소수, 10억 초과 거부 / 10억 허용", () => {
    for (const amount of [0, -1, 1.5, 1_000_000_001]) {
      expect(transactionSchema.safeParse({ ...valid, amount }).success, String(amount)).toBe(false);
    }
    expect(transactionSchema.safeParse({ ...valid, amount: 1_000_000_000 }).success).toBe(true);
    expect(transactionSchema.safeParse({ ...valid, amount: 1 }).success).toBe(true);
  });
  it("유형 enum", () => {
    expect(transactionSchema.safeParse({ ...valid, type: "TRANSFER" }).success).toBe(false);
  });
  it("결제 수단 enum: 허용값 / 잘못된 값 / 빈 값은 null", () => {
    for (const p of ["CASH", "BANK_TRANSFER", "CREDIT_CARD", "DEBIT_CARD", "OTHER"]) {
      expect(transactionSchema.safeParse({ ...valid, paymentMethod: p }).success, p).toBe(true);
    }
    expect(transactionSchema.safeParse({ ...valid, paymentMethod: "BITCOIN" }).success).toBe(false);
    expect(transactionSchema.parse({ ...valid, paymentMethod: "" }).paymentMethod).toBeNull();
  });
  it("날짜 형식/존재 여부", () => {
    for (const d of ["2026-02-30", "2026-1-1", "20261021", ""]) {
      expect(transactionSchema.safeParse({ ...valid, occurredOn: d }).success, d).toBe(false);
    }
  });
  it("문자열 길이: 100/100/200/1000 경계", () => {
    const ok = (k: string, n: number) =>
      transactionSchema.safeParse({ ...valid, [k]: "a".repeat(n) }).success;
    expect(ok("merchant", 100)).toBe(true);
    expect(ok("merchant", 101)).toBe(false);
    expect(ok("item", 100)).toBe(true);
    expect(ok("item", 101)).toBe(false);
    expect(ok("purpose", 200)).toBe(true);
    expect(ok("purpose", 201)).toBe(false);
    expect(ok("memo", 1000)).toBe(true);
    expect(ok("memo", 1001)).toBe(false);
  });
  it("공백 -> null, 앞뒤 공백 제거", () => {
    const r = transactionSchema.parse({ ...valid, merchant: "   ", memo: "  메모  ", item: "" });
    expect(r.merchant).toBeNull();
    expect(r.item).toBeNull();
    expect(r.memo).toBe("메모");
  });
  it("공백 포함 길이는 trim 후 기준", () => {
    expect(transactionSchema.safeParse({ ...valid, merchant: " " + "a".repeat(100) + " " }).success).toBe(true);
  });
  it("한국어 오류 메시지", () => {
    const r = transactionSchema.safeParse({ ...valid, amount: 0 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("금액은 1원 이상이어야 합니다");
  });
});

describe("zod: 예산 범위", () => {
  it("1..10억 허용, 빈 값은 null(미설정)", () => {
    expect(totalBudgetSchema.parse({ yearMonth: "2026-10", amount: 1 }).amount).toBe(1);
    expect(totalBudgetSchema.parse({ yearMonth: "2026-10", amount: 1_000_000_000 }).amount).toBe(1_000_000_000);
    expect(totalBudgetSchema.parse({ yearMonth: "2026-10", amount: null }).amount).toBeNull();
    expect(totalBudgetSchema.parse({ yearMonth: "2026-10", amount: "" }).amount).toBeNull();
    expect(totalBudgetSchema.parse({ yearMonth: "2026-10" }).amount).toBeNull();
  });
  it("0, 음수, 소수, 10억 초과 거부", () => {
    for (const amount of [0, -5, 1.2, 1_000_000_001]) {
      expect(totalBudgetSchema.safeParse({ yearMonth: "2026-10", amount }).success, String(amount)).toBe(false);
    }
  });
  it("잘못된 월 형식 거부", () => {
    expect(totalBudgetSchema.safeParse({ yearMonth: "2026-13", amount: 1 }).success).toBe(false);
  });
  it("카테고리 예산은 categoryId 필수", () => {
    expect(categoryBudgetSchema.safeParse({ yearMonth: "2026-10", amount: 100 }).success).toBe(false);
    expect(categoryBudgetSchema.safeParse({ yearMonth: "2026-10", categoryId: "c", amount: 100 }).success).toBe(true);
  });
});

describe("zod: 카테고리/인증", () => {
  it("이름 trim 1..30", () => {
    expect(categorySchema.parse({ name: "  식비 ", type: "EXPENSE" }).name).toBe("식비");
    expect(categorySchema.safeParse({ name: "   ", type: "EXPENSE" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "a".repeat(30), type: "EXPENSE" }).success).toBe(true);
    expect(categorySchema.safeParse({ name: "a".repeat(31), type: "EXPENSE" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "x", type: "BAD" }).success).toBe(false);
  });
  it("로그인: 빈 값 거부", () => {
    expect(loginSchema.safeParse({ username: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ username: "a", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ username: "a", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ username: "a", password: "x".repeat(201) }).success).toBe(false);
  });
});

describe("adminPasswordError", () => {
  it("11자는 오류", () => {
    expect(adminPasswordError("a".repeat(11))).toContain("12자 이상");
  });
  it("12자는 통과", () => {
    expect(adminPasswordError("a".repeat(12))).toBeNull();
  });
  it("한글 24자(72바이트)는 통과", () => {
    expect(adminPasswordError("가".repeat(24))).toBeNull();
  });
  it("한글 25자(75바이트)는 오류", () => {
    expect(adminPasswordError("가".repeat(25))).toContain("72바이트");
  });
  it("빈 문자열은 오류", () => {
    expect(adminPasswordError("")).not.toBeNull();
  });
});
