import { beforeEach, describe, expect, it } from "vitest";
import { createTransaction } from "@/server/actions/transactions";
import { archiveCategory } from "@/server/actions/categories";
import { getYearCategoryTotals } from "@/server/reports";
import { categoryId, loginAsTest, resetDb, txInput } from "../setup/db";

let food: string;
let transport: string;
let salary: string;

beforeEach(async () => {
  await resetDb();
  await loginAsTest();
  food = await categoryId("식비");
  transport = await categoryId("교통");
  salary = await categoryId("급여", "INCOME");
});

async function add(over: Record<string, unknown> & { categoryId: string }) {
  const r = await createTransaction(txInput(over));
  if (!r.ok) throw new Error(`create failed: ${r.error}`);
}

describe("getYearCategoryTotals", () => {
  it("거래가 없는 해는 둘 다 빈 배열", async () => {
    expect(await getYearCategoryTotals(2026)).toEqual({ income: [], expense: [] });
  });

  it("12-31은 포함하고 다음 해 01-01·전년 12-31은 제외한다", async () => {
    await add({ categoryId: food, amount: 1_000, occurredOn: "2026-01-01" });
    await add({ categoryId: food, amount: 2_000, occurredOn: "2026-12-31" });
    await add({ categoryId: food, amount: 5_000, occurredOn: "2027-01-01" });
    await add({ categoryId: food, amount: 7_000, occurredOn: "2025-12-31" });
    const r = await getYearCategoryTotals(2026);
    expect(r.expense).toEqual([{ categoryId: food, name: "식비", archived: false, total: 3_000 }]);
  });

  it("수입과 지출을 분리한다", async () => {
    await add({ categoryId: food, amount: 4_000 });
    await add({ type: "INCOME", categoryId: salary, amount: 100_000 });
    const r = await getYearCategoryTotals(2026);
    expect(r.expense.map((c) => c.categoryId)).toEqual([food]);
    expect(r.income).toEqual([{ categoryId: salary, name: "급여", archived: false, total: 100_000 }]);
  });

  it("보관 카테고리도 포함하고 archived: true", async () => {
    await add({ categoryId: food, amount: 4_000 });
    await archiveCategory(food);
    const r = await getYearCategoryTotals(2026);
    expect(r.expense).toMatchObject([{ categoryId: food, archived: true, total: 4_000 }]);
  });

  it("금액 내림차순, 동률은 categoryId 순", async () => {
    await add({ categoryId: food, amount: 3_000 });
    await add({ categoryId: transport, amount: 3_000 });
    const big = await categoryId("쇼핑");
    await add({ categoryId: big, amount: 9_000, occurredOn: "2026-03-05" });
    const r = await getYearCategoryTotals(2026);
    const tied = [food, transport].sort((a, b) => a.localeCompare(b));
    expect(r.expense.map((c) => c.categoryId)).toEqual([big, ...tied]);
  });
});
