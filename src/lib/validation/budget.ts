import { z } from "zod";
import { MAX_AMOUNT, MIN_AMOUNT } from "@/lib/money";
import { isValidYearMonth } from "@/lib/date";

export const yearMonthSchema = z
  .string({ error: "월을 입력하세요" })
  .refine(isValidYearMonth, "올바른 월 형식(YYYY-MM)이 아닙니다");

/** 빈 값(null/undefined/"")은 미설정(null) */
export const budgetAmountSchema = z.preprocess(
  (v) => (v === undefined || v === "" ? null : v),
  z
    .number({ error: "예산은 숫자로 입력하세요" })
    .int("예산은 정수여야 합니다")
    .min(MIN_AMOUNT, "예산은 1원 이상이어야 합니다")
    .max(MAX_AMOUNT, "예산은 10억 원 이하여야 합니다")
    .nullable(),
);

export const totalBudgetSchema = z.object({
  yearMonth: yearMonthSchema,
  amount: budgetAmountSchema,
});

export const categoryBudgetSchema = z.object({
  yearMonth: yearMonthSchema,
  categoryId: z.string({ error: "카테고리를 선택하세요" }).min(1, "카테고리를 선택하세요"),
  amount: budgetAmountSchema,
});

export type TotalBudgetInput = z.infer<typeof totalBudgetSchema>;
export type CategoryBudgetInput = z.infer<typeof categoryBudgetSchema>;
