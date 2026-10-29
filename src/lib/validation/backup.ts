import { z, type ZodError } from "zod";
import { isValidDateString } from "@/lib/date";
import { categoryNameSchema } from "@/lib/validation/category";
import { yearMonthSchema } from "@/lib/validation/budget";
import { recurringSchema } from "@/lib/validation/recurring";
import { TRANSACTION_TYPES, transactionSchema } from "@/lib/validation/transaction";

export const BACKUP_FORMAT = "moneybook-backup";
export const BACKUP_VERSION = 1;
/** 앱에서 복원할 수 있는 백업 파일 최대 크기 (Server Action body 한도 4mb 안쪽) */
export const MAX_BACKUP_BYTES = 3_500_000;

const idSchema = z.string().min(1).max(100);
const timestampSchema = z.iso.datetime();
const dateSchema = z.string().refine(isValidDateString, "올바른 날짜가 아닙니다");
// 예산도 DB에서 NOT NULL이므로 null을 허용하는 budgetAmountSchema 대신 거래 금액 규칙을 쓴다
const amountSchema = transactionSchema.shape.amount;

const backupCategorySchema = z.object({
  id: idSchema,
  name: categoryNameSchema,
  type: z.enum(TRANSACTION_TYPES),
  sortOrder: z.number().int(),
  archivedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export const backupTransactionSchema = transactionSchema.extend({
  id: idSchema,
  createdAt: timestampSchema,
  recurringExpenseId: idSchema.nullable(),
});

export type BackupTransaction = z.infer<typeof backupTransactionSchema>;

const backupRecurringSchema = recurringSchema.extend({
  id: idSchema,
  createdAt: timestampSchema,
  nextRunOn: dateSchema,
  lastRunOn: dateSchema.nullable(),
});

const backupMonthlyBudgetSchema = z.object({
  yearMonth: yearMonthSchema,
  totalAmount: amountSchema,
});

const backupCategoryBudgetSchema = z.object({
  id: idSchema,
  yearMonth: yearMonthSchema,
  categoryId: idSchema,
  amount: amountSchema,
});

export const backupSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_VERSION),
    exportedAt: timestampSchema,
    categories: z.array(backupCategorySchema),
    transactions: z.array(backupTransactionSchema),
    recurringExpenses: z.array(backupRecurringSchema),
    monthlyBudgets: z.array(backupMonthlyBudgetSchema),
    categoryBudgets: z.array(backupCategoryBudgetSchema),
  })
  .superRefine((b, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    // 컬렉션별 키 중복 검사. 두 번째 이후 항목에 오류를 단다
    const checkUnique = <T,>(
      name: string,
      rows: T[],
      key: (row: T) => string,
      field: string,
      message: string,
    ) => {
      const seen = new Set<string>();
      rows.forEach((row, i) => {
        const k = key(row);
        if (seen.has(k)) issue([name, i, field], message);
        seen.add(k);
      });
    };

    checkUnique("categories", b.categories, (r) => r.id, "id", "id가 중복됩니다");
    checkUnique("transactions", b.transactions, (r) => r.id, "id", "id가 중복됩니다");
    checkUnique("recurringExpenses", b.recurringExpenses, (r) => r.id, "id", "id가 중복됩니다");
    checkUnique("categoryBudgets", b.categoryBudgets, (r) => r.id, "id", "id가 중복됩니다");
    checkUnique(
      "categories",
      b.categories,
      (r) => `${r.type}\u0000${r.name}`,
      "name",
      "같은 유형에 같은 이름의 카테고리가 있습니다",
    );
    checkUnique(
      "monthlyBudgets",
      b.monthlyBudgets,
      (r) => r.yearMonth,
      "yearMonth",
      "같은 월의 전체 예산이 중복됩니다",
    );
    checkUnique(
      "categoryBudgets",
      b.categoryBudgets,
      (r) => `${r.yearMonth}\u0000${r.categoryId}`,
      "categoryId",
      "같은 월·카테고리의 예산이 중복됩니다",
    );

    const categoryType = new Map(b.categories.map((c) => [c.id, c.type]));
    const recurringIds = new Set(b.recurringExpenses.map((r) => r.id));

    b.transactions.forEach((t, i) => {
      const type = categoryType.get(t.categoryId);
      if (type === undefined) issue(["transactions", i, "categoryId"], "없는 카테고리입니다");
      else if (type !== t.type) {
        issue(["transactions", i, "categoryId"], "거래 유형과 카테고리 유형이 다릅니다");
      }
      if (t.recurringExpenseId !== null && !recurringIds.has(t.recurringExpenseId)) {
        issue(["transactions", i, "recurringExpenseId"], "없는 고정지출입니다");
      }
    });

    const expenseOnly = (name: string, rows: { categoryId: string }[]) =>
      rows.forEach((r, i) => {
        const type = categoryType.get(r.categoryId);
        if (type === undefined) issue([name, i, "categoryId"], "없는 카테고리입니다");
        else if (type !== "EXPENSE") issue([name, i, "categoryId"], "지출 카테고리가 아닙니다");
      });
    expenseOnly("recurringExpenses", b.recurringExpenses);
    expenseOnly("categoryBudgets", b.categoryBudgets);
  });

export type Backup = z.infer<typeof backupSchema>;

export type BackupCounts = {
  categories: number;
  transactions: number;
  recurringExpenses: number;
  monthlyBudgets: number;
  categoryBudgets: number;
};

/** 검증 오류를 `"transactions.3.amount: 메시지"` 목록으로 만든다 (최대 max개) */
export function formatBackupIssues(error: ZodError, max = 20): string[] {
  return error.issues.slice(0, max).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}
