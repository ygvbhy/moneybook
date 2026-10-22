import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { fromDbDate } from "@/lib/date";
import {
  createRecurring as createAction,
  deleteRecurring as deleteAction,
  updateRecurring as updateAction,
} from "@/server/actions/recurring";
import { archiveCategory } from "@/server/actions/categories";
import {
  createRecurring,
  deleteRecurring,
  listRecurring,
  materializeRecurring,
  updateRecurring,
} from "@/server/recurring";
import { occurrenceOnOrAfter } from "@/lib/recurring";
import { categoryId, loginAsTest, resetDb } from "../setup/db";

const MSG_GONE = "이미 삭제되었거나 존재하지 않는 고정지출입니다";
const TODAY = "2026-10-21";

let food: string;
let salary: string;

beforeEach(async () => {
  await resetDb();
  await loginAsTest();
  food = await categoryId("식비");
  salary = await categoryId("급여", "INCOME");
});

function input(over: Record<string, unknown> = {}) {
  return {
    categoryId: food,
    item: "월세",
    amount: 500_000,
    dayOfMonth: 25,
    merchant: null,
    memo: null,
    paymentMethod: null,
    ...over,
  } as Parameters<typeof createRecurring>[0];
}

async function create(over: Record<string, unknown> = {}, today = TODAY) {
  return (await createRecurring(input(over), today)).id;
}

async function cursor(id: string) {
  return fromDbDate((await db.recurringExpense.findUniqueOrThrow({ where: { id } })).nextRunOn);
}

async function lastRun(id: string) {
  const row = await db.recurringExpense.findUniqueOrThrow({ where: { id } });
  return row.lastRunOn ? fromDbDate(row.lastRunOn) : null;
}

async function txDates(id: string) {
  const rows = await db.transaction.findMany({
    where: { recurringExpenseId: id },
    orderBy: { occurredOn: "asc" },
  });
  return rows.map((r) => fromDbDate(r.occurredOn));
}

describe("고정지출 생성과 멱등", () => {
  it("등록하면 nextRunOn이 occurrenceOnOrAfter(day, today)와 같다", async () => {
    for (const day of [5, 21, 25, 31]) {
      const id = await create({ dayOfMonth: day });
      expect(await cursor(id)).toBe(occurrenceOnOrAfter(day, TODAY));
    }
    const list = await listRecurring();
    expect(list.map((r) => r.dayOfMonth)).toEqual([5, 21, 25, 31]);
    expect(list[0]).toMatchObject({ categoryName: "식비", categoryArchived: false, nextRunOn: "2026-11-05" });
  });

  it("도래일에 거래가 1건 생기고 필드가 맞으며, 다시 호출해도 건수가 같다", async () => {
    const id = await create({
      dayOfMonth: 25,
      merchant: "집주인",
      paymentMethod: "BANK_TRANSFER",
      memo: "10월분",
    });
    await materializeRecurring("2026-10-24");
    expect(await db.transaction.count()).toBe(0);

    await materializeRecurring("2026-10-25");
    await materializeRecurring("2026-10-25");
    const rows = await db.transaction.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "EXPENSE",
      item: "월세",
      amount: 500_000,
      categoryId: food,
      merchant: "집주인",
      paymentMethod: "BANK_TRANSFER",
      memo: "10월분",
      purpose: null,
      recurringExpenseId: id,
    });
    expect(fromDbDate(rows[0].occurredOn)).toBe("2026-10-25");
    expect(await cursor(id)).toBe("2026-11-25");
  });

  it("3개월 밀린 경우 3건이 생긴다", async () => {
    const id = await create({ dayOfMonth: 31 }, "2026-08-01");
    await materializeRecurring("2026-10-31");
    expect(await txDates(id)).toEqual(["2026-08-31", "2026-09-30", "2026-10-31"]);
    expect(await cursor(id)).toBe("2026-11-30");
    expect(await lastRun(id)).toBe("2026-10-31");
  });

  it("자동 거래를 삭제한 뒤 다시 호출해도 되살아나지 않는다", async () => {
    await create({ dayOfMonth: 25 });
    await materializeRecurring("2026-10-25");
    await db.transaction.deleteMany();
    await materializeRecurring("2026-10-25");
    expect(await db.transaction.count()).toBe(0);
  });
});

