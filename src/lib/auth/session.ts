import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "ledger_session";
/** 절대 상한(생성 후 최대 일수)이자 쿠키 수명 */
export const SESSION_DAYS = 30;
/** 마지막 접근 후 이 기간이 지나면 만료. expiresAt을 슬라이딩 방식으로 갱신한다 */
export const SESSION_IDLE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 요청마다 쓰기가 일어나지 않도록, 목표 만료 시각과 이만큼 이상 다를 때만 갱신한다 */
const REFRESH_THRESHOLD_MS = 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_IDLE_DAYS * DAY_MS);
  await db.session.create({ data: { tokenHash: hashToken(token), expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // 쿠키는 렌더 중 갱신할 수 없어 절대 상한(30일)으로 둔다. 실제 만료는 DB의 expiresAt이 결정한다
    expires: new Date(now + SESSION_DAYS * DAY_MS),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export const getSession = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  // 미사용 만료 갱신: min(생성 + 30일, 지금 + 7일). 렌더를 막지 않도록 실패는 로그만 남긴다
  const target = Math.min(
    session.createdAt.getTime() + SESSION_DAYS * DAY_MS,
    Date.now() + SESSION_IDLE_DAYS * DAY_MS,
  );
  if (Math.abs(target - session.expiresAt.getTime()) <= REFRESH_THRESHOLD_MS) return session;
  try {
    const expiresAt = new Date(target);
    const { count } = await db.session.updateMany({ where: { id: session.id }, data: { expiresAt } });
    if (count === 0) return null; // 동시 로그아웃·정리로 이미 삭제됨
    return { ...session, expiresAt };
  } catch (e) {
    // lib → server 역방향 import를 피하려고 logSafeError 대신 오류 이름만 남긴다
    console.error("[session] refresh failed", e instanceof Error ? e.name : e);
    return session;
  }
});

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}
