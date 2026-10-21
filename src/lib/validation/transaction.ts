import { z } from "zod";
import { MAX_AMOUNT, MIN_AMOUNT } from "@/lib/money";
import { isValidDateString } from "@/lib/date";

// Prisma enum과 값이 같다 (생성 클라이언트는 import하지 않는다)
export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
export const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "OTHER",
] as const;

/** 앞뒤 공백 제거, 빈 문자열/미입력은 null */
const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t === "" ? null : t;
    },
    z.string().max(max, `${label}은(는) ${max}자 이하로 입력하세요`).nullable(),
  );

export const transactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES, { error: "유형을 선택하세요" }),
  amount: z
    .number({ error: "금액을 입력하세요" })
    .int("금액은 정수여야 합니다")
    .min(MIN_AMOUNT, "금액은 1원 이상이어야 합니다")
    .max(MAX_AMOUNT, "금액은 10억 원 이하여야 합니다"),
  occurredOn: z
    .string({ error: "날짜를 입력하세요" })
    .refine(isValidDateString, "올바른 날짜가 아닙니다"),
  categoryId: z
    .string({ error: "카테고리를 선택하세요" })
    .min(1, "카테고리를 선택하세요"),
  merchant: optionalText(100, "거래처"),
  item: optionalText(100, "구매 항목"),
  purpose: optionalText(200, "구매 이유"),
  memo: optionalText(1000, "메모"),
  paymentMethod: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.enum(PAYMENT_METHODS, { error: "결제 수단이 올바르지 않습니다" }).nullable(),
  ),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
