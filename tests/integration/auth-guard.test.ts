import { readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { categoryId, resetDb, txInput } from "../setup/db";

// 모든 action 파일을 실행할 때마다 디렉터리에서 탐색한다 (새 파일·새 export도 자동으로 검사 대상).
// import.meta.glob은 변환 캐시에 남아 테스트 파일을 고치지 않으면 새 파일을 놓칠 수 있어 쓰지 않는다.
const ACTIONS_DIR = path.resolve(process.cwd(), "src/server/actions");
const files: Record<string, Record<string, unknown>> = {};
for (const file of readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"))) {
  files[file] = await import(path.join(ACTIONS_DIR, file));
}

// login은 requireSession 대상에서 제외되는 유일한 action
const EXCLUDED = new Set(["auth.ts:login"]);

const targets = Object.entries(files).flatMap(([file, mod]) => {
  return Object.entries(mod)
    .filter(([name, fn]) => typeof fn === "function" && !EXCLUDED.has(`${file}:${name}`))
    .map(([name, fn]) => ({ file, name, fn: fn as (...args: unknown[]) => Promise<unknown> }));
});

async function counts() {
  return Promise.all([
    db.transaction.count(),
    db.category.count(),
    db.monthlyBudget.count(),
    db.categoryBudget.count(),
    db.session.count(),
    db.recurringExpense.count(),
  ]);
}

describe("인증 가드: 모든 action export는 세션 없이 거부된다", () => {
  beforeEach(resetDb); // 쿠키 없음

  it("action 파일과 export를 탐색했다 (현재 6개 파일, login 제외 19개)", () => {
    expect(Object.keys(files).length).toBeGreaterThan(0);
    expect(targets.length).toBeGreaterThan(0);
  });

  for (const { file, name, fn } of targets) {
    it(`${file} ${name}: 쿠키 없이 호출하면 REDIRECT:/login, DB 불변`, async () => {
      const food = await categoryId("식비");
      const before = await counts();
      // 인자가 유효해도(변경을 시도해도) 거부되어야 한다
      await expect(
        fn(food, txInput({ categoryId: food, yearMonth: "2026-10", amount: 1000, name: "x", type: "EXPENSE" })),
      ).rejects.toThrow("REDIRECT:/login");
      await expect(fn()).rejects.toThrow("REDIRECT:/login");
      expect(await counts()).toEqual(before);
    });
  }
});
