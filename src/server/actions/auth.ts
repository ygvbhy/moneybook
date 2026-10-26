"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getClientIpHash } from "@/lib/auth/ip";
import { verifyAdminCredentials } from "@/lib/auth/password";
import {
  TRUSTED_IP_DAYS,
  WINDOW_MINUTES,
  evaluateLoginLimit,
  limitFor,
  retryAfterMinutes,
  unblockingFailureIndex,
} from "@/lib/auth/rate-limit";
import { createSession, deleteSession } from "@/lib/auth/session";
import { requireSession } from "@/lib/auth/dal";
import { loginSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/action-result";

const INVALID_CREDENTIALS = "아이디 또는 비밀번호가 올바르지 않습니다";

async function cleanup() {
  const now = Date.now();
  await Promise.all([
    // 성공 기록은 신뢰 IP 판정 근거라 TRUSTED_IP_DAYS 동안 보관한다
    db.loginAttempt.deleteMany({
      where: {
        OR: [
          { success: false, createdAt: { lt: new Date(now - 24 * 3600_000) } },
          { success: true, createdAt: { lt: new Date(now - TRUSTED_IP_DAYS * 24 * 3600_000) } },
        ],
      },
    }),
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

  // ② 최근 15분 실패 수 (방금 넣은 행 포함) + 최근 30일 안에 성공한 적 있는 IP인지
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const trustedSince = new Date(Date.now() - TRUSTED_IP_DAYS * 24 * 3600_000);
  const [ipFailures, globalFailures, trustedCount] = await Promise.all([
    db.loginAttempt.count({ where: { ipHash, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ipHash, success: true, createdAt: { gte: trustedSince } } }),
  ]);
  const limit = evaluateLoginLimit({ ipFailures, globalFailures, trustedIp: trustedCount > 0 });
  if (limit.blocked) {
    // 차단된 시도는 기록으로 남기지 않는다(남기면 재시도마다 잠금이 연장된다)
    await db.loginAttempt.delete({ where: { id: attempt.id } });
    const where = {
      success: false,
      createdAt: { gte: since },
      ...(limit.reason === "ip" ? { ipHash } : {}),
    };
    // 실제 실패 수가 (한도 - 1) 이하가 되려면 (실제 수 - 한도 + 1)번째로 오래된 실패가 만료되어야 한다
    const realCount = await db.loginAttempt.count({ where });
    const [blocking] = await db.loginAttempt.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: unblockingFailureIndex(realCount, limitFor(limit.reason)),
      take: 1,
      select: { createdAt: true },
    });
    const minutes = retryAfterMinutes(blocking?.createdAt ?? attempt.createdAt, new Date());
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
