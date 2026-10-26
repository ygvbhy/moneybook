import { beforeEach, describe, expect, it } from "vitest";
import { createTransaction } from "@/server/actions/transactions";
import { archiveCategory } from "@/server/actions/categories";
import { getYearCategoryTotals, getYearMerchantSpending } from "@/server/reports";
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

describe("getYearMerchantSpending", () => {
  it("거래가 없는 해는 빈 결과", async () => {
    expect(await getYearMerchantSpending(2026)).toEqual({ top: [], total: 0, unnamedTotal: 0 });
  });

  it("12-31은 포함하고 다음 해 01-01·전년 12-31은 제외한다", async () => {
    await add({ categoryId: food, merchant: "GS25", amount: 1_000, occurredOn: "2026-01-01" });
    await add({ categoryId: food, merchant: "GS25", amount: 2_000, occurredOn: "2026-12-31" });
    await add({ categoryId: food, merchant: "GS25", amount: 5_000, occurredOn: "2027-01-01" });
    await add({ categoryId: food, merchant: "GS25", amount: 7_000, occurredOn: "2025-12-31" });
    expect(await getYearMerchantSpending(2026)).toEqual({
      top: [{ merchant: "GS25", total: 3_000 }],
      total: 3_000,
      unnamedTotal: 0,
    });
  });

  it("수입 거래는 같은 거래처 이름이어도 제외한다", async () => {
    await add({ categoryId: food, merchant: "회사", amount: 4_000 });
    await add({ type: "INCOME", categoryId: salary, merchant: "회사", amount: 100_000 });
    expect(await getYearMerchantSpending(2026)).toEqual({
      top: [{ merchant: "회사", total: 4_000 }],
      total: 4_000,
      unnamedTotal: 0,
    });
  });

  it("같은 거래처 여러 건은 카테고리가 달라도 합산한다", async () => {
    await add({ categoryId: food, merchant: "GS25", amount: 3_000 });
    await add({ categoryId: transport, merchant: "GS25", amount: 2_000, occurredOn: "2026-05-05" });
    const r = await getYearMerchantSpending(2026);
    expect(r.top).toEqual([{ merchant: "GS25", total: 5_000 }]);
  });

  it("거래처 null은 top에 없고 unnamedTotal에 합산되며 total에는 포함된다", async () => {
    await add({ categoryId: food, merchant: "GS25", amount: 3_000 });
    await add({ categoryId: food, amount: 1_000 });
    await add({ categoryId: transport, amount: 2_000 });
    expect(await getYearMerchantSpending(2026)).toEqual({
      top: [{ merchant: "GS25", total: 3_000 }],
      total: 6_000,
      unnamedTotal: 3_000,
    });
  });

  it("거래처 없이 지출만 있으면 top이 비고 unnamedTotal만 채워진다", async () => {
    await add({ categoryId: food, amount: 1_500 });
    expect(await getYearMerchantSpending(2026)).toEqual({
      top: [],
      total: 1_500,
      unnamedTotal: 1_500,
    });
  });

  it("11곳이면 상위 10곳만, 금액 내림차순, 동률은 거래처 이름 코드포인트 순", async () => {
    // 1_000원 동률 9곳(이름 역순으로 등록) + 5_000원 1곳 + 최하위 500원 1곳
    const tied = ["나", "다", "가", "B", "a", "A", "b", "1", "하"];
    for (const merchant of tied) {
      await add({ categoryId: food, merchant, amount: 1_000 });
    }
    await add({ categoryId: food, merchant: "최고", amount: 5_000 });
    await add({ categoryId: food, merchant: "꼴찌", amount: 500 });
    const r = await getYearMerchantSpending(2026);
    expect(r.top.map((m) => m.merchant)).toEqual([
      "최고",
      "1",
      "A",
      "B",
      "a",
      "b",
      "가",
      "나",
      "다",
      "하",
    ]);
    expect(r.top).toHaveLength(10);
    expect(r.total).toBe(5_000 + 9_000 + 500);
  });
});
