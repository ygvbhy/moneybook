import "server-only";
import { db } from "@/lib/db";
import type { CategoryInput } from "@/lib/validation/category";
import {
  CATEGORY_DUPLICATE,
  CATEGORY_NOT_FOUND,
  ServiceError,
  prismaCode,
} from "@/server/service-error";

export type CategoryDto = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  sortOrder: number;
  archived: boolean;
};

export async function listCategories(): Promise<CategoryDto[]> {
  const rows = await db.category.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    sortOrder: c.sortOrder,
    archived: c.archivedAt !== null,
  }));
}

function mapError(e: unknown): never {
  const code = prismaCode(e);
  if (code === "P2002") throw new ServiceError(CATEGORY_DUPLICATE);
  if (code === "P2025") throw new ServiceError(CATEGORY_NOT_FOUND);
  throw e;
}

export async function createCategory(input: CategoryInput): Promise<{ id: string }> {
  const max = await db.category.aggregate({
    where: { type: input.type },
    _max: { sortOrder: true },
  });
  try {
    const row = await db.category.create({
      data: { name: input.name, type: input.type, sortOrder: (max._max.sortOrder ?? -1) + 1 },
      select: { id: true },
    });
    return { id: row.id };
  } catch (e) {
    mapError(e);
  }
}

/** 유형은 바꿀 수 없다 (이름만 변경) */
export async function renameCategory(id: string, name: string): Promise<void> {
  try {
    await db.category.update({ where: { id }, data: { name } });
  } catch (e) {
    mapError(e);
  }
}

export async function archiveCategory(id: string): Promise<void> {
  try {
    await db.category.update({ where: { id }, data: { archivedAt: new Date() } });
  } catch (e) {
    mapError(e);
  }
}

export async function restoreCategory(id: string): Promise<void> {
  try {
    await db.category.update({ where: { id }, data: { archivedAt: null } });
  } catch (e) {
    mapError(e);
  }
}
