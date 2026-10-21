"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getClientIpHash } from "@/lib/auth/ip";
import { verifyAdminCredentials } from "@/lib/auth/password";
import {
  WINDOW_MINUTES,
  evaluateLoginLimit,
  retryAfterMinutes,
} from "@/lib/auth/rate-limit";
import { createSession, deleteSession } from "@/lib/auth/session";
import { requireSession } from "@/lib/auth/dal";
import { loginSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/action-result";

const INVALID_CREDENTIALS = "아이디 또는 비밀번호가 올바르지 않습니다";

async function cleanup() {
  const now = Date.now();
  await Promise.all([
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now - 24 * 3600_000) } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
  ]);
}

/** 로그인은 requireSession 대상에서 제외되는 유일한 action */
export async function login(
  _prevState: ActionResult | null,
  input: FormData | { username?: unknown; password?: unknown },
): Promise<ActionResult> {
  const raw =
    input instanceof FormData
      ? { username: input.get("username"), password: input.get("password") }
      : input;
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "입력값을 확인하세요",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const ipHash = await getClientIpHash();

  // ① 시도 행을 먼저 INSERT (병렬 요청의 한도 우회 방지)
  const attempt = await db.loginAttempt.create({ data: { ipHash, success: false } });
  await cleanup(); // 시도할 때마다 오래된 시도·만료 세션 정리

  // ② 최근 15분 실패 수 (방금 넣은 행 포함)
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const [ipFailures, globalFailures] = await Promise.all([
    db.loginAttempt.count({ where: { ipHash, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { success: false, createdAt: { gte: since } } }),
  ]);
  const limit = evaluateLoginLimit({ ipFailures, globalFailures });
  if (limit.blocked) {
    const oldest = await db.loginAttempt.findFirst({
      where: {
        success: false,
        createdAt: { gte: since },
        ...(limit.reason === "ip" ? { ipHash } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const minutes = retryAfterMinutes(oldest?.createdAt ?? attempt.createdAt, new Date());
    return { ok: false, error: `로그인 시도가 너무 많습니다. ${minutes}분 후 다시 시도하세요` };
  }

  // ③ bcrypt 비교
  const ok = await verifyAdminCredentials(parsed.data.username, parsed.data.password);
  if (!ok) return { ok: false, error: INVALID_CREDENTIALS };

  // ④ 성공 처리
  await db.loginAttempt.update({ where: { id: attempt.id }, data: { success: true } });
  await createSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await requireSession();
  await deleteSession();
  redirect("/login");
}
