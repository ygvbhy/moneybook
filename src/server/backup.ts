import "server-only";
import { db } from "@/lib/db";
import { fromDbDate, toDbDate } from "@/lib/date";
import type { Backup, BackupCounts } from "@/lib/validation/backup";
import { BACKUP_FORMAT, BACKUP_VERSION } from "@/lib/validation/backup";
import { toBackupTransaction } from "@/server/transactions";

const RESTORE_CHUNK_SIZE = 1000;

export function countBackup(b: Backup): BackupCounts {
  return {
    categories: b.categories.length,
    transactions: b.transactions.length,
    recurringExpenses: b.recurringExpenses.length,
    monthlyBudgets: b.monthlyBudgets.length,
    categoryBudgets: b.categoryBudgets.length,
  };
}

/** 앱 데이터 5개 테이블 전체를 백업 객체로 읽는다. Session·LoginAttempt는 담지 않는다 */
export async function exportBackup(now: Date): Promise<Backup> {
  const [categories, transactions, recurringExpenses, monthlyBudgets, categoryBudgets] =
    await Promise.all([
      db.category.findMany({
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      db.transaction.findMany({
        orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      db.recurringExpense.findMany({ orderBy: { id: "asc" } }),
      db.monthlyBudget.findMany({ orderBy: { yearMonth: "asc" } }),
      db.categoryBudget.findMany({ orderBy: { id: "asc" } }),
    ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      sortOrder: c.sortOrder,
      archivedAt: c.archivedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    transactions: transactions.map(toBackupTransaction),
    recurringExpenses: recurringExpenses.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      item: r.item,
      amount: r.amount,
      dayOfMonth: r.dayOfMonth,
      merchant: r.merchant,
      memo: r.memo,
      paymentMethod: r.paymentMethod,
      nextRunOn: fromDbDate(r.nextRunOn),
      lastRunOn: r.lastRunOn ? fromDbDate(r.lastRunOn) : null,
      createdAt: r.createdAt.toISOString(),
    })),
    monthlyBudgets: monthlyBudgets.map((m) => ({
      yearMonth: m.yearMonth,
      totalAmount: m.totalAmount,
    })),
    categoryBudgets: categoryBudgets.map((c) => ({
      id: c.id,
      yearMonth: c.yearMonth,
      categoryId: c.categoryId,
      amount: c.amount,
    })),
  };
}

/**
 * 백업으로 앱 데이터를 전체 교체한다. 전부 성공하거나 전부 롤백된다.
 * backup은 호출자가 backupSchema로 검증했어야 한다. Session·LoginAttempt는 건드리지 않는다.
 * 대량 삽입이 기본 timeout(5초)을 넘을 수 있어 timeout을 늘린다.
 */
export async function restoreBackup(backup: Backup): Promise<{ counts: BackupCounts }> {
  const txChunks: Backup["transactions"][] = [];
  for (let i = 0; i < backup.transactions.length; i += RESTORE_CHUNK_SIZE) {
    txChunks.push(backup.transactions.slice(i, i + RESTORE_CHUNK_SIZE));
  }

  await db.$transaction(
    [
      db.transaction.deleteMany(),
      db.categoryBudget.deleteMany(),
      db.monthlyBudget.deleteMany(),
      db.recurringExpense.deleteMany(),
      db.category.deleteMany(),
      ...(backup.categories.length > 0
        ? [
            db.category.createMany({
              data: backup.categories.map((c) => ({
                ...c,
                archivedAt: c.archivedAt ? new Date(c.archivedAt) : null,
                createdAt: new Date(c.createdAt),
              })),
            }),
          ]
        : []),
      ...(backup.recurringExpenses.length > 0
        ? [
            db.recurringExpense.createMany({
              data: backup.recurringExpenses.map((r) => ({
                ...r,
                nextRunOn: toDbDate(r.nextRunOn),
                lastRunOn: r.lastRunOn ? toDbDate(r.lastRunOn) : null,
                createdAt: new Date(r.createdAt),
              })),
            }),
          ]
        : []),
      ...txChunks.map((chunk) =>
        db.transaction.createMany({
          data: chunk.map((t) => ({
            ...t,
            occurredOn: toDbDate(t.occurredOn),
            createdAt: new Date(t.createdAt),
          })),
        }),
      ),
      ...(backup.monthlyBudgets.length > 0
        ? [db.monthlyBudget.createMany({ data: backup.monthlyBudgets })]
        : []),
      ...(backup.categoryBudgets.length > 0
        ? [db.categoryBudget.createMany({ data: backup.categoryBudgets })]
        : []),
    ],
    { timeout: 30_000, maxWait: 10_000 },
  );
  return { counts: countBackup(backup) };
}
