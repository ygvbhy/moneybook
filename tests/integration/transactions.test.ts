import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { toDbDate, todayInSeoul } from "@/lib/date";
import {
  createTransaction,
  deleteTransaction,
  deleteTransactions,
  exportTransactionsCsv,
  updateTransaction,
  updateTransactionsCategory,
} from "@/server/actions/transactions";
import { archiveCategory, createCategory } from "@/server/actions/categories";
import {
  getMonthSummary,
  getMerchantSuggestions,
  getMonthlyTrend,
  getPaymentMethodSpending,
  getRecentCategoryIds,
  getRecentTransactionPresets,
} from "@/server/dashboard";
import { createRecurring, materializeRecurring } from "@/server/recurring";
import { getDailyTotals, listTransactionsByDate } from "@/server/calendar";
import {
  getTransaction,
  listTransactions,
  parseListParams,
  summarizeTransactions,
} from "@/server/transactions";
import { categoryId, loginAsTest, resetDb, txInput } from "../setup/db";

const MSG_GONE = "이미 삭제되었거나 존재하지 않는 거래입니다";

let food: string;
let salary: string;

beforeEach(async () => {
  await resetDb();
  await loginAsTest();
  food = await categoryId("식비");
  salary = await categoryId("급여", "INCOME");
});

async function create(over: Record<string, unknown> = {}) {
  const r = await createTransaction(txInput({ categoryId: food, ...over }));
  if (!r.ok) throw new Error(`create failed: ${r.error}`);
  return r.data!.id;
}

describe("거래와 집계", () => {
  it("생성 → 요약 반영, 수정 → 변경, 삭제 → 원복", async () => {
    expect(await getMonthSummary("2026-10")).toEqual({ income: 0, expense: 0, net: 0 });
    const id = await create({ amount: 12_500 });
    const inc = await createTransaction(
      txInput({ type: "INCOME", categoryId: salary, amount: 100_000 }),
    );
    expect(inc.ok).toBe(true);
    expect(await getMonthSummary("2026-10")).toEqual({
      income: 100_000,
      expense: 12_500,
      net: 87_500,
    });

    const upd = await updateTransaction(id, txInput({ categoryId: food, amount: 20_000 }));
    expect(upd).toEqual({ ok: true });
    expect((await getMonthSummary("2026-10")).expense).toBe(20_000);

    expect(await deleteTransaction(id)).toEqual({ ok: true });
    expect(await getMonthSummary("2026-10")).toMatchObject({ expense: 0 });
  });

  it("10-31과 11-01은 각각 10월·11월에만 집계된다", async () => {
    await create({ occurredOn: "2026-10-31", amount: 1_000 });
    await create({ occurredOn: "2026-11-01", amount: 2_000 });
    expect((await getMonthSummary("2026-10")).expense).toBe(1_000);
    expect((await getMonthSummary("2026-11")).expense).toBe(2_000);
    expect(await listTransactions({ month: "2026-10", sort: "asc" })).toHaveLength(1);
    expect(Object.keys(await getDailyTotals("2026-10"))).toEqual(["2026-10-31"]);
    expect(Object.keys(await getDailyTotals("2026-11"))).toEqual(["2026-11-01"]);
  });

  it('"2026-10-21"로 저장하면 다시 읽어도 "2026-10-21"이다', async () => {
    const id = await create({ occurredOn: "2026-10-21" });
    expect((await getTransaction(id))?.occurredOn).toBe("2026-10-21");
    expect((await listTransactions({ month: "2026-10", sort: "desc" }))[0].occurredOn).toBe(
      "2026-10-21",
    );
    const raw = await db.transaction.findUniqueOrThrow({ where: { id } });
    expect(raw.occurredOn.toISOString()).toBe("2026-10-21T00:00:00.000Z");
  });

  it("검증 실패는 fieldErrors와 함께 ok:false이고 저장되지 않는다", async () => {
    const r = await createTransaction({ type: "EXPENSE", amount: 0, occurredOn: "2026-13-01" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors?.amount?.length).toBeGreaterThan(0);
      expect(r.fieldErrors?.occurredOn?.length).toBeGreaterThan(0);
    }
    expect(await db.transaction.count()).toBe(0);
  });
});

