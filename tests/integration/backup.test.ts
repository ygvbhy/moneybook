import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { backupSchema } from "@/lib/validation/backup";
import { exportBackup, restoreBackup } from "@/server/actions/backup";
import { createTransaction } from "@/server/actions/transactions";
import { createRecurring } from "@/server/actions/recurring";
import { setCategoryBudget, setTotalBudget } from "@/server/actions/budgets";
import { archiveCategory, createCategory } from "@/server/actions/categories";
import { materializeRecurring } from "@/server/recurring";
import { categoryId, loginAsTest, resetDb, txInput } from "../setup/db";

let food: string;

beforeEach(async () => {
  await resetDb();
  await loginAsTest();
  food = await categoryId("식비");
});

async function exportOk() {
  const r = await exportBackup();
  if (!r.ok) throw new Error(`export failed: ${r.error}`);
  return { ...r.data!, backup: JSON.parse(r.data!.json) as Record<string, unknown> };
}

/** 7개 테이블 전체 내용 */
async function snapshot() {
  return {
    transactions: await db.transaction.findMany({ orderBy: { id: "asc" } }),
    categories: await db.category.findMany({ orderBy: { id: "asc" } }),
    recurring: await db.recurringExpense.findMany({ orderBy: { id: "asc" } }),
    monthly: await db.monthlyBudget.findMany({ orderBy: { yearMonth: "asc" } }),
    categoryBudgets: await db.categoryBudget.findMany({ orderBy: { id: "asc" } }),
    sessions: await db.session.findMany({ orderBy: { id: "asc" } }),
    attempts: await db.loginAttempt.findMany({ orderBy: { id: "asc" } }),
  };
}

/** 보관 카테고리, 고정지출 거래, 전체·카테고리 예산이 모두 있는 상태를 만든다 */
async function seedRichData() {
  const hobby = await categoryId("게임/취미");
  await archiveCategory(hobby);
  await createTransaction(txInput({ categoryId: food, merchant: "마트", memo: "메모", paymentMethod: "CASH" }));
  const rec = await createRecurring({
    categoryId: food,
    item: "정기결제",
    amount: 9_900,
    dayOfMonth: 5,
    merchant: null,
    memo: null,
    paymentMethod: null,
  });
  if (!rec.ok) throw new Error(rec.error);
  await materializeRecurring("2027-01-31"); // recurringExpenseId가 있는 거래 생성
  await setTotalBudget({ yearMonth: "2026-10", amount: 500_000 });
  await setCategoryBudget({ yearMonth: "2026-10", categoryId: food, amount: 200_000 });
}

describe("백업 내보내기·복원", () => {
  it("(a) 왕복: 내보낸 결과가 스키마를 통과하고, 변경 후 복원하면 처음 내보낸 내용과 같다", async () => {
    await seedRichData();
    const first = await exportOk();
    expect(backupSchema.safeParse(first.backup).success).toBe(true);
    const linked = await db.transaction.count({ where: { recurringExpenseId: { not: null } } });
    expect(linked).toBeGreaterThan(0);
    expect(first.counts.transactions).toBeGreaterThan(linked);
    expect(first.filename).toMatch(/^moneybook-backup-\d{4}-\d{2}-\d{2}\.json$/);

    // 변경: 거래 추가·삭제, 카테고리 추가
    await createTransaction(txInput({ categoryId: food, amount: 777 }));
    await db.transaction.deleteMany({ where: { recurringExpenseId: { not: null } } });
    await createCategory({ name: "새 카테고리", type: "EXPENSE" });

    const r = await restoreBackup(first.backup);
    expect(r.ok).toBe(true);
    expect(r.ok && r.data?.counts).toEqual(first.counts);

    const second = await exportOk();
    expect({ ...second.backup, exportedAt: null }).toEqual({ ...first.backup, exportedAt: null });
  });

  it("(b) 복원 후 세션 행이 그대로이고 로그인 상태로 다른 action을 호출할 수 있다", async () => {
    const first = await exportOk();
    const sessionsBefore = await db.session.findMany({ orderBy: { id: "asc" } });
    await db.loginAttempt.create({ data: { ipHash: "h", success: false } });
    const attemptsBefore = await db.loginAttempt.findMany();
    expect((await restoreBackup(first.backup)).ok).toBe(true);
    expect(await db.session.findMany({ orderBy: { id: "asc" } })).toEqual(sessionsBefore);
    expect(await db.loginAttempt.findMany()).toEqual(attemptsBefore);
    const again = await exportBackup();
    expect(again.ok).toBe(true);
  });

  it("(c) 스키마 오류(없는 categoryId)면 ok:false, fieldErrors.rows가 있고 데이터는 그대로다", async () => {
    await seedRichData();
    const first = await exportOk();
    const bad = structuredClone(first.backup) as { transactions: { categoryId: string }[] };
    bad.transactions[0].categoryId = "nope";
    const before = await snapshot();
    const r = await restoreBackup(bad);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("백업 파일 내용이 올바르지 않습니다");
    expect(r.fieldErrors?.rows?.length).toBeGreaterThan(0);
    expect(r.fieldErrors!.rows[0]).toContain("transactions.0.categoryId");
    expect(await snapshot()).toEqual(before);
  });

  it("(d) 원자성: 스키마는 통과하지만 DB에서 실패하면 전체 롤백된다", async () => {
    await seedRichData();
    const first = await exportOk();
    const bad = structuredClone(first.backup) as {
      transactions: { id: string; memo: string | null }[];
    };
    // 1000건 청크를 넘겨 마지막 청크에 NUL 문자(PG 22021)를 넣는다
    const template = bad.transactions[0];
    for (let i = 0; i < 1500; i++) bad.transactions.push({ ...template, id: `extra-${i}` });
    bad.transactions[bad.transactions.length - 1].memo = "a\u0000b";
    expect(backupSchema.safeParse(bad).success).toBe(true);
    const before = await snapshot();
    const r = await restoreBackup(bad);
    expect(r.ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });

  it("(e) 거래 15,000건 복원에 성공한다 (소요 시간 출력)", async () => {
    const first = await exportOk();
    const big = structuredClone(first.backup) as {
      transactions: Record<string, unknown>[];
    };
    big.transactions = Array.from({ length: 15_000 }, (_, i) => ({
      id: `bulk-${i}`,
      type: "EXPENSE",
      amount: 1_000 + i,
      occurredOn: "2026-10-21",
      categoryId: food,
      merchant: `거래처 ${i}`,
      item: "항목",
      purpose: "이유",
      memo: "메모",
      paymentMethod: "CREDIT_CARD",
      createdAt: "2026-10-21T00:00:00.000Z",
      recurringExpenseId: null,
    }));
    const start = performance.now();
    const r = await restoreBackup(big);
    const elapsed = Math.round(performance.now() - start);
    console.log(`[backup] 거래 15,000건 복원 소요: ${elapsed}ms`);
    expect(r.ok).toBe(true);
    expect(await db.transaction.count()).toBe(15_000);
  }, 60_000);
});
