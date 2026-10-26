import "server-only";
import { db } from "@/lib/db";
import {
  fromDbDate,
  isValidPeriodDate,
  monthRange,
  normalizeMonthParam,
  toDbDate,
} from "@/lib/date";
import {
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  type TransactionInput,
} from "@/lib/validation/transaction";
import type { Prisma } from "@/generated/prisma/client";
import {
  CATEGORY_ARCHIVED,
  CATEGORY_MISSING,
  CATEGORY_TYPE_MISMATCH,
  ServiceError,
  TX_NOT_FOUND,
  prismaCode,
} from "@/server/service-error";

export type TransactionDto = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  occurredOn: string; // YYYY-MM-DD
  categoryId: string;
  categoryName: string;
  categoryArchived: boolean;
  merchant: string | null;
  item: string | null;
  purpose: string | null;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CREDIT_CARD" | "DEBIT_CARD" | "OTHER" | null;
  memo: string | null;
};

const withCategory = { category: { select: { name: true, archivedAt: true } } } as const;

type TxRow = Prisma.TransactionGetPayload<{ include: typeof withCategory }>;

export function toTransactionDto(row: TxRow): TransactionDto {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    occurredOn: fromDbDate(row.occurredOn),
    categoryId: row.categoryId,
    categoryName: row.category.name,
    categoryArchived: row.category.archivedAt !== null,
    merchant: row.merchant,
    item: row.item,
    purpose: row.purpose,
    paymentMethod: row.paymentMethod,
    memo: row.memo,
  };
}

/** 카테고리 존재, 유형 일치, 보관 여부 검증. currentCategoryId와 같은 보관 카테고리는 허용 */
async function assertCategoryUsable(input: TransactionInput, currentCategoryId?: string) {
  const category = await db.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new ServiceError(CATEGORY_MISSING);
  if (category.type !== input.type) {
    throw new ServiceError(CATEGORY_TYPE_MISMATCH);
  }
  if (category.archivedAt !== null && category.id !== currentCategoryId) {
    throw new ServiceError(CATEGORY_ARCHIVED);
  }
}

function toData(input: TransactionInput) {
  return {
    type: input.type,
    amount: input.amount,
    occurredOn: toDbDate(input.occurredOn),
    categoryId: input.categoryId,
    merchant: input.merchant,
    item: input.item,
    purpose: input.purpose,
    paymentMethod: input.paymentMethod,
    memo: input.memo,
  };
}