describe("월별 추이", () => {
  it("최근 6개월을 월별로 집계하고 범위 밖 거래는 제외하며 마지막 달은 월 요약과 같다", async () => {
    await create({ occurredOn: "2026-04-30", amount: 7_000 });
    await create({ occurredOn: "2026-05-31", amount: 1_000 });
    await create({ occurredOn: "2026-06-01", amount: 2_000 });
    await create({ occurredOn: "2026-10-31", amount: 3_000 });
    const inc = await createTransaction(
      txInput({ type: "INCOME", categoryId: salary, occurredOn: "2026-09-15", amount: 50_000 }),
    );
    expect(inc.ok).toBe(true);

    const trend = await getMonthlyTrend("2026-10");
    expect(trend).toEqual([
      { month: "2026-05", income: 0, expense: 1_000 },
      { month: "2026-06", income: 0, expense: 2_000 },
      { month: "2026-07", income: 0, expense: 0 },
      { month: "2026-08", income: 0, expense: 0 },
      { month: "2026-09", income: 50_000, expense: 0 },
      { month: "2026-10", income: 0, expense: 3_000 },
    ]);
    const { income, expense } = await getMonthSummary("2026-10");
    expect(trend[5]).toEqual({ month: "2026-10", income, expense });
  });

  it("1900년 초반 월은 1900년 이전 달 없이 조회된다", async () => {
    await create({ occurredOn: "1900-02-10", amount: 4_000 });
    expect(await getMonthlyTrend("1900-02")).toEqual([
      { month: "1900-01", income: 0, expense: 0 },
      { month: "1900-02", income: 0, expense: 4_000 },
    ]);
  });
});

describe("카테고리 규칙", () => {
  it("수입 거래에 지출 카테고리를 쓰면 거부된다", async () => {
    const r = await createTransaction(txInput({ type: "INCOME", categoryId: food }));
    expect(r.ok).toBe(false);
    expect(await db.transaction.count()).toBe(0);
  });

  it("존재하지 않는 카테고리는 거부된다", async () => {
    const r = await createTransaction(txInput({ categoryId: "nope" }));
    expect(r.ok).toBe(false);
  });

  it("새 거래에 보관 카테고리를 쓰면 거부된다", async () => {
    await archiveCategory(food);
    const r = await createTransaction(txInput({ categoryId: food }));
    expect(r).toMatchObject({ ok: false, error: "보관된 카테고리는 사용할 수 없습니다" });
    expect(await db.transaction.count()).toBe(0);
  });

  it("보관 카테고리인 기존 거래는 그대로 수정할 수 있고, 다른 보관 카테고리로는 바꿀 수 없다", async () => {
    const id = await create({ amount: 5_000 });
    const other = await categoryId("교통");
    await archiveCategory(food);
    await archiveCategory(other);

    const same = await updateTransaction(id, txInput({ categoryId: food, amount: 7_000 }));
    expect(same).toEqual({ ok: true });
    expect((await getTransaction(id))?.amount).toBe(7_000);
    expect((await getTransaction(id))?.categoryArchived).toBe(true);

    const changed = await updateTransaction(id, txInput({ categoryId: other }));
    expect(changed.ok).toBe(false);
    expect((await getTransaction(id))?.categoryId).toBe(food);

    // 활성 카테고리로는 바꿀 수 있다
    const active = await categoryId("쇼핑");
    expect(await updateTransaction(id, txInput({ categoryId: active }))).toEqual({ ok: true });
  });

  it("보관된 이름으로 추가하면 중복 오류", async () => {
    await archiveCategory(food);
    const r = await createCategory({ name: "식비", type: "EXPENSE" });
    expect(r).toEqual({
      ok: false,
      error: "같은 이름의 카테고리가 있습니다(보관됨이면 복원하세요)",
    });
  });
});

describe("삭제 경쟁", () => {
  it("이미 삭제된 거래를 수정·삭제하면 ok:false와 안내 메시지", async () => {
    const id = await create();
    expect(await deleteTransaction(id)).toEqual({ ok: true });
    expect(await updateTransaction(id, txInput({ categoryId: food }))).toEqual({
      ok: false,
      error: MSG_GONE,
    });
    expect(await deleteTransaction(id)).toEqual({ ok: false, error: MSG_GONE });
  });
});

