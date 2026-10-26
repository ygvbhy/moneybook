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

export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const BCRYPT_MAX_BYTES = 72;

export function adminPasswordError(password: string): string | null {
  if ([...password].length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${ADMIN_PASSWORD_MIN_LENGTH}자 이상이어야 합니다`;
  }
  if (new TextEncoder().encode(password).length > BCRYPT_MAX_BYTES) {
    return `비밀번호는 ${BCRYPT_MAX_BYTES}바이트 이하여야 합니다 (한글은 1자 3바이트)`;
  }
  return null;
}
