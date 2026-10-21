import { z } from "zod";
import { MAX_AMOUNT, MIN_AMOUNT } from "@/lib/money";
import { PAYMENT_METHODS, optionalText } from "@/lib/validation/transaction";

export const recurringSchema = z.object({
  categoryId: z
    .string({ error: "카테고리를 선택하세요" })
    .min(1, "카테고리를 선택하세요"),
  item: z
    .string({ error: "지출 내역을 입력하세요" })
    .trim()
    .min(1, "지출 내역을 입력하세요")
    .max(100, "지출 내역은 100자 이하로 입력하세요"),
  amount: z
    .number({ error: "금액을 입력하세요" })
    .int("금액은 정수여야 합니다")
    .min(MIN_AMOUNT, "금액은 1원 이상이어야 합니다")
    .max(MAX_AMOUNT, "금액은 10억 원 이하여야 합니다"),
  dayOfMonth: z
    .number({ error: "매월 일자를 선택하세요" })
    .int("매월 일자는 정수여야 합니다")
    .min(1, "매월 일자는 1일 이상이어야 합니다")
    .max(31, "매월 일자는 31일 이하여야 합니다"),
  merchant: optionalText(100, "거래처"),
  memo: optionalText(1000, "메모"),
  paymentMethod: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.enum(PAYMENT_METHODS, { error: "결제 수단이 올바르지 않습니다" }).nullable(),
  ),
});

export type RecurringInput = z.infer<typeof recurringSchema>;