describe("목록 조회", () => {
  beforeEach(async () => {
    await create({ occurredOn: "2026-10-05", amount: 1_000, merchant: "GS25 편의점" });
    await create({ occurredOn: "2026-10-05", amount: 2_000, item: "Americano" });
    await create({ occurredOn: "2026-10-20", amount: 3_000, memo: "회식 후 정산" });
    await createTransaction(
      txInput({ type: "INCOME", categoryId: salary, occurredOn: "2026-10-25", amount: 9_000 }),
    );
  });
  const list = (p: Partial<Parameters<typeof listTransactions>[0]> = {}) =>
    listTransactions({ month: "2026-10", sort: "desc", ...p });

  it("유형 필터", async () => {
    expect((await list({ type: "INCOME" })).map((t) => t.amount)).toEqual([9_000]);
    expect(await list({ type: "EXPENSE" })).toHaveLength(3);
  });

  it("카테고리 필터", async () => {
    expect(await list({ categoryId: salary })).toHaveLength(1);
    expect(await list({ categoryId: food })).toHaveLength(3);
  });

  it("결제수단 필터: 값 일치, none은 미지정만", async () => {
    await create({ occurredOn: "2026-10-06", amount: 4_000, paymentMethod: "CASH" });
    await create({ occurredOn: "2026-10-07", amount: 5_000, paymentMethod: "CREDIT_CARD" });
    expect((await list({ paymentMethod: "CASH" })).map((t) => t.amount)).toEqual([4_000]);
    expect(
      (await list({ paymentMethod: "none", sort: "asc" })).map((t) => t.amount),
    ).toEqual([1_000, 2_000, 3_000, 9_000]);
    expect(await list({ paymentMethod: "OTHER" })).toHaveLength(0);
    expect(await list()).toHaveLength(6);
  });

  it("검색은 거래처·항목·메모에서 대소문자 무시", async () => {
    expect((await list({ q: "gs25" })).map((t) => t.amount)).toEqual([1_000]);
    expect((await list({ q: "AMERICANO" })).map((t) => t.amount)).toEqual([2_000]);
    expect((await list({ q: "정산" })).map((t) => t.amount)).toEqual([3_000]);
    expect(await list({ q: "없는검색어" })).toHaveLength(0);
  });

  it("정렬: 날짜순, 같은 날짜는 createdAt 같은 방향", async () => {
    expect((await list({ sort: "asc" })).map((t) => t.amount)).toEqual([1_000, 2_000, 3_000, 9_000]);
    expect((await list({ sort: "desc" })).map((t) => t.amount)).toEqual([9_000, 3_000, 2_000, 1_000]);
  });

  it("카테고리 이름과 보관 여부를 포함한다", async () => {
    await archiveCategory(food);
    const rows = await list({ categoryId: food });
    expect(rows[0]).toMatchObject({ categoryName: "식비", categoryArchived: true });
  });
});

describe("일별 합계", () => {
  it("수입/지출을 분리해 날짜별로 합산한다", async () => {
    await create({ occurredOn: "2026-10-05", amount: 1_000 });
    await create({ occurredOn: "2026-10-05", amount: 2_000 });
    await createTransaction(
      txInput({ type: "INCOME", categoryId: salary, occurredOn: "2026-10-05", amount: 7_000 }),
    );
    await create({ occurredOn: "2026-10-06", amount: 500 });
    expect(await getDailyTotals("2026-10")).toEqual({
      "2026-10-05": { income: 7_000, expense: 3_000, count: 3 },
      "2026-10-06": { income: 0, expense: 500, count: 1 },
    });
    expect(await listTransactionsByDate("2026-10-05")).toHaveLength(3);
    expect(await listTransactionsByDate("2026-10-07")).toEqual([]);
  });
});

describe("최근 카테고리", () => {
  it("최근 사용 순, 중복 없음, 유형별, 보관 카테고리 제외, 최대 limit", async () => {
    const names = ["식비", "교통", "쇼핑", "구독", "기타", "주거비"];
    for (const [i, n] of names.entries()) {
      await create({ categoryId: await categoryId(n), occurredOn: `2026-10-0${i + 1}` });
    }
    await create({ categoryId: await categoryId("식비"), occurredOn: "2026-10-10" }); // 식비가 가장 최근
    await createTransaction(txInput({ type: "INCOME", categoryId: salary }));

    const ids = await getRecentCategoryIds("EXPENSE");
    expect(ids).toHaveLength(5);
    expect(ids[0]).toBe(await categoryId("식비"));
    expect(ids[1]).toBe(await categoryId("주거비"));
    expect(new Set(ids).size).toBe(5);
    expect(await getRecentCategoryIds("INCOME")).toEqual([salary]);

    await archiveCategory(await categoryId("식비"));
    const after = await getRecentCategoryIds("EXPENSE");
    expect(after).not.toContain(await categoryId("식비"));
    expect(after[0]).toBe(await categoryId("주거비"));
  });
});

