import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

function requireEnv(name: "ADMIN_USERNAME" | "ADMIN_PASSWORD_HASH"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.`);
  return value;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * 아이디가 틀려도 bcrypt 비교를 항상 실행해 응답 시간 차이를 없앤다.
 * (실제 해시와 비교하므로 더미 해시가 필요 없다)
 */
export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const expectedUsername = requireEnv("ADMIN_USERNAME");
  const hash = requireEnv("ADMIN_PASSWORD_HASH");
  const usernameOk = timingSafeEqual(sha256(username), sha256(expectedUsername));
  const passwordOk = await bcrypt.compare(password, hash);
  return usernameOk && passwordOk;
}