export async function createTransaction(input: TransactionInput): Promise<{ id: string }> {
  await assertCategoryUsable(input);
  const row = await db.transaction.create({ data: toData(input), select: { id: true } });
  return { id: row.id };
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  const existing = await db.transaction.findUnique({
    where: { id },
    select: { categoryId: true },
  });
  if (!existing) throw new ServiceError(TX_NOT_FOUND);
  await assertCategoryUsable(input, existing.categoryId);
  try {
    await db.transaction.update({ where: { id }, data: toData(input) });
  } catch (e) {
    if (prismaCode(e) === "P2025") throw new ServiceError(TX_NOT_FOUND);
    throw e;
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  try {
    await db.transaction.delete({ where: { id } });
  } catch (e) {
    if (prismaCode(e) === "P2025") throw new ServiceError(TX_NOT_FOUND);
    throw e;
  }
}

/** 선택한 거래 일괄 삭제. 이미 없는 id는 무시하고, 하나도 없으면 TX_NOT_FOUND */
export async function deleteTransactions(ids: string[]): Promise<{ count: number }> {
  const { count } = await db.transaction.deleteMany({ where: { id: { in: ids } } });
  if (count === 0) throw new ServiceError(TX_NOT_FOUND);
  return { count };
}

/**
 * 선택한 거래의 카테고리 일괄 변경. 대상 카테고리는 활성이어야 하고 모든 거래와 유형이 같아야 한다
 * (하나라도 다르면 아무것도 바꾸지 않는다). recurringExpenseId는 건드리지 않는다.
 */
export async function updateTransactionsCategory(
  ids: string[],
  categoryId: string,
): Promise<{ count: number }> {
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ServiceError(CATEGORY_MISSING);
  if (category.archivedAt !== null) throw new ServiceError(CATEGORY_ARCHIVED);
  const rows = await db.transaction.findMany({
    where: { id: { in: ids } },
    select: { type: true },
  });
  if (rows.length === 0) throw new ServiceError(TX_NOT_FOUND);
  if (rows.some((r) => r.type !== category.type)) throw new ServiceError(CATEGORY_TYPE_MISMATCH);
  // where에 type을 넣어 조회-갱신 사이 경합에도 유형이 어긋난 거래는 쓰지 않는다
  const { count } = await db.transaction.updateMany({
    where: { id: { in: ids }, type: category.type },
    data: { categoryId },
  });
  if (count === 0) throw new ServiceError(TX_NOT_FOUND);
  return { count };
}

export async function getTransaction(id: string): Promise<TransactionDto | null> {
  const row = await db.transaction.findUnique({ where: { id }, include: withCategory });
  return row ? toTransactionDto(row) : null;
}

const IMPORT_CHUNK_SIZE = 1000;

/**
 * CSV 가져오기용 일괄 등록. 전부 성공하거나 전부 롤백된다.
 * categoryId는 호출자가 parseTransactionsCsv로 존재·유형·보관 여부를 검증했어야 한다.
 */
export async function importTransactions(inputs: TransactionInput[]): Promise<{ count: number }> {
  const chunks: TransactionInput[][] = [];
  for (let i = 0; i < inputs.length; i += IMPORT_CHUNK_SIZE) {
    chunks.push(inputs.slice(i, i + IMPORT_CHUNK_SIZE));
  }
  const results = await db.$transaction(
    chunks.map((chunk) => db.transaction.createMany({ data: chunk.map(toData) })),
  );
  return { count: results.reduce((sum, r) => sum + r.count, 0) };
}

export type SortDirection = "asc" | "desc";

/** 조회 기간. 양끝 포함 날짜 범위 또는 전체 기간. 없으면(ListParams.period 미지정) month 범위 */
export type ListPeriod = { from: string; to: string } | "all";

export type ListParams = {
  month: string;
  period?: ListPeriod;
  type?: "INCOME" | "EXPENSE";
  categoryId?: string;
  paymentMethod?: (typeof PAYMENT_METHODS)[number] | "none"; // "none" = 결제수단 미지정
  q?: string;
  sort: SortDirection;
};

export async function listTransactions(params: ListParams): Promise<TransactionDto[]> {
  const q = params.q?.trim();
  let occurredOn: Prisma.TransactionWhereInput["occurredOn"];
  if (params.period === "all") {
    occurredOn = undefined;
  } else if (params.period) {
    occurredOn = { gte: toDbDate(params.period.from), lte: toDbDate(params.period.to) };
  } else {
    const { start, endExclusive } = monthRange(params.month);
    occurredOn = { gte: toDbDate(start), lt: toDbDate(endExclusive) };
  }
  const rows = await db.transaction.findMany({
    where: {
      ...(occurredOn ? { occurredOn } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.paymentMethod
        ? { paymentMethod: params.paymentMethod === "none" ? null : params.paymentMethod }
        : {}),
      ...(q
        ? {
            OR: [
              { merchant: { contains: q, mode: "insensitive" } },
              { item: { contains: q, mode: "insensitive" } },
              { memo: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: withCategory,
    orderBy: [{ occurredOn: params.sort }, { createdAt: params.sort }],
  });
  return rows.map(toTransactionDto);
}

/** CSV 내보내기용 전체 거래. 오래된 순, 같은 시각이면 id로 안정 정렬 */
export async function listAllTransactions(): Promise<TransactionDto[]> {
  const rows = await db.transaction.findMany({
    include: withCategory,
    orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toTransactionDto);
}

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * URL search params 정규화 (잘못된 값은 오류 없이 기본값/무시).
 * month 오류 → today가 속한 달, type 알 수 없음 → 무시, category가 DB에 없으면 무시,
 * payment는 결제수단 값 또는 "none"(미지정)만 인정하고 나머지는 무시,
 * sort는 "asc"만 인정하고 나머지는 "desc", q는 trim 후 최대 100자(빈 값은 무시).
 * 기간: range=all이면 "all"(from/to보다 우선), 아니면 from·to가 둘 다 isValidPeriodDate이고
 * from <= to일 때만 { from, to }, 그 외는 무시(period 없음 → month 범위).
 */
export async function parseListParams(
  searchParams: SearchParams,
  today: string,
): Promise<ListParams> {
  const month = normalizeMonthParam(first(searchParams.month), today);

  const rawType = first(searchParams.type);
  const type = (TRANSACTION_TYPES as readonly string[]).includes(rawType ?? "")
    ? (rawType as ListParams["type"])
    : undefined;

  const rawCategory = first(searchParams.category);
  let categoryId: string | undefined;
  if (rawCategory) {
    const found = await db.category.findUnique({
      where: { id: rawCategory },
      select: { id: true },
    });
    categoryId = found?.id;
  }

  const rawPayment = first(searchParams.payment);
  const paymentMethod =
    rawPayment === "none" || (PAYMENT_METHODS as readonly string[]).includes(rawPayment ?? "")
      ? (rawPayment as ListParams["paymentMethod"])
      : undefined;

  const q = first(searchParams.q)?.trim().slice(0, 100) || undefined;
  const sort: SortDirection = first(searchParams.sort) === "asc" ? "asc" : "desc";

  const rawFrom = first(searchParams.from);
  const rawTo = first(searchParams.to);
  let period: ListPeriod | undefined;
  if (first(searchParams.range) === "all") period = "all";
  else if (isValidPeriodDate(rawFrom) && isValidPeriodDate(rawTo) && rawFrom <= rawTo) {
    period = { from: rawFrom, to: rawTo };
  }

  return { month, period, type, categoryId, paymentMethod, q, sort };
}
