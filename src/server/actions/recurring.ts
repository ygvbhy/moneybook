"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/dal";
import type { ActionResult } from "@/lib/action-result";
import { todayInSeoul } from "@/lib/date";
import { recurringSchema } from "@/lib/validation/recurring";
import { runService, validationFailure } from "@/server/action-utils";
import * as svc from "@/server/recurring";

const idSchema = z.string().min(1);

export async function createRecurring(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireSession();
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runService(() => svc.createRecurring(parsed.data, todayInSeoul()));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateRecurring(id: string, input: unknown): Promise<ActionResult> {
  await requireSession();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "잘못된 요청입니다" };
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runService(() =>
    svc.updateRecurring(parsedId.data, parsed.data, todayInSeoul()),
  );
  // 수정 중 자동 생성이 일어날 수 있고, 이미 삭제된 경우에도 목록이 갱신되도록 항상 revalidate
  revalidatePath("/", "layout");
  return result;
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  await requireSession();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "잘못된 요청입니다" };
  const result = await runService(() => svc.deleteRecurring(parsedId.data));
  revalidatePath("/", "layout");
  return result;
}