describe("최근 거래 프리셋", () => {
  it("같은 내용 2건은 1개로 합치고 최근 것이 앞에 온다", async () => {
    await create({ amount: 4_500, merchant: "스타벅스", occurredOn: "2026-10-01" });
    await create({ amount: 9_000, merchant: "점심", occurredOn: "2026-10-02" });
    await create({ amount: 4_500, merchant: "스타벅스", occurredOn: "2026-10-03" });

    const { EXPENSE } = await getRecentTransactionPresets();
    expect(EXPENSE.map((p) => [p.merchant, p.amount])).toEqual([
      ["스타벅스", 4_500],
      ["점심", 9_000],
    ]);
    expect(EXPENSE[0]).toMatchObject({ categoryId: food, categoryName: "식비", type: "EXPENSE" });
  });

  it("보관한 카테고리의 거래는 제외한다", async () => {
    const transport = await categoryId("교통");
    await create({ categoryId: transport, amount: 1_400, occurredOn: "2026-10-01" });
    await create({ amount: 8_000, occurredOn: "2026-10-02" });
    await archiveCategory(transport);

    const { EXPENSE } = await getRecentTransactionPresets();
    expect(EXPENSE.map((p) => p.amount)).toEqual([8_000]);
  });

  it("고정지출이 만든 거래는 제외한다", async () => {
    await createRecurring(
      {
        categoryId: food,
        item: "월세",
        amount: 500_000,
        dayOfMonth: 25,
        merchant: null,
        memo: null,
        paymentMethod: null,
      } as Parameters<typeof createRecurring>[0],
      "2026-10-21",
    );
    await materializeRecurring("2026-10-25");
    expect(await db.transaction.count({ where: { recurringExpenseId: { not: null } } })).toBe(1);
    await create({ amount: 3_000, occurredOn: "2026-10-01" });

    const { EXPENSE } = await getRecentTransactionPresets();
    expect(EXPENSE.map((p) => p.amount)).toEqual([3_000]);
  });

  it("수입과 지출을 분리한다", async () => {
    await create({ amount: 3_000 });
    await createTransaction(txInput({ type: "INCOME", categoryId: salary, amount: 2_000_000 }));

    const presets = await getRecentTransactionPresets();
    expect(presets.EXPENSE.map((p) => p.amount)).toEqual([3_000]);
    expect(presets.INCOME.map((p) => p.amount)).toEqual([2_000_000]);
  });
});

describe("거래처 제안", () => {
  it("거래처가 없는 거래는 제외한다", async () => {
    await create({ merchant: null });
    await create({ merchant: "스타벅스" });
    const { EXPENSE } = await getMerchantSuggestions();
    expect(EXPENSE.map((s) => s.merchant)).toEqual(["스타벅스"]);
  });

  it("보관한 카테고리의 거래는 제외한다", async () => {
    const transport = await categoryId("교통");
    await create({ categoryId: transport, merchant: "버스" });
    await create({ merchant: "스타벅스" });
    await archiveCategory(transport);
    const { EXPENSE } = await getMerchantSuggestions();
    expect(EXPENSE.map((s) => s.merchant)).toEqual(["스타벅스"]);
  });

  it("고정지출이 만든 거래는 제외한다", async () => {
    await createRecurring(
      {
        categoryId: food,
        item: "월세",
        amount: 500_000,
        dayOfMonth: 25,
        merchant: "집주인",
        memo: null,
        paymentMethod: null,
      } as Parameters<typeof createRecurring>[0],
      "2026-10-21",
    );
    await materializeRecurring("2026-10-25");
    expect(await db.transaction.count({ where: { recurringExpenseId: { not: null } } })).toBe(1);
    await create({ merchant: "스타벅스" });
    const { EXPENSE } = await getMerchantSuggestions();
    expect(EXPENSE.map((s) => s.merchant)).toEqual(["스타벅스"]);
  });

  it("같은 거래처가 여러 카테고리면 가장 많이 쓴 카테고리를 고른다", async () => {
    const transport = await categoryId("교통");
    await create({ merchant: "GS25", categoryId: food, paymentMethod: "CASH" });
    await create({ merchant: "GS25", categoryId: transport, paymentMethod: "CREDIT_CARD" });
    await create({ merchant: "GS25", categoryId: transport, paymentMethod: "CREDIT_CARD" });
    const { EXPENSE } = await getMerchantSuggestions();
    expect(EXPENSE).toEqual([
      { merchant: "GS25", categoryId: transport, paymentMethod: "CREDIT_CARD" },
    ]);
  });
});