describe("동시성", () => {
  it("materialize 5회 동시 호출 시 1건만 생긴다", async () => {
    await create({ dayOfMonth: 25 });
    await Promise.all(Array.from({ length: 5 }, () => materializeRecurring("2026-10-25")));
    expect(await db.transaction.count()).toBe(1);
  });

  it("수정(일자 변경)과 materialize를 동시에 호출해도 같은 달 거래가 1건 이하다", async () => {
    for (let i = 0; i < 5; i++) {
      await resetDb();
      food = await categoryId("식비");
      const id = await create({ dayOfMonth: 25 });
      await Promise.all([
        updateRecurring(id, input({ dayOfMonth: 22 }), "2026-10-25"),
        materializeRecurring("2026-10-25"),
        materializeRecurring("2026-10-25"),
      ]);
      const dates = await txDates(id);
      expect(dates.filter((d) => d.startsWith("2026-10")).length).toBeLessThanOrEqual(1);
      expect(await db.transaction.count()).toBeLessThanOrEqual(1);
    }
  });
});

describe("자동 등록 실패 격리", () => {
  it("한 항목이 실패해도 나머지는 등록되고, 실패 항목은 롤백·로그되며 삭제할 수 있다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const ids = [await create(), await create(), await create()];
      const broken = ids[1];
      const healthy = [ids[0], ids[2]];
      await db.recurringExpense.update({ where: { id: broken }, data: { dayOfMonth: 0 } });

      await expect(materializeRecurring("2026-10-25")).resolves.toBeUndefined();

      for (const id of healthy) {
        expect(await txDates(id)).toEqual(["2026-10-25"]);
        expect(await cursor(id)).toBe("2026-11-25");
      }
      expect(await txDates(broken)).toEqual([]);
      expect(await cursor(broken)).toBe("2026-10-25");
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]).toContain(broken);

      await deleteRecurring(broken);
      errorSpy.mockClear();
      await materializeRecurring("2026-10-25");
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("고정지출 수정", () => {
  it("이번 달 것이 이미 생성된 뒤 일자를 바꾸면 다음 달부터다", async () => {
    const id = await create({ dayOfMonth: 5 }, "2026-10-01");
    await updateRecurring(id, input({ dayOfMonth: 28 }), TODAY);
    expect(await txDates(id)).toEqual(["2026-10-05"]);
    expect(await cursor(id)).toBe("2026-11-28");
  });

  it("등록 시 건너뛴 이번 달 날짜로 바꾸면 이번 달에 생성된다", async () => {
    const id = await create({ dayOfMonth: 20 });
    expect(await cursor(id)).toBe("2026-11-20");
    await updateRecurring(id, input({ dayOfMonth: 21 }), TODAY);
    expect(await cursor(id)).toBe("2026-10-21");
    await materializeRecurring(TODAY);
    expect(await txDates(id)).toEqual(["2026-10-21"]);
    expect(await lastRun(id)).toBe("2026-10-21");
  });

  it("생성 전이고 새 날짜가 이미 지났으면 다음 달부터다", async () => {
    const id = await create({ dayOfMonth: 25 });
    await updateRecurring(id, input({ dayOfMonth: 10 }), TODAY);
    expect(await cursor(id)).toBe("2026-11-10");
    expect(await db.transaction.count()).toBe(0);
  });

  it("생성 전이고 새 날짜가 아직이면 이번 달이다", async () => {
    const id = await create({ dayOfMonth: 25 });
    await updateRecurring(id, input({ dayOfMonth: 28 }), TODAY);
    expect(await cursor(id)).toBe("2026-10-28");
    await updateRecurring(id, input({ dayOfMonth: 21 }), TODAY);
    expect(await cursor(id)).toBe("2026-10-21");
  });

  it("일자를 바꾸지 않으면 커서가 그대로다", async () => {
    const id = await create({ dayOfMonth: 25 });
    await updateRecurring(id, input({ dayOfMonth: 25, item: "관리비" }), TODAY);
    expect(await cursor(id)).toBe("2026-10-25");
    expect((await listRecurring())[0].item).toBe("관리비");
  });

  it("금액을 바꿔도 기존 거래는 그대로이고 다음 생성분에 새 금액이 들어간다", async () => {
    const id = await create({ dayOfMonth: 25 }, "2026-09-01");
    await materializeRecurring("2026-09-25");
    await updateRecurring(id, input({ dayOfMonth: 25, amount: 600_000 }), "2026-09-26");
    await materializeRecurring("2026-10-25");
    const rows = await db.transaction.findMany({ orderBy: { occurredOn: "asc" } });
    expect(rows.map((r) => r.amount)).toEqual([500_000, 600_000]);
  });

  it("현재 카테고리가 보관된 항목도 같은 카테고리로 수정할 수 있다", async () => {
    const id = await create({ dayOfMonth: 25 });
    await db.category.update({ where: { id: food }, data: { archivedAt: new Date() } });
    await expect(updateRecurring(id, input({ amount: 1_000 }), TODAY)).resolves.toBeUndefined();
    const other = await categoryId("교통");
    await db.category.update({ where: { id: other }, data: { archivedAt: new Date() } });
    await expect(updateRecurring(id, input({ categoryId: other }), TODAY)).rejects.toThrow(
      "보관된 카테고리",
    );
  });
});

describe("삭제와 보관", () => {
  it("삭제하면 거래는 남고 recurringExpenseId가 null이다", async () => {
    const id = await create({ dayOfMonth: 25 });
    await materializeRecurring("2026-10-25");
    await deleteRecurring(id);
    const rows = await db.transaction.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].recurringExpenseId).toBeNull();
  });

  it("없는 id를 수정·삭제하면 안내 메시지가 나온다", async () => {
    await expect(updateRecurring("nope", input(), TODAY)).rejects.toThrow(MSG_GONE);
    await expect(deleteRecurring("nope")).rejects.toThrow(MSG_GONE);
    expect(await updateAction("nope", input())).toEqual({ ok: false, error: MSG_GONE });
    expect(await deleteAction("nope")).toEqual({ ok: false, error: MSG_GONE });
  });

  it("카테고리를 보관한 뒤에도 자동 생성이 계속된다", async () => {
    const id = await create({ dayOfMonth: 25 });
    expect((await archiveCategory(food)).ok).toBe(true);
    await materializeRecurring("2026-10-25");
    expect(await txDates(id)).toEqual(["2026-10-25"]);
    expect((await listRecurring())[0].categoryArchived).toBe(true);
  });
});

