import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as auth from "@/server/actions/auth";
import * as budgets from "@/server/actions/budgets";
import * as categories from "@/server/actions/categories";
import * as transactions from "@/server/actions/transactions";
import { categoryId, resetDb, txInput } from "../setup/db";

// login은 requireSession 대상에서 제외되는 유일한 action
const modules = { transactions, categories, budgets, auth: { logout: auth.logout } };

async function counts() {
  return Promise.all([
    db.transaction.count(),
    db.category.count(),
    db.monthlyBudget.count(),
    db.categoryBudget.count(),
    db.session.count(),
  ]);
}

describe("인증 가드: 모든 action export는 세션 없이 거부된다", () => {
  beforeEach(resetDb); // 쿠키 없음

  for (const [moduleName, mod] of Object.entries(modules)) {
    it(`${moduleName}의 export가 최소 1개 있다`, () => {
      expect(Object.values(mod).filter((v) => typeof v === "function").length).toBeGreaterThan(0);
    });

    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== "function") continue;
      it(`${moduleName}.${name}: 쿠키 없이 호출하면 REDIRECT:/login, DB 불변`, async () => {
        const food = await categoryId("식비");
        const before = await counts();
        const call = fn as (...args: unknown[]) => Promise<unknown>;
        // 인자가 유효해도(변경을 시도해도) 거부되어야 한다
        await expect(
          call(food, txInput({ categoryId: food, yearMonth: "2026-10", amount: 1000, name: "x", type: "EXPENSE" })),
        ).rejects.toThrow("REDIRECT:/login");
        await expect(call()).rejects.toThrow("REDIRECT:/login");
        expect(await counts()).toEqual(before);
      });
    }
  }
});