describe("기간 조회", () => {
  beforeEach(async () => {
    await create({ occurredOn: "2026-09-14", amount: 1_000, merchant: "커피집" });
    await create({ occurredOn: "2026-09-15", amount: 2_000, merchant: "커피집" });
    await create({ occurredOn: "2026-10-05", amount: 3_000, merchant: "서점" });
    await create({ occurredOn: "2026-10-06", amount: 4_000, merchant: "커피집" });
    await createTransaction(
      txInput({ type: "INCOME", categoryId: salary, amount: 50_000, occurredOn: "2025-01-10" }),
    );
  });
  it("기간 조회는 양끝 날짜를 포함하고 전날·다음 날은 제외한다", async () => {
    const list = await listTransactions({
      month: "2026-10",
      period: { from: "2026-09-15", to: "2026-10-05" },
      sort: "asc",
    });
    expect(list.map((t) => t.occurredOn)).toEqual(["2026-09-15", "2026-10-05"]);
  });
  it("전체 기간 조회는 여러 달 거래를 유형·검색 필터와 함께 조회한다", async () => {
    const base = { month: "2026-10", period: "all" as const, sort: "asc" as const };
    expect((await listTransactions(base)).length).toBe(5);
    const incomes = await listTransactions({ ...base, type: "INCOME" });
    expect(incomes.map((t) => t.occurredOn)).toEqual(["2025-01-10"]);
    const coffee = await listTransactions({ ...base, type: "EXPENSE", q: "커피" });
    expect(coffee.map((t) => t.occurredOn)).toEqual(["2026-09-14", "2026-09-15", "2026-10-06"]);
  });
  it("period가 없으면 month 범위만 조회한다", async () => {
    const list = await listTransactions({ month: "2026-10", sort: "asc" });
    expect(list.map((t) => t.occurredOn)).toEqual(["2026-10-05", "2026-10-06"]);
  });
});

describe("URL 파라미터 정규화", () => {
  const today = "2026-10-21";
  it("기본값", async () => {
    expect(await parseListParams({}, today)).toEqual({
      month: "2026-10",
      type: undefined,
      categoryId: undefined,
      paymentMethod: undefined,
      q: undefined,
      sort: "desc",
    });
  });
  it("잘못된 month는 현재 서울 월, 알 수 없는 type/category/sort는 무시", async () => {
    const p = await parseListParams(
      { month: "abc", type: "FOO", category: "nope", sort: "sideways", q: "   " },
      today,
    );
    expect(p).toMatchObject({ month: "2026-10", sort: "desc" });
    expect(p.type).toBeUndefined();
    expect(p.categoryId).toBeUndefined();
    expect(p.q).toBeUndefined();
  });
  it("payment: 허용된 값과 none은 유지, 알 수 없는 값은 무시", async () => {
    expect((await parseListParams({ payment: "CASH" }, today)).paymentMethod).toBe("CASH");
    expect((await parseListParams({ payment: "none" }, today)).paymentMethod).toBe("none");
    expect((await parseListParams({ payment: "BITCOIN" }, today)).paymentMethod).toBeUndefined();
    expect((await parseListParams({ payment: "cash" }, today)).paymentMethod).toBeUndefined();
  });
  it("CSV 현재 목록 내보내기에 payment 필터가 반영된다", async () => {
    await create({ occurredOn: "2026-10-06", paymentMethod: "CASH" });
    await create({ occurredOn: "2026-10-07", paymentMethod: "CASH" });
    await create({ occurredOn: "2026-10-08", paymentMethod: "CREDIT_CARD" });
    await create({ occurredOn: "2026-10-09" });
    const exported = async (payment: string) => {
      const r = await exportTransactionsCsv({
        scope: "filtered",
        params: { month: "2026-10", payment },
      });
      if (!r.ok) throw new Error(r.error);
      return r.data!.count;
    };
    expect(await exported("CASH")).toBe(
      (await listTransactions({ month: "2026-10", sort: "desc", paymentMethod: "CASH" })).length,
    );
    expect(await exported("CASH")).toBe(2);
    expect(await exported("none")).toBe(1);
  });
  it("기간: range=all은 from/to보다 우선, 유효한 from/to는 period", async () => {
    expect(
      (await parseListParams({ range: "all", from: "2026-01-01", to: "2026-02-01" }, today)).period,
    ).toBe("all");
    expect((await parseListParams({ from: "2026-01-01", to: "2026-10-26" }, today)).period).toEqual({
      from: "2026-01-01",
      to: "2026-10-26",
    });
    expect((await parseListParams({ from: "2026-10-05", to: "2026-10-05" }, today)).period).toEqual({
      from: "2026-10-05",
      to: "2026-10-05",
    });
  });
  it("기간: from>to, 한쪽만, 무효·1900 미만 값은 무시", async () => {
    const period = async (sp: Record<string, string>) => (await parseListParams(sp, today)).period;
    expect(await period({ from: "2026-10-05", to: "2026-10-04" })).toBeUndefined();
    expect(await period({ from: "2026-10-05" })).toBeUndefined();
    expect(await period({ to: "2026-10-05" })).toBeUndefined();
    expect(await period({ from: "abc", to: "2026-10-05" })).toBeUndefined();
    expect(await period({ from: "2026-02-30", to: "2026-10-05" })).toBeUndefined();
    expect(await period({ from: "0002-10-01", to: "2026-10-05" })).toBeUndefined();
    expect(await period({ from: "1899-12-31", to: "2026-10-05" })).toBeUndefined();
    expect(await period({ range: "yes" })).toBeUndefined();
  });
  it("CSV 현재 목록 파일명: 기간·전체 기간·월", async () => {
    await create({ occurredOn: "2026-09-14", merchant: "커피집" });
    await create({ occurredOn: "2026-09-15", merchant: "커피집" });
    await create({ occurredOn: "2026-10-05", merchant: "커피집" });
    await create({ occurredOn: "2026-10-06", merchant: "커피집" });
    await create({ occurredOn: "2026-07-01", merchant: "서점" });
    const exported = async (params: Record<string, string>) => {
      const r = await exportTransactionsCsv({ scope: "filtered", params });
      if (!r.ok) throw new Error(r.error);
      return r.data!;
    };
    const range = await exported({ from: "2026-09-15", to: "2026-10-05" });
    expect(range.filename).toBe("moneybook-2026-09-15_2026-10-05.csv");
    expect(range.count).toBe(2);

    const all = await exported({ range: "all", q: "커피" });
    expect(all.filename).toBe(`moneybook-all-filtered-${todayInSeoul()}.csv`);
    expect(all.count).toBe(4);

    const month = await exported({ month: "2026-10" });
    expect(month.filename).toBe("moneybook-2026-10.csv");
    expect(month.count).toBe(2);
  });
  it("유효한 값은 유지, 배열은 첫 값", async () => {
    const p = await parseListParams(
      { month: ["2026-09", "x"], type: "INCOME", category: salary, sort: "asc", q: " 커피 " },
      today,
    );
    expect(p).toEqual({
      month: "2026-09",
      type: "INCOME",
      categoryId: salary,
      paymentMethod: undefined,
      q: "커피",
      sort: "asc",
    });
  });
});

