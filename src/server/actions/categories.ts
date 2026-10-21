"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/dal";
import type { ActionResult } from "@/lib/action-result";
import { categoryNameSchema, categorySchema } from "@/lib/validation/category";
import { runService, validationFailure } from "@/server/action-utils";
import * as svc from "@/server/categories";

const idSchema = z.string().min(1);

export async function createCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireSession();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runService(() => svc.createCategory(parsed.data));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function renameCategory(id: string, name: unknown): Promise<ActionResult> {
  await requireSession();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "잘못된 요청입니다" };
  const parsed = z.object({ name: categoryNameSchema }).safeParse({ name });
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runService(() => svc.renameCategory(parsedId.data, parsed.data.name));
  revalidatePath("/", "layout");
  return result;
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  await requireSession();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "잘못된 요청입니다" };
  const result = await runService(() => svc.archiveCategory(parsedId.data));
  revalidatePath("/", "layout");
  return result;
}

export async function restoreCategory(id: string): Promise<ActionResult> {
  await requireSession();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "잘못된 요청입니다" };
  const result = await runService(() => svc.restoreCategory(parsedId.data));
  revalidatePath("/", "layout");
  return result;
}
