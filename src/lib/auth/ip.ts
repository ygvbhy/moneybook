import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** x-real-ip → x-forwarded-for 첫 값 → "unknown" */
export function extractClientIp(get: (name: string) => string | null): string {
  const real = get("x-real-ip")?.trim();
  if (real) return real;
  const first = get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first) return first;
  return "unknown";
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function getClientIpHash(): Promise<string> {
  const h = await headers();
  return hashIp(extractClientIp((name) => h.get(name)));
}