describe("검증", () => {
  it("수입 카테고리는 거부한다", async () => {
    await expect(createRecurring(input({ categoryId: salary }), TODAY)).rejects.toThrow("지출 카테고리");
    expect((await createAction(input({ categoryId: salary }))).ok).toBe(false);
  });

  it("보관 카테고리로 등록하면 거부한다", async () => {
    await db.category.update({ where: { id: food }, data: { archivedAt: new Date() } });
    await expect(createRecurring(input(), TODAY)).rejects.toThrow("보관된 카테고리");
    expect((await createAction(input())).ok).toBe(false);
    expect(await db.recurringExpense.count()).toBe(0);
  });

  it("일자 0/32/1.5, 금액 0, 빈 지출 내역은 거부한다", async () => {
    for (const over of [
      { dayOfMonth: 0 },
      { dayOfMonth: 32 },
      { dayOfMonth: 1.5 },
      { amount: 0 },
      { item: "   " },
    ]) {
      const r = await createAction(input(over));
      expect(r.ok).toBe(false);
    }
    expect(await db.recurringExpense.count()).toBe(0);
    const empty = await createAction(input({ item: "" }));
    expect(!empty.ok && empty.fieldErrors?.item).toEqual(["지출 내역을 입력하세요"]);
  });

  it("action으로 등록·수정·삭제가 동작한다", async () => {
    const r = await createAction(input({ paymentMethod: "" }));
    if (!r.ok) throw new Error(r.error);
    const id = r.data!.id;
    expect(await updateAction(id, input({ amount: 1_000 }))).toEqual({ ok: true });
    expect((await listRecurring())[0].amount).toBe(1_000);
    expect(await deleteAction(id)).toEqual({ ok: true });
  });
});
