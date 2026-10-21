import { z } from "zod";
import { TRANSACTION_TYPES } from "./transaction";

export const categoryNameSchema = z
  .string({ error: "이름을 입력하세요" })
  .trim()
  .min(1, "이름을 입력하세요")
  .max(30, "이름은 30자 이하로 입력하세요");

export const categorySchema = z.object({
  name: categoryNameSchema,
  type: z.enum(TRANSACTION_TYPES, { error: "유형을 선택하세요" }),
});

export type CategoryInput = z.infer<typeof categorySchema>;
