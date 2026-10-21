"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/dal";
import type { ActionResult } from "@/lib/action-result";
import { categoryBudgetSchema, totalBudgetSchema } from "@/lib/validation/budget";
import { runService, validationFailure } from "@/server/action-utils";
import * as svc from "@/server/budgets";

/** amount가 null/빈 값이면 미설정(행 삭제) */
export async function setTotalBudget(input: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = totalBudgetSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runService(() =>
    svc.setTotalBudget(parsed.data.yearMonth, parsed.data.amount),
  );
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function setCategoryBudget(input: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = categoryBudgetSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runService(() =>
    svc.setCategoryBudget(parsed.data.yearMonth, parsed.data.categoryId, parsed.data.amount),
  );
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