describe("결제수단별 지출", () => {
  it("지출만 금액 내림차순으로 집계하고, 합계는 월 지출과 같다", async () => {
    await create({ amount: 5_000, paymentMethod: "CREDIT_CARD" });
    await create({ amount: 3_000, paymentMethod: "CREDIT_CARD" });
    await create({ amount: 8_000, paymentMethod: "CASH" });
    await create({ amount: 20_000 });
    await create({ amount: 1_000, paymentMethod: "DEBIT_CARD" });
    await create({ amount: 7_000, occurredOn: "2026-11-01", paymentMethod: "CASH" });
    await createTransaction(
      txInput({ type: "INCOME", categoryId: salary, amount: 99_000, paymentMethod: "CASH" }),
    );

    const spending = await getPaymentMethodSpending("2026-10");
    expect(spending).toEqual([
      { paymentMethod: null, total: 20_000 },
      { paymentMethod: "CASH", total: 8_000 },
      { paymentMethod: "CREDIT_CARD", total: 8_000 },
      { paymentMethod: "DEBIT_CARD", total: 1_000 },
    ]);
    expect(spending.reduce((sum, s) => sum + s.total, 0)).toBe(
      (await getMonthSummary("2026-10")).expense,
    );
  });

  it("금액이 같으면 결제수단 목록 순서이고 미지정은 마지막이다", async () => {
    await create({ amount: 5_000 });
    await create({ amount: 5_000, paymentMethod: "OTHER" });
    await create({ amount: 5_000, paymentMethod: "BANK_TRANSFER" });

    expect(await getPaymentMethodSpending("2026-10")).toEqual([
      { paymentMethod: "BANK_TRANSFER", total: 5_000 },
      { paymentMethod: "OTHER", total: 5_000 },
      { paymentMethod: null, total: 5_000 },
    ]);
  });

  it("지출이 없으면 빈 배열", async () => {
    expect(await getPaymentMethodSpending("2026-10")).toEqual([]);
  });
});

