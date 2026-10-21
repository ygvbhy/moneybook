import { vi } from "vitest";

// 통합 테스트용 Next 모듈 목. vitest.config의 integration setupFiles로 로드된다.

if (
  !process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
) {
  throw new Error("통합 테스트는 DATABASE_URL이 TEST_DATABASE_URL과 같아야 합니다");
}

const cookieJar = new Map<string, string>();
const cookieOptions = new Map<string, Record<string, unknown>>();

/** 테스트가 쿠키 값을 주입/조회한다 */
export const testCookies = {
  set: (name: string, value: string) => void cookieJar.set(name, value),
  get: (name: string) => cookieJar.get(name),
  delete: (name: string) => void cookieJar.delete(name),
  clear: () => {
    cookieJar.clear();
    cookieOptions.clear();
  },
  /** set()에 전달된 옵션 (HttpOnly/SameSite/Secure/maxAge 검증용) */
  getOptions: (name: string) => cookieOptions.get(name),
};

/** 요청 헤더 주입 (키는 소문자) */
export const testHeaders = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieJar.set(name, value);
      if (options) cookieOptions.set(name, options);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
      cookieOptions.delete(name);
    },
    has: (name: string) => cookieJar.has(name),
  }),
  headers: async () => ({
    get: (name: string) => testHeaders.get(name.toLowerCase()) ?? null,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
