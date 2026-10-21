import { describe, expect, it } from "vitest";
import { extractClientIp, hashIp } from "@/lib/auth/ip";
import { hashToken } from "@/lib/auth/session";

const headersOf = (h: Record<string, string>) => (name: string) => h[name] ?? null;

describe("extractClientIp", () => {
  it("x-real-ip를 우선한다", () => {
    expect(extractClientIp(headersOf({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
  });
  it("x-forwarded-for 첫 값을 쓴다", () => {
    expect(extractClientIp(headersOf({ "x-forwarded-for": " 2.2.2.2 , 3.3.3.3" }))).toBe("2.2.2.2");
  });
  it("없으면 unknown", () => {
    expect(extractClientIp(headersOf({}))).toBe("unknown");
  });
});

describe("hash", () => {
  it("hashIp는 64자 hex이고 결정적이다", () => {
    expect(hashIp("1.1.1.1")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("1.1.1.1")).toBe(hashIp("1.1.1.1"));
    expect(hashIp("1.1.1.1")).not.toBe(hashIp("1.1.1.2"));
  });
  it("hashToken은 원문과 다르다", () => {
    expect(hashToken("abc")).not.toContain("abc");
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});
