import { describe, expect, it } from "vitest";
import { logSafeError } from "@/server/service-error";

function namedError(name: string, message: string, code?: string) {
  const e = new Error(message) as Error & { code?: string };
  e.name = name;
  if (code) e.code = code;
  return e;
}

describe("logSafeError", () => {
  it.each([
    ["PrismaClientKnownRequestError", "P2002"],
    ["PrismaClientValidationError", undefined],
    ["DriverAdapterError", undefined],
  ])("%s는 name과 code만 남기고 message를 포함하지 않는다", (name, code) => {
    const safe = logSafeError(namedError(name, "memo=비밀 메모 amount=12345", code));
    expect(safe).toEqual({ name, code });
    expect(JSON.stringify(safe)).not.toContain("비밀 메모");
    expect(safe).not.toHaveProperty("message");
  });

  it("PrismaClientInitializationError는 원본을 유지한다", () => {
    const e = namedError("PrismaClientInitializationError", "Can't reach database server");
    expect(logSafeError(e)).toBe(e);
  });

  it("일반 Error와 오류가 아닌 값은 그대로 반환한다", () => {
    const e = new Error("boom");
    expect(logSafeError(e)).toBe(e);
    expect(logSafeError("문자열")).toBe("문자열");
  });
});
