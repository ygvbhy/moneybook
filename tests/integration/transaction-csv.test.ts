import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { fromDbDate } from "@/lib/date";
import { MAX_IMPORT_BYTES, TRANSACTION_CSV_HEADERS, parseCsv } from "@/lib/transaction-csv";
import {
  createTransaction,
  exportTransactionsCsv,
  importTransactionsCsv,
} from "@/server/actions/transactions";
import * as categoriesSvc from "@/server/categories";
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

async function create(over: Record<string, unknown> = {}) {
  const r = await createTransaction(txInput({ categoryId: food, ...over }));
  if (!r.ok) throw new Error(`create failed: ${r.error}`);
}

/** 내보내기 결과를 데이터 행(헤더 제외)으로 읽는다 */
function dataRows(csv: string) {
  const parsed = parseCsv(csv);
  if (!parsed.ok) throw new Error("CSV 파싱 실패");
  return parsed.rows.slice(1);
}

async function exportOk(input: unknown) {
  const r = await exportTransactionsCsv(input);
  if (!r.ok) throw new Error(`export failed: ${r.error}`);
  return r.data!;
}

const HEADER_LINE = TRANSACTION_CSV_HEADERS.join(",");

async function snapshot() {
  const rows = await db.transaction.findMany({ include: { category: true } });
  return rows
    .map((t) => ({
      type: t.type,
      amount: t.amount,
      occurredOn: fromDbDate(t.occurredOn),
      category: t.category.name,
      merchant: t.merchant,
      item: t.item,
      purpose: t.purpose,
      paymentMethod: t.paymentMethod,
      memo: t.memo,
    }))
    .sort((a, b) =>
      `${a.occurredOn}|${a.amount}|${a.merchant}`.localeCompare(
        `${b.occurredOn}|${b.amount}|${b.merchant}`,
      ),
    );
}

