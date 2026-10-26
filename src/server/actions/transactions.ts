"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/dal";
import type { ActionResult } from "@/lib/action-result";
import { todayInSeoul } from "@/lib/date";
import { MAX_IMPORT_BYTES, formatTransactionsCsv, parseTransactionsCsv } from "@/lib/transaction-csv";
import { transactionSchema } from "@/lib/validation/transaction";
import { runService, validationFailure } from "@/server/action-utils";
import { listCategories } from "@/server/categories";
import * as svc from "@/server/transactions";

const idSchema = z.string().min(1);

const idsSchema = z.array(z.string().min(1));

const bulkCategorySchema = z.object({ ids: z.unknown(), categoryId: z.string().min(1) });

const MAX_BULK_TRANSACTIONS = 5000;

/** 형식 검증 → 중복 제거 → 건수 검사. 통과하면 고유 id 배열, 아니면 오류 결과 */
function parseBulkIds(raw: unknown): { ids: string[] } | { error: string } {
  const parsed = idsSchema.safeParse(raw);
  if (!parsed.success) return { error: "잘못된 요청입니다" };
  const ids = [...new Set(parsed.data)];
  if (ids.length === 0) return { error: "잘못된 요청입니다" };
  if (ids.length > MAX_BULK_TRANSACTIONS) {
    return { error: "한 번에 최대 5,000건까지 처리할 수 있습니다" };
  }
  return { ids };
}

const exportSchema = z.object({
  scope: z.enum(["filtered", "all"]),
  params: z.record(z.string(), z.string()).optional(),
});

export async function createTransaction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireSession();
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runService(() => svc.createTransaction(parsed.data));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateTransaction(id: string, input: unknown): Promise<ActionResult> {
  await requireSession();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "잘못된 요청입니다" };
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runService(() => svc.updateTransaction(parsedId.data, parsed.data));
  // 이미 삭제된 경우에도 목록이 갱신되도록 항상 revalidate
  revalidatePath("/", "layout");
  return result;
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  await requireSession();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "잘못된 요청입니다" };
  const result = await runService(() => svc.deleteTransaction(parsedId.data));
  revalidatePath("/", "layout");
  return result;
}

export async function deleteTransactions(ids: unknown): Promise<ActionResult<{ count: number }>> {
  await requireSession();
  const parsed = parseBulkIds(ids);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const result = await runService(() => svc.deleteTransactions(parsed.ids));
  // 일부/전부 이미 삭제된 경우에도 목록이 갱신되도록 항상 revalidate
  revalidatePath("/", "layout");
  return result;
}

export async function updateTransactionsCategory(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  await requireSession();
  const body = bulkCategorySchema.safeParse(input);
  if (!body.success) return { ok: false, error: "잘못된 요청입니다" };
  const parsed = parseBulkIds(body.data.ids);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const result = await runService(() =>
    svc.updateTransactionsCategory(parsed.ids, body.data.categoryId),
  );
  revalidatePath("/", "layout");
  return result;
}

export async function exportTransactionsCsv(
  input: unknown,
): Promise<ActionResult<{ filename: string; csv: string; count: number }>> {
  await requireSession();
  const parsed = exportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "잘못된 요청입니다" };
  const { scope, params } = parsed.data;
  const today = todayInSeoul();
  // 읽기 전용이라 revalidate하지 않는다
  return runService(async () => {
    if (scope === "filtered") {
      const listParams = await svc.parseListParams(params ?? {}, today);
      const dtos = await svc.listTransactions(listParams);
      const { period } = listParams;
      const filename =
        period === "all"
          ? `moneybook-all-filtered-${today}.csv`
          : period
            ? `moneybook-${period.from}_${period.to}.csv`
            : `moneybook-${listParams.month}.csv`;
      return {
        filename,
        csv: formatTransactionsCsv(dtos),
        count: dtos.length,
      };
    }
    const dtos = await svc.listAllTransactions();
    return {
      filename: `moneybook-all-${today}.csv`,
      csv: formatTransactionsCsv(dtos),
      count: dtos.length,
    };
  });
}

export async function importTransactionsCsv(text: unknown): Promise<ActionResult<{ count: number }>> {
  await requireSession();
  if (typeof text !== "string") return { ok: false, error: "잘못된 요청입니다" };
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return { ok: false, error: "파일이 너무 큽니다 (최대 800KB)" };
  }
  const categories = await runService(() => listCategories());
  if (!categories.ok) return categories;
  const parsed = parseTransactionsCsv(text, categories.data ?? []);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
      ...(parsed.rowErrors ? { fieldErrors: { rows: parsed.rowErrors } } : {}),
    };
  }
  const result = await runService(() => svc.importTransactions(parsed.inputs));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
