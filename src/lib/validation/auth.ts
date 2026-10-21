import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string({ error: "아이디를 입력하세요" })
    .min(1, "아이디를 입력하세요")
    .max(100, "아이디가 너무 깁니다"),
  password: z
    .string({ error: "비밀번호를 입력하세요" })
    .min(1, "비밀번호를 입력하세요")
    .max(200, "비밀번호가 너무 깁니다"),
});

export type LoginInput = z.infer<typeof loginSchema>;
