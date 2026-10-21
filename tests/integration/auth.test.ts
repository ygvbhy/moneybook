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

  it("차단 중 재시도는 실패 행을 늘리지 않는다", async () => {
    for (let i = 0; i < 5; i++) await fail();
    expect(await db.loginAttempt.count({ where: { success: false } })).toBe(5);
    for (let i = 0; i < 3; i++) await fail();
    expect(await db.loginAttempt.count({ where: { success: false } })).toBe(5);
  });

  it("가장 오래된 실패가 창을 벗어나면 다시 로그인할 수 있다", async () => {
    for (let i = 0; i < 5; i++) await fail();
    await fail(); // 차단
    const oldest = await db.loginAttempt.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    await db.loginAttempt.update({
      where: { id: oldest.id },
      data: { createdAt: new Date(Date.now() - 15 * 60_000 - 1000) },
    });
    // 창 안 실패 4개 -> 통과(실패 시도는 비밀번호 오류 메시지)
    expect(await fail()).toEqual({ ok: false, error: MSG });
  });

  it("안내 분은 실제 해제까지 남은 시간(올림)이다", async () => {
    for (let i = 0; i < 5; i++) await fail();
    // 실패 5개를 각각 3, 5, 7, 9, 11분 전으로 조정 -> 가장 오래된(11분 전)이 4분 뒤 만료
    const rows = await db.loginAttempt.findMany({ orderBy: { createdAt: "asc" } });
    const ages = [11, 9, 7, 5, 3];
    for (const [i, r] of rows.entries()) {
      await db.loginAttempt.update({
        where: { id: r.id },
        data: { createdAt: new Date(Date.now() - ages[i] * 60_000 - 10_000) },
      });
    }
    const r = await fail();
    expect(r).toEqual({ ok: false, error: "로그인 시도가 너무 많습니다. 4분 후 다시 시도하세요" });
    // 차단 중 반복해도 같은 기준(행이 늘지 않으므로)
    expect(await fail()).toEqual(r);
  });

  it("실제 실패가 한도를 넘어 있으면 (실패 수 - 한도 + 1)번째 행 기준으로 안내한다", async () => {
    await fail();
    const { ipHash: h } = await db.loginAttempt.findFirstOrThrow();
    await db.loginAttempt.deleteMany();
    // 같은 IP의 실제 실패 7개: 14, 12, 10, 8, 6, 4, 2분 전
    for (const m of [14, 12, 10, 8, 6, 4, 2]) {
      await db.loginAttempt.create({
        data: { ipHash: h, success: false, createdAt: new Date(Date.now() - m * 60_000 - 10_000) },
      });
    }
    // 실제 4개 이하가 되려면 7 - 5 + 1 = 3번째로 오래된 행(10분 전)까지 만료되어야 한다 -> 5분 뒤
    expect(await fail()).toEqual({ ok: false, error: "로그인 시도가 너무 많습니다. 5분 후 다시 시도하세요" });
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
    // 차단된 시도의 행은 삭제되므로, 남은 행은 bcrypt를 실행한 시도뿐이다
    expect(await db.loginAttempt.count()).toBe(spy.mock.calls.length);
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