describe("일괄 삭제", () => {
  it("3건 중 2건을 삭제하면 count 2이고 나머지는 남는다", async () => {
    const a = await create();
    const b = await create();
    const c = await create();
    expect(await deleteTransactions([a, b])).toEqual({ ok: true, data: { count: 2 } });
    const left = await db.transaction.findMany({ select: { id: true } });
    expect(left).toEqual([{ id: c }]);
  });

  it("일부가 이미 삭제됐으면 남은 수만 count로 돌려준다", async () => {
    const a = await create();
    const b = await create();
    await deleteTransaction(a);
    expect(await deleteTransactions([a, b])).toEqual({ ok: true, data: { count: 1 } });
    expect(await db.transaction.count()).toBe(0);
  });

  it("전부 없는 id면 안내 메시지", async () => {
    expect(await deleteTransactions(["nope1", "nope2"])).toEqual({ ok: false, error: MSG_GONE });
  });

  it.each([[[]], ["abc"], [null], [[1, 2]], [[""]], [{}]])(
    "잘못된 입력 %j은 잘못된 요청입니다",
    async (input) => {
      await create();
      expect(await deleteTransactions(input)).toEqual({ ok: false, error: "잘못된 요청입니다" });
      expect(await db.transaction.count()).toBe(1);
    },
  );

  it("중복 id는 한 번만 처리한다", async () => {
    const a = await create();
    expect(await deleteTransactions([a, a, a])).toEqual({ ok: true, data: { count: 1 } });
  });

  it("5,001개 고유 id는 상한 오류이고 DB는 그대로다", async () => {
    await create();
    const ids = Array.from({ length: 5001 }, (_, i) => `id-${i}`);
    expect(await deleteTransactions(ids)).toEqual({
      ok: false,
      error: "한 번에 최대 5,000건까지 처리할 수 있습니다",
    });
    expect(await db.transaction.count()).toBe(1);
  });

  it("중복을 제거하면 5,000건 이하인 요청은 상한에 걸리지 않는다", async () => {
    const a = await create();
    const ids = Array.from({ length: 5001 }, () => a);
    expect(await deleteTransactions(ids)).toEqual({ ok: true, data: { count: 1 } });
  });
});

describe("일괄 카테고리 변경", () => {
  it("지출 2건을 다른 지출 카테고리로 바꾼다", async () => {
    const transport = await categoryId("교통");
    const a = await create();
    const b = await create();
    const r = await updateTransactionsCategory({ ids: [a, b], categoryId: transport });
    expect(r).toEqual({ ok: true, data: { count: 2 } });
    expect((await getTransaction(a))?.categoryId).toBe(transport);
    expect((await getTransaction(b))?.categoryId).toBe(transport);
  });

  it("수입·지출이 섞이면 거부되고 아무것도 바뀌지 않는다", async () => {
    const transport = await categoryId("교통");
    const a = await create();
    const inc = await createTransaction(txInput({ type: "INCOME", categoryId: salary }));
    const incId = inc.ok ? inc.data!.id : "";
    const r = await updateTransactionsCategory({ ids: [a, incId], categoryId: transport });
    expect(r).toEqual({ ok: false, error: "거래 유형과 카테고리 유형이 일치하지 않습니다" });
    expect((await getTransaction(a))?.categoryId).toBe(food);
    expect((await getTransaction(incId))?.categoryId).toBe(salary);
  });

  it("지출 거래를 수입 카테고리로 바꾸면 거부된다", async () => {
    const a = await create();
    const r = await updateTransactionsCategory({ ids: [a], categoryId: salary });
    expect(r).toEqual({ ok: false, error: "거래 유형과 카테고리 유형이 일치하지 않습니다" });
    expect((await getTransaction(a))?.categoryId).toBe(food);
  });

  it("보관 카테고리로는 바꿀 수 없다", async () => {
    const transport = await categoryId("교통");
    const a = await create();
    await archiveCategory(transport);
    const r = await updateTransactionsCategory({ ids: [a], categoryId: transport });
    expect(r).toEqual({ ok: false, error: "보관된 카테고리는 사용할 수 없습니다" });
    expect((await getTransaction(a))?.categoryId).toBe(food);
  });

  it("없는 카테고리면 거부된다", async () => {
    const a = await create();
    const r = await updateTransactionsCategory({ ids: [a], categoryId: "nope" });
    expect(r).toEqual({ ok: false, error: "카테고리를 찾을 수 없습니다" });
  });

  it("보관 카테고리에 있던 거래를 활성 카테고리로 옮길 수 있다", async () => {
    const transport = await categoryId("교통");
    const a = await create();
    await archiveCategory(food);
    const r = await updateTransactionsCategory({ ids: [a], categoryId: transport });
    expect(r).toEqual({ ok: true, data: { count: 1 } });
    expect((await getTransaction(a))?.categoryId).toBe(transport);
  });

  it("고정지출이 만든 거래도 바꿀 수 있고 recurringExpenseId는 유지된다", async () => {
    const transport = await categoryId("교통");
    await createRecurring(
      {
        categoryId: food,
        item: "월세",
        amount: 500_000,
        dayOfMonth: 25,
        merchant: null,
        memo: null,
        paymentMethod: null,
      } as Parameters<typeof createRecurring>[0],
      "2026-10-21",
    );
    await materializeRecurring("2026-10-25");
    const before = await db.transaction.findFirstOrThrow({
      where: { recurringExpenseId: { not: null } },
    });
    const r = await updateTransactionsCategory({ ids: [before.id], categoryId: transport });
    expect(r).toEqual({ ok: true, data: { count: 1 } });
    const after = await db.transaction.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.categoryId).toBe(transport);
    expect(after.recurringExpenseId).toBe(before.recurringExpenseId);
  });

  it("전부 없는 id면 안내 메시지", async () => {
    const transport = await categoryId("교통");
    const r = await updateTransactionsCategory({ ids: ["nope"], categoryId: transport });
    expect(r).toEqual({ ok: false, error: MSG_GONE });
  });

  it.each([
    [null],
    [{ ids: [], categoryId: "x" }],
    [{ ids: "a", categoryId: "x" }],
    [{ ids: ["a"], categoryId: "" }],
    [{ ids: ["a"] }],
  ])("잘못된 입력 %j은 잘못된 요청입니다", async (input) => {
    expect(await updateTransactionsCategory(input)).toEqual({
      ok: false,
      error: "잘못된 요청입니다",
    });
  });

  it("5,001개 고유 id는 상한 오류", async () => {
    const ids = Array.from({ length: 5001 }, (_, i) => `id-${i}`);
    expect(await updateTransactionsCategory({ ids, categoryId: food })).toEqual({
      ok: false,
      error: "한 번에 최대 5,000건까지 처리할 수 있습니다",
    });
  });
});

