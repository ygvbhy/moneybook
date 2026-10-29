"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/dal";
import type { ActionResult } from "@/lib/action-result";
import { todayInSeoul } from "@/lib/date";
import { backupSchema, formatBackupIssues, type BackupCounts } from "@/lib/validation/backup";
import { runService } from "@/server/action-utils";
import * as svc from "@/server/backup";

export async function exportBackup(): Promise<
  ActionResult<{ filename: string; json: string; counts: BackupCounts }>
> {
  await requireSession();
  // 읽기 전용이라 revalidate하지 않는다
  return runService(async () => {
    const backup = await svc.exportBackup(new Date());
    return {
      filename: `moneybook-backup-${todayInSeoul()}.json`,
      json: JSON.stringify(backup),
      counts: svc.countBackup(backup),
    };
  });
}

export async function restoreBackup(input: unknown): Promise<ActionResult<{ counts: BackupCounts }>> {
  await requireSession();
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "백업 파일 내용이 올바르지 않습니다",
      fieldErrors: { rows: formatBackupIssues(parsed.error) },
    };
  }
  const result = await runService(() => svc.restoreBackup(parsed.data));
  // 실패하면 데이터가 그대로이므로 성공했을 때만 revalidate
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
