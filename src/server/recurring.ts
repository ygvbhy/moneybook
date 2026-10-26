import "server-only";
import { db } from "@/lib/db";
import { fromDbDate, shiftMonth, toDbDate } from "@/lib/date";
import { dueDates, occurrenceOnOrAfter } from "@/lib/recurring";
import type { RecurringInput } from "@/lib/validation/recurring";
import type { Prisma } from "@/generated/prisma/client";
import { RECURRING_NOT_FOUND, ServiceError, logSafeError, prismaCode } from "@/server/service-error";

export type RecurringDto = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryArchived: boolean;
  item: string;
  amount: number;
  dayOfMonth: number;
  merchant: string | null;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CREDIT_CARD" | "DEBIT_CARD" | "OTHER" | null;
  memo: string | null;
  nextRunOn: string; // YYYY-MM-DD
};

type Tx = Prisma.TransactionClient;
type RecurringRow = Prisma.RecurringExpenseGetPayload<object>;

/** 카테고리 존재, 지출 유형, 보관 여부 검증. currentCategoryId와 같은 보관 카테고리는 허용 */
async function assertCategoryUsable(
  client: Tx | typeof db,
  categoryId: string,
  currentCategoryId?: string,
) {
  const category = await client.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ServiceError("카테고리를 찾을 수 없습니다");
  if (category.type !== "EXPENSE") {
    throw new ServiceError("고정지출은 지출 카테고리만 사용할 수 있습니다");
  }
  if (category.archivedAt !== null && category.id !== currentCategoryId) {
    throw new ServiceError("보관된 카테고리는 사용할 수 없습니다");
  }
}

export async function listRecurring(): Promise<RecurringDto[]> {
  const rows = await db.recurringExpense.findMany({
    include: { category: { select: { name: true, archivedAt: true } } },
    orderBy: [{ dayOfMonth: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    categoryArchived: row.category.archivedAt !== null,
    item: row.item,
    amount: row.amount,
    dayOfMonth: row.dayOfMonth,
    merchant: row.merchant,
    paymentMethod: row.paymentMethod,
    memo: row.memo,
    nextRunOn: fromDbDate(row.nextRunOn),
  }));
}

export async function createRecurring(input: RecurringInput, today: string): Promise<{ id: string }> {
  await assertCategoryUsable(db, input.categoryId);
  const row = await db.recurringExpense.create({
    data: {
      categoryId: input.categoryId,
      item: input.item,
      amount: input.amount,
      dayOfMonth: input.dayOfMonth,
      merchant: input.merchant,
      paymentMethod: input.paymentMethod,
      memo: input.memo,
      nextRunOn: toDbDate(occurrenceOnOrAfter(input.dayOfMonth, today)),
    },
    select: { id: true },
  });
  return { id: row.id };
}

/**
 * 오늘까지 도래한 발생일의 거래를 만들고 커서를 옮긴다. 마지막 발생일은 lastRunOn에 남긴다.
 * 커서를 조건부로 먼저 옮겨(count 1일 때만 insert) 동시 실행에서도 중복 생성을 막는다.
 */
async function materializeOne(tx: Tx, row: RecurringRow, today: string): Promise<string> {
  const current = fromDbDate(row.nextRunOn);
  const { dates, next } = dueDates(current, row.dayOfMonth, today);
  if (dates.length === 0) return current;
  const moved = await tx.recurringExpense.updateMany({
    where: { id: row.id, nextRunOn: row.nextRunOn },
    data: { nextRunOn: toDbDate(next), lastRunOn: toDbDate(dates[dates.length - 1]) },
  });
  if (moved.count !== 1) return current;
  await tx.transaction.createMany({
    data: dates.map((date) => ({
      type: "EXPENSE" as const,
      amount: row.amount,
      categoryId: row.categoryId,
      item: row.item,
      merchant: row.merchant,
      paymentMethod: row.paymentMethod,
      memo: row.memo,
      purpose: null,
      occurredOn: toDbDate(date),
      recurringExpenseId: row.id,
    })),
  });
  return next;
}

export async function updateRecurring(id: string, input: RecurringInput, today: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "RecurringExpense" WHERE id = ${id} FOR UPDATE`;
    if (locked.length === 0) throw new ServiceError(RECURRING_NOT_FOUND);
    const row = await tx.recurringExpense.findUnique({ where: { id } });
    if (!row) throw new ServiceError(RECURRING_NOT_FOUND);

    await materializeOne(tx, row, today);
    await assertCategoryUsable(tx, input.categoryId, row.categoryId);

    let nextRunOn: string | undefined;
    if (input.dayOfMonth !== row.dayOfMonth) {
      const fresh = await tx.recurringExpense.findUniqueOrThrow({ where: { id } });
      const afterLast = fresh.lastRunOn
        ? `${shiftMonth(fromDbDate(fresh.lastRunOn).slice(0, 7), 1)}-01`
        : today;
      nextRunOn = occurrenceOnOrAfter(input.dayOfMonth, today > afterLast ? today : afterLast);
    }
    await tx.recurringExpense.update({
      where: { id },
      data: {
        categoryId: input.categoryId,
        item: input.item,
        amount: input.amount,
        dayOfMonth: input.dayOfMonth,
        merchant: input.merchant,
        paymentMethod: input.paymentMethod,
        memo: input.memo,
        ...(nextRunOn ? { nextRunOn: toDbDate(nextRunOn) } : {}),
      },
    });
  });
}

export async function deleteRecurring(id: string): Promise<void> {
  try {
    await db.recurringExpense.delete({ where: { id } });
  } catch (e) {
    if (prismaCode(e) === "P2025") throw new ServiceError(RECURRING_NOT_FOUND);
    throw e;
  }
}

/**
 * 도래한 고정지출을 거래로 만든다. 렌더 중 호출되므로 revalidate·cookies를 쓰지 않는다.
 * 항목 하나가 실패하면 로그만 남기고 다음 항목을 처리한다(커서가 그대로라 다음 렌더에서 재시도).
 */
export async function materializeRecurring(today: string): Promise<void> {
  const rows = await db.recurringExpense.findMany({
    where: { nextRunOn: { lte: toDbDate(today) } },
  });
  for (const row of rows) {
    try {
      await db.$transaction((tx) => materializeOne(tx, row, today));
    } catch (e) {
      console.error("[recurring] materialize failed", row.id, logSafeError(e));
    }
  }
}
