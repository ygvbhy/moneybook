import bcrypt from "bcryptjs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getSession, SESSION_COOKIE, hashToken } from "@/lib/auth/session";
import { requireSession } from "@/lib/auth/dal";
import { login, logout } from "@/server/actions/auth";
import { testCookies, testHeaders } from "../setup/mocks";

const USER = "tester";
const PASS = "correct-horse";
const MSG = "아이디 또는 비밀번호가 올바르지 않습니다";

beforeAll(async () => {
  // 테스트 전용 낮은 cost (운영 코드는 저장된 해시의 cost를 그대로 사용)
  process.env.ADMIN_USERNAME = USER;
  process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash(PASS, 4);
});

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE "Session","LoginAttempt" RESTART IDENTITY CASCADE');
  testCookies.clear();
  testHeaders.clear();
  testHeaders.set("x-real-ip", "9.9.9.9");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const fail = (u = USER, p = "wrong") => login(null, { username: u, password: p });

describe("login", () => {
  it("성공하면 세션 행과 올바른 속성의 쿠키가 생기고 /로 리다이렉트", async () => {
    await expect(login(null, { username: USER, password: PASS })).rejects.toThrow("REDIRECT:/");
    const token = testCookies.get(SESSION_COOKIE)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await db.session.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(rows[0].tokenHash).not.toBe(token);
    const days = (rows[0].expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    expect(testCookies.getOptions(SESSION_COOKIE)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false, // NODE_ENV=test
      path: "/",
      maxAge: 30 * 86_400,
    });
    expect(await db.loginAttempt.findMany({ where: { success: true } })).toHaveLength(1);
    expect((await getSession())?.id).toBe(rows[0].id);
  });

  it("틀린 비밀번호와 틀린 아이디는 같은 메시지", async () => {
    expect(await fail(USER, "wrong")).toEqual({ ok: false, error: MSG });
    expect(await fail("nobody", PASS)).toEqual({ ok: false, error: MSG });
    expect(await db.session.count()).toBe(0);
  });

  it("틀린 아이디여도 bcrypt 비교를 실행한다", async () => {
    const spy = vi.spyOn(bcrypt, "compare");
    await fail("nobody", PASS);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("빈 입력은 필드 오류", async () => {
    const r = await login(null, { username: "", password: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.username?.length).toBeGreaterThan(0);
    expect(await db.loginAttempt.count()).toBe(0);
  });

  it("같은 IP의 6번째 실패는 차단되고 bcrypt를 실행하지 않는다", async () => {
    for (let i = 0; i < 5; i++) expect(await fail()).toEqual({ ok: false, error: MSG });
    const spy = vi.spyOn(bcrypt, "compare");
    const r = await fail();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^로그인 시도가 너무 많습니다\. \d+분 후 다시 시도하세요$/);
    expect(spy).not.toHaveBeenCalled();
    // 올바른 비밀번호여도 차단
    await expect(login(null, { username: USER, password: PASS })).resolves.toMatchObject({ ok: false });
    expect(spy).not.toHaveBeenCalled();
  });

  it("다른 IP는 IP 한도에 영향받지 않는다", async () => {
    for (let i = 0; i < 6; i++) await fail();
    testHeaders.set("x-real-ip", "8.8.8.8");
    expect(await fail()).toEqual({ ok: false, error: MSG });
  });

  it("병렬 10회 실패 요청에서 bcrypt 비교는 5회 이하", async () => {
    const spy = vi.spyOn(bcrypt, "compare");
    await Promise.all(Array.from({ length: 10 }, () => fail()));
    expect(spy.mock.calls.length).toBeLessThanOrEqual(5);
    expect(await db.loginAttempt.count()).toBe(10);
  });

  it("로그인 시도 시 24시간 지난 시도와 만료 세션을 정리한다", async () => {
    const old = new Date(Date.now() - 25 * 3600_000);
    await db.loginAttempt.create({ data: { ipHash: "x", success: false, createdAt: old } });
    await db.session.create({ data: { tokenHash: "expired", expiresAt: old } });
    await fail();
    expect(await db.loginAttempt.count({ where: { ipHash: "x" } })).toBe(0);
    expect(await db.session.count()).toBe(0);
  });
});

describe("세션과 로그아웃", () => {
  it("로그아웃하면 세션 행과 쿠키가 삭제되고 /login으로 리다이렉트", async () => {
    await expect(login(null, { username: USER, password: PASS })).rejects.toThrow("REDIRECT:/");
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(await db.session.count()).toBe(0);
    expect(testCookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("쿠키 없이 logout은 REDIRECT:/login", async () => {
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
  });

  it("쿠키 없이 requireSession은 REDIRECT:/login", async () => {
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
  });

  it("만료된 세션 쿠키는 거부되고 행이 삭제된다", async () => {
    testCookies.set(SESSION_COOKIE, "expired-token");
    await db.session.create({
      data: { tokenHash: hashToken("expired-token"), expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await getSession()).toBeNull();
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
    expect(await db.session.count()).toBe(0);
  });

  it("DB에 없는 토큰은 거부된다", async () => {
    testCookies.set(SESSION_COOKIE, "unknown");
    expect(await getSession()).toBeNull();
  });
});
