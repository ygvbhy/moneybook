import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { archiveCategory, createCategory, renameCategory, restoreCategory } from "@/server/actions/categories";
import { createTransaction } from "@/server/actions/transactions";
import { setCategoryBudget, setTotalBudget } from "@/server/actions/budgets";
import { getBudgetPage } from "@/server/budgets";
import { listCategories } from "@/server/categories";
import { categoryId, loginAsTest, resetDb, txInput } from "../setup/db";

const M = "2026-10";
let food: string;

beforeEach(async () => {
  await resetDb();
  await loginAsTest();
  food = await categoryId("식비");
});

describe("예산", () => {
  it("같은 월·카테고리 upsert를 두 번 해도 행은 1개, 값은 마지막 값", async () => {
    expect(await setCategoryBudget({ yearMonth: M, categoryId: food, amount: 100_000 })).toEqual({ ok: true });
    expect(await setCategoryBudget({ yearMonth: M, categoryId: food, amount: 150_000 })).toEqual({ ok: true });
    const rows = await db.categoryBudget.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(150_000);

    await setTotalBudget({ yearMonth: M, amount: 500_000 });
    await setTotalBudget({ yearMonth: M, amount: 600_000 });
    const totals = await db.monthlyBudget.findMany();
    expect(totals).toHaveLength(1);
    expect(totals[0].totalAmount).toBe(600_000);
  });

  it("빈 값(null, 빈 문자열)을 저장하면 행이 삭제된다", async () => {
    await setCategoryBudget({ yearMonth: M, categoryId: food, amount: 100_000 });
    await setTotalBudget({ yearMonth: M, amount: 500_000 });
    expect(await setCategoryBudget({ yearMonth: M, categoryId: food, amount: null })).toEqual({ ok: true });
    expect(await setTotalBudget({ yearMonth: M, amount: "" })).toEqual({ ok: true });
    expect(await db.categoryBudget.count()).toBe(0);
    expect(await db.monthlyBudget.count()).toBe(0);
  });

  it("수입 카테고리 예산은 거부된다", async () => {
    const salary = await categoryId("급여", "INCOME");
    const r = await setCategoryBudget({ yearMonth: M, categoryId: salary, amount: 1_000 });
    expect(r.ok).toBe(false);
    expect(await db.categoryBudget.count()).toBe(0);
  });

  it("범위를 벗어난 금액과 잘못된 월은 fieldErrors", async () => {
    const r1 = await setTotalBudget({ yearMonth: M, amount: 0 });
    expect(r1.ok).toBe(false);
    const r2 = await setTotalBudget({ yearMonth: "2026-13", amount: 1000 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.fieldErrors?.yearMonth?.length).toBeGreaterThan(0);
    expect(await db.monthlyBudget.count()).toBe(0);
  });

  it("전체 500,000 + 식비 100,000, 식비 지출 120,000 → 식비 120% 초과, 전체 24%", async () => {
    await setTotalBudget({ yearMonth: M, amount: 500_000 });
    await setCategoryBudget({ yearMonth: M, categoryId: food, amount: 100_000 });
    await createTransaction(txInput({ categoryId: food, amount: 120_000 }));
    const page = await getBudgetPage(M);
    const row = page.categories.find((c) => c.categoryId === food)!;
    expect(row).toMatchObject({ spent: 120_000, rate: 120, over: true, overAmount: 20_000, remaining: -20_000 });
    expect(page.total).toBe(500_000);
    expect(page.totalSpent).toBe(120_000);
    expect(page.overview).toMatchObject({
      rate: 24,
      over: false,
      remaining: 380_000,
      allocated: 100_000,
      unallocated: 400_000,
      allocationWarning: false,
    });
  });

  it("카테고리 예산 합계가 전체보다 크면 경고", async () => {
    await setTotalBudget({ yearMonth: M, amount: 100_000 });
    await setCategoryBudget({ yearMonth: M, categoryId: food, amount: 150_000 });
    expect((await getBudgetPage(M)).overview.allocationWarning).toBe(true);
  });

  it("전체 예산 없이 카테고리 예산만 있으면 total은 null", async () => {
    await setCategoryBudget({ yearMonth: M, categoryId: food, amount: 100_000 });
    const page = await getBudgetPage(M);
    expect(page.total).toBeNull();
    expect(page.overview).toMatchObject({ rate: null, unallocated: null, allocationWarning: false });
  });

  it("월별로 독립이다 (이월 없음)", async () => {
    await setTotalBudget({ yearMonth: M, amount: 500_000 });
    expect((await getBudgetPage("2026-11")).total).toBeNull();
  });

  it("보관 카테고리는 해당 월에 예산이나 지출이 있을 때만 포함된다", async () => {
    const transport = await categoryId("교통");
    await setCategoryBudget({ yearMonth: M, categoryId: food, amount: 100_000 });
    await archiveCategory(food);
    await archiveCategory(transport);
    const page = await getBudgetPage(M);
    const ids = page.categories.map((c) => c.categoryId);
    expect(ids).toContain(food);
    expect(ids).not.toContain(transport);
    expect(page.categories.find((c) => c.categoryId === food)?.archived).toBe(true);
    // 수입 카테고리는 포함되지 않는다
    expect(page.categories).toHaveLength(8);

    // 지출만 있는 보관 카테고리
    await restoreCategory(transport);
    await createTransaction(txInput({ categoryId: transport, amount: 1_000 }));
    await archiveCategory(transport);
    expect((await getBudgetPage(M)).categories.map((c) => c.categoryId)).toContain(transport);
    expect((await getBudgetPage("2026-11")).categories.map((c) => c.categoryId)).not.toContain(transport);
  });
});

describe("카테고리 관리", () => {
  it("추가 시 sortOrder는 유형 내 최댓값 + 1", async () => {
    const r = await createCategory({ name: "카페", type: "EXPENSE" });
    expect(r.ok).toBe(true);
    const created = (await listCategories()).find((c) => c.name === "카페")!;
    expect(created.sortOrder).toBe(9);
    expect(created.archived).toBe(false);
    await createCategory({ name: "이자", type: "INCOME" });
    expect((await listCategories()).find((c) => c.name === "이자")!.sortOrder).toBe(3);
  });

  it("목록은 유형, sortOrder 순이고 보관 여부를 포함한다", async () => {
    await archiveCategory(food);
    const list = await listCategories();
    expect(list).toHaveLength(12);
    expect(list.find((c) => c.id === food)?.archived).toBe(true);
    // type은 Postgres enum 선언 순서(INCOME, EXPENSE)로 정렬된다
    const rank = { INCOME: 0, EXPENSE: 1 };
    const sorted = [...list].sort((a, b) => rank[a.type] - rank[b.type] || a.sortOrder - b.sortOrder);
    expect(list.map((c) => c.id)).toEqual(sorted.map((c) => c.id));
  });

  it("이름 변경, 보관, 복원", async () => {
    expect(await renameCategory(food, "  외식  ")).toEqual({ ok: true });
    expect((await listCategories()).find((c) => c.id === food)?.name).toBe("외식");
    await archiveCategory(food);
    expect((await listCategories()).find((c) => c.id === food)?.archived).toBe(true);
    await restoreCategory(food);
    expect((await listCategories()).find((c) => c.id === food)?.archived).toBe(false);
  });

  it("같은 유형에서 이름 중복은 오류 (이름 변경 포함), 다른 유형은 허용", async () => {
    const dup = "같은 이름의 카테고리가 있습니다(보관됨이면 복원하세요)";
    expect(await createCategory({ name: "식비", type: "EXPENSE" })).toEqual({ ok: false, error: dup });
    expect(await renameCategory(food, "교통")).toEqual({ ok: false, error: dup });
    expect((await createCategory({ name: "식비", type: "INCOME" })).ok).toBe(true);
  });

  it("빈 이름은 fieldErrors, 없는 카테고리는 ok:false", async () => {
    const r = await createCategory({ name: "  ", type: "EXPENSE" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.name?.length).toBeGreaterThan(0);
    expect((await renameCategory(food, "")).ok).toBe(false);
    expect(await archiveCategory("nope")).toMatchObject({ ok: false });
    expect(await restoreCategory("nope")).toMatchObject({ ok: false });
    expect(await renameCategory("nope", "x")).toMatchObject({ ok: false });
  });
});
