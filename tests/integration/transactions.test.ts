import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/server/actions/transactions";
import { archiveCategory, createCategory } from "@/server/actions/categories";
import { getMonthSummary, getMonthlyTrend, getRecentCategoryIds } from "@/server/dashboard";
import { getDailyTotals, listTransactionsByDate } from "@/server/calendar";
import { getTransaction, listTransactions, parseListParams } from "@/server/transactions";
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

describe("URL 파라미터 정규화", () => {
  const today = "2026-10-21";
  it("기본값", async () => {
    expect(await parseListParams({}, today)).toEqual({
      month: "2026-10",
      type: undefined,
      categoryId: undefined,
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
  it("유효한 값은 유지, 배열은 첫 값", async () => {
    const p = await parseListParams(
      { month: ["2026-09", "x"], type: "INCOME", category: salary, sort: "asc", q: " 커피 " },
      today,
    );
    expect(p).toEqual({
      month: "2026-09",
      type: "INCOME",
      categoryId: salary,
      q: "커피",
      sort: "asc",
    });
  });
});
