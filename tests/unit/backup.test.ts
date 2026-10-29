import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { backupSchema, formatBackupIssues } from "@/lib/validation/backup";

const TS = "2026-10-21T03:04:05.000Z";

function validBackup() {
  return {
    format: "moneybook-backup",
    version: 1,
    exportedAt: TS,
    categories: [
      { id: "c-exp", name: "식비", type: "EXPENSE", sortOrder: 0, archivedAt: null, createdAt: TS },
      { id: "c-inc", name: "급여", type: "INCOME", sortOrder: 0, archivedAt: TS, createdAt: TS },
    ],
    transactions: [
      {
        id: "t1",
        type: "EXPENSE",
        amount: 12_000,
        occurredOn: "2026-10-21",
        categoryId: "c-exp",
        merchant: "가게",
        item: null,
        purpose: null,
        memo: null,
        paymentMethod: "CASH",
        createdAt: TS,
        recurringExpenseId: "r1",
      },
    ],
    recurringExpenses: [
      {
        id: "r1",
        categoryId: "c-exp",
        item: "구독",
        amount: 9_900,
        dayOfMonth: 5,
        merchant: null,
        memo: null,
        paymentMethod: null,
        nextRunOn: "2026-11-05",
        lastRunOn: "2026-10-05",
        createdAt: TS,
      },
    ],
    monthlyBudgets: [{ yearMonth: "2026-10", totalAmount: 500_000 }],
    categoryBudgets: [{ id: "b1", yearMonth: "2026-10", categoryId: "c-exp", amount: 200_000 }],
  };
}

type Backup = ReturnType<typeof validBackup>;

/** 수정 후 스키마가 실패해야 하고, 오류 경로 문자열에 expectedPath가 들어 있어야 한다 */
function expectFail(mutate: (b: Backup) => void, expectedPath: string) {
  const b = validBackup();
  mutate(b);
  const r = backupSchema.safeParse(b);
  expect(r.success).toBe(false);
  if (r.success) return;
  const lines = formatBackupIssues(r.error);
  expect(lines.some((l) => l.startsWith(`${expectedPath}:`)), lines.join("\n")).toBe(true);
}

describe("backupSchema", () => {
  it("정상 백업은 통과한다 (보관 카테고리·고정지출 거래 포함)", () => {
    expect(backupSchema.safeParse(validBackup()).success).toBe(true);
  });

  it("빈 컬렉션(카테고리 0개 포함)도 통과한다", () => {
    const empty = {
      ...validBackup(),
      categories: [],
      transactions: [],
      recurringExpenses: [],
      monthlyBudgets: [],
      categoryBudgets: [],
    };
    expect(backupSchema.safeParse(empty).success).toBe(true);
  });

  it("format이 틀리면 실패", () => expectFail((b) => (b.format = "other"), "format"));
  it("version이 틀리면 실패", () => expectFail((b) => (b.version = 2), "version"));
  it("전체 예산 금액이 null이면 실패", () =>
    expectFail((b) => ((b.monthlyBudgets[0] as { totalAmount: unknown }).totalAmount = null), "monthlyBudgets.0.totalAmount"));
  it("카테고리 예산 금액이 null이면 실패", () =>
    expectFail((b) => ((b.categoryBudgets[0] as { amount: unknown }).amount = null), "categoryBudgets.0.amount"));
  it("거래 금액이 0이면 실패", () => expectFail((b) => (b.transactions[0].amount = 0), "transactions.0.amount"));
  it("잘못된 날짜는 실패", () => {
    expectFail((b) => (b.transactions[0].occurredOn = "2026-02-30"), "transactions.0.occurredOn");
    expectFail((b) => (b.recurringExpenses[0].nextRunOn = "2026-13-01"), "recurringExpenses.0.nextRunOn");
  });
  it("시각 형식이 틀리면 실패", () =>
    expectFail((b) => (b.categories[0].createdAt = "2026-10-21"), "categories.0.createdAt"));

  it("id 중복은 실패", () => {
    expectFail((b) => (b.categories[1].id = "c-exp"), "categories.1.id");
    expectFail((b) => b.transactions.push({ ...b.transactions[0] }), "transactions.1.id");
  });
  it("카테고리 (type, name) 중복은 실패", () =>
    expectFail((b) => (b.categories[1] = { ...b.categories[1], type: "EXPENSE", name: "식비" }), "categories.1.name"));
  it("전체 예산 월 중복은 실패", () =>
    expectFail((b) => b.monthlyBudgets.push({ yearMonth: "2026-10", totalAmount: 1 }), "monthlyBudgets.1.yearMonth"));
  it("카테고리 예산 (월, 카테고리) 중복은 실패", () =>
    expectFail((b) => b.categoryBudgets.push({ ...b.categoryBudgets[0], id: "b2" }), "categoryBudgets.1.categoryId"));

  it("없는 categoryId는 실패", () => {
    expectFail((b) => (b.transactions[0].categoryId = "nope"), "transactions.0.categoryId");
    expectFail((b) => (b.recurringExpenses[0].categoryId = "nope"), "recurringExpenses.0.categoryId");
    expectFail((b) => (b.categoryBudgets[0].categoryId = "nope"), "categoryBudgets.0.categoryId");
  });
  it("거래 유형과 카테고리 유형이 다르면 실패", () =>
    expectFail((b) => (b.transactions[0].type = "INCOME"), "transactions.0.categoryId"));
  it("없는 recurringExpenseId는 실패", () =>
    expectFail((b) => (b.transactions[0].recurringExpenseId = "nope"), "transactions.0.recurringExpenseId"));
  it("고정지출·예산이 수입 카테고리를 참조하면 실패", () => {
    expectFail((b) => (b.recurringExpenses[0].categoryId = "c-inc"), "recurringExpenses.0.categoryId");
    expectFail((b) => (b.categoryBudgets[0].categoryId = "c-inc"), "categoryBudgets.0.categoryId");
  });
});

describe("formatBackupIssues", () => {
  it("max개까지만 돌려준다", () => {
    const b = validBackup();
    b.transactions = Array.from({ length: 30 }, (_, i) => ({ ...b.transactions[0], id: `t${i}`, amount: 0 }));
    const r = backupSchema.safeParse(b);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error).toBeInstanceOf(ZodError);
    expect(formatBackupIssues(r.error)).toHaveLength(20);
    expect(formatBackupIssues(r.error, 5)).toHaveLength(5);
  });
});