describe("목록 페이지 조회와 합계", () => {
  async function seedTies() {
    const createdAt = new Date("2026-10-10T03:00:00.000Z");
    await db.transaction.createMany({
      data: Array.from({ length: 7 }, (_, i) => ({
        type: "EXPENSE" as const,
        amount: 1_000 + i,
        occurredOn: toDbDate("2026-10-10"),
        categoryId: food,
        createdAt,
      })),
    });
  }

  it.each(["asc", "desc"] as const)(
    "동률 행도 페이지를 이어붙이면 전체 목록과 같고 id %s 순이다",
    async (sort) => {
      await seedTies();
      const params = { month: "2026-10", sort };
      const all = await listTransactions(params);
      expect(all).toHaveLength(7);

      const joined = [];
      for (let skip = 0; skip < 8; skip += 2) {
        joined.push(...(await listTransactions(params, { skip, take: 2 })));
      }
      expect(joined.map((t) => t.id)).toEqual(all.map((t) => t.id));
      expect(new Set(joined.map((t) => t.id)).size).toBe(7);

      const byId = await db.transaction.findMany({
        orderBy: { id: sort },
        select: { id: true },
      });
      expect(all.map((t) => t.id)).toEqual(byId.map((r) => r.id));
    },
  );

  it("summarizeTransactions는 같은 필터의 목록 건수·금액합과 같다", async () => {
    await create({ occurredOn: "2026-09-14", amount: 1_000, merchant: "커피집" });
    await create({ occurredOn: "2026-10-05", amount: 3_000, merchant: "서점" });
    await create({ occurredOn: "2026-10-06", amount: 4_000, merchant: "커피집" });
    await createTransaction(
      txInput({ type: "INCOME", categoryId: salary, amount: 50_000, occurredOn: "2026-10-07" }),
    );
    const base = { month: "2026-10", sort: "asc" as const };
    const cases = [
      base,
      { ...base, type: "EXPENSE" as const },
      { ...base, type: "INCOME" as const },
      { ...base, period: "all" as const, q: "커피" },
      { ...base, period: { from: "2026-09-01", to: "2026-10-05" } },
    ];
    for (const params of cases) {
      const list = await listTransactions(params);
      const sum = (type: "INCOME" | "EXPENSE") =>
        list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
      expect(await summarizeTransactions(params)).toEqual({
        count: list.length,
        income: sum("INCOME"),
        expense: sum("EXPENSE"),
      });
    }
  });

  it("summarizeTransactions는 0건이면 모두 0이다", async () => {
    expect(await summarizeTransactions({ month: "2026-10", sort: "desc" })).toEqual({
      count: 0,
      income: 0,
      expense: 0,
    });
  });
});
