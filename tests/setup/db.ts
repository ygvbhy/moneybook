import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_COOKIE, hashToken } from "@/lib/auth/session";
import { testCookies, testHeaders } from "./mocks";

// prisma/seed.ts와 같은 12개 카테고리
const EXPENSE = ["주거비", "식비", "생활용품", "교통", "구독", "게임/취미", "쇼핑", "의료/건강", "기타"];
const INCOME = ["급여", "부수입", "기타 수입"];

/** 모든 테이블 TRUNCATE 후 카테고리 12개 재시드, 쿠키/헤더 초기화 */
export async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE "Transaction","RecurringExpense","CategoryBudget","MonthlyBudget","Category","Session","LoginAttempt" RESTART IDENTITY CASCADE',
  );
  await db.category.createMany({
    data: [
      ...EXPENSE.map((name, sortOrder) => ({ name, type: "EXPENSE" as const, sortOrder })),
      ...INCOME.map((name, sortOrder) => ({ name, type: "INCOME" as const, sortOrder })),
    ],
  });
  testCookies.clear();
  testHeaders.clear();
}

/** 유효한 세션 행을 만들고 쿠키에 주입한다 */
export async function loginAsTest() {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) },
  });
  testCookies.set(SESSION_COOKIE, token);
}

export async function categoryId(name: string, type: "INCOME" | "EXPENSE" = "EXPENSE") {
  const c = await db.category.findUniqueOrThrow({ where: { type_name: { type, name } } });
  return c.id;
}

/** 테스트용 유효 거래 입력 */
export function txInput(over: Record<string, unknown> & { categoryId: string }) {
  return { type: "EXPENSE", amount: 10_000, occurredOn: "2026-10-21", ...over };
}