describe("CSV 내보내기", () => {
  it("filtered: 월·유형·카테고리·검색·정렬을 반영한다", async () => {
    await create({ occurredOn: "2026-10-05", amount: 1_000, merchant: "편의점" });
    await create({ occurredOn: "2026-10-20", amount: 2_000, merchant: "편의점" });
    await create({ occurredOn: "2026-10-10", amount: 3_000, merchant: "식당", categoryId: transport });
    await create({ occurredOn: "2026-09-30", amount: 4_000, merchant: "편의점" });
    await create({
      type: "INCOME",
      categoryId: salary,
      occurredOn: "2026-10-25",
      amount: 5_000,
      merchant: "회사",
    });

    const month = await exportOk({ scope: "filtered", params: { month: "2026-10", sort: "asc" } });
    expect(month.filename).toBe("moneybook-2026-10.csv");
    expect(month.count).toBe(4);
    expect(dataRows(month.csv).map((r) => r[0])).toEqual([
      "2026-10-05",
      "2026-10-10",
      "2026-10-20",
      "2026-10-25",
    ]);

    const desc = await exportOk({ scope: "filtered", params: { month: "2026-10" } });
    expect(dataRows(desc.csv).map((r) => r[0])[0]).toBe("2026-10-25");

    const income = await exportOk({ scope: "filtered", params: { month: "2026-10", type: "INCOME" } });
    expect(dataRows(income.csv).map((r) => r[4])).toEqual(["회사"]);

    const byCategory = await exportOk({
      scope: "filtered",
      params: { month: "2026-10", category: transport, sort: "asc" },
    });
    expect(dataRows(byCategory.csv).map((r) => r[4])).toEqual(["식당"]);

    const search = await exportOk({
      scope: "filtered",
      params: { month: "2026-10", q: "편의", sort: "asc" },
    });
    expect(search.count).toBe(2);
    expect(dataRows(search.csv).map((r) => r[2])).toEqual(["1000", "2000"]);
  });

  it("all: 여러 달을 날짜 오름차순으로 담고 filename 형식이 맞다", async () => {
    await create({ occurredOn: "2026-10-05", amount: 3 });
    await create({ occurredOn: "2025-12-31", amount: 1 });
    await create({ occurredOn: "2026-03-15", amount: 2 });

    const data = await exportOk({ scope: "all" });
    expect(data.filename).toMatch(/^moneybook-all-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(data.count).toBe(3);
    expect(data.csv.startsWith("﻿" + HEADER_LINE)).toBe(true);
    expect(dataRows(data.csv).map((r) => r[0])).toEqual(["2025-12-31", "2026-03-15", "2026-10-05"]);
  });

  it("결과가 0건이면 count 0이고 헤더만 있다", async () => {
    const data = await exportOk({ scope: "filtered", params: { month: "2026-10" } });
    expect(data.count).toBe(0);
    expect(dataRows(data.csv)).toEqual([]);
    expect((await exportOk({ scope: "all" })).count).toBe(0);
  });

  it("잘못된 입력은 거부한다", async () => {
    expect(await exportTransactionsCsv({ scope: "x" })).toEqual({
      ok: false,
      error: "잘못된 요청입니다",
    });
    expect(await exportTransactionsCsv(null)).toEqual({ ok: false, error: "잘못된 요청입니다" });
  });
});

describe("CSV 가져오기", () => {
  it("정상 CSV는 count와 DB에 반영된다", async () => {
    const csv = [
      HEADER_LINE,
      "2026-10-01,지출,12000,식비,편의점,도시락,점심,신용카드,메모",
      "2026-10-02,수입,3000000,급여,회사,,,계좌이체,",
    ].join("\r\n");
    expect(await importTransactionsCsv(csv)).toEqual({ ok: true, data: { count: 2 } });
    const rows = await snapshot();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: "EXPENSE",
      amount: 12_000,
      occurredOn: "2026-10-01",
      category: "식비",
      merchant: "편의점",
      paymentMethod: "CREDIT_CARD",
      memo: "메모",
    });
    expect(rows[1]).toMatchObject({ type: "INCOME", category: "급여", item: null });
  });

  it("오류 행이 하나라도 있으면 아무것도 추가되지 않고 행 번호를 돌려준다", async () => {
    const csv = [
      HEADER_LINE,
      "2026-10-01,지출,12000,식비,,,,,",
      "2026-10-02,지출,abc,식비,,,,,",
      "2026-10-03,지출,500,없는카테고리,,,,,",
    ].join("\n");
    const r = await importTransactionsCsv(csv);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.fieldErrors?.rows).toEqual(
      expect.arrayContaining([expect.stringContaining("3행"), expect.stringContaining("4행")]),
    );
    expect(await db.transaction.count()).toBe(0);
  });

  it("5,000행을 가져올 수 있다", async () => {
    const lines = [HEADER_LINE];
    for (let i = 0; i < 5000; i++) {
      lines.push(`2026-10-${String((i % 28) + 1).padStart(2, "0")},지출,${i + 1},식비,,,,,`);
    }
    const csv = lines.join("\n");
    expect(new TextEncoder().encode(csv).length).toBeLessThanOrEqual(MAX_IMPORT_BYTES);
    expect(await importTransactionsCsv(csv)).toEqual({ ok: true, data: { count: 5000 } });
    expect(await db.transaction.count()).toBe(5000);
  });

  it("바이트 상한을 넘으면 거부한다", async () => {
    const r = await importTransactionsCsv("a".repeat(MAX_IMPORT_BYTES + 1));
    expect(r).toEqual({ ok: false, error: "파일이 너무 큽니다 (최대 800KB)" });
    expect(await db.transaction.count()).toBe(0);
  });

  it("카테고리 조회가 실패하면 일반 오류를 돌려준다", async () => {
    const spy = vi.spyOn(categoriesSvc, "listCategories").mockRejectedValueOnce(new Error("db down"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await importTransactionsCsv(`${HEADER_LINE}\n2026-10-01,지출,12000,식비,,,,,`);
    expect(r).toEqual({ ok: false, error: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요" });
    expect(await db.transaction.count()).toBe(0);
    spy.mockRestore();
    errorLog.mockRestore();
  });

  it("문자열이 아니면 거부한다", async () => {
    for (const bad of [undefined, null, 123, { csv: "x" }]) {
      expect(await importTransactionsCsv(bad)).toEqual({ ok: false, error: "잘못된 요청입니다" });
    }
  });
});

describe("CSV 왕복", () => {
  it("전체 내보내기 → 초기화 → 가져오기하면 같은 거래가 복원된다", async () => {
    await create({
      occurredOn: "2026-10-01",
      amount: 12_500,
      merchant: '쉼표, "따옴표" 상점',
      item: "줄\n바꿈",
      purpose: "테스트",
      paymentMethod: "CREDIT_CARD",
      memo: "메모",
    });
    await create({ occurredOn: "2026-01-15", amount: 7_000, categoryId: transport });
    await create({
      type: "INCOME",
      categoryId: salary,
      occurredOn: "2026-10-25",
      amount: 3_000_000,
      merchant: "회사",
      paymentMethod: "BANK_TRANSFER",
    });
    await create({ occurredOn: "2026-10-01", amount: 900, merchant: "같은날" });

    const before = await snapshot();
    const { csv, count } = await exportOk({ scope: "all" });
    expect(count).toBe(4);

    await resetDb();
    await loginAsTest();
    expect(await importTransactionsCsv(csv)).toEqual({ ok: true, data: { count: 4 } });
    expect(await snapshot()).toEqual(before);
  });
});
