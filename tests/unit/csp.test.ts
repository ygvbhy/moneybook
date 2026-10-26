import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/csp";

function directive(csp: string, name: string): string {
  const found = csp.split("; ").find((d) => d.startsWith(`${name} `));
  if (!found) throw new Error(`${name} 지시문이 없다`);
  return found;
}

describe("buildCsp", () => {
  it("script-src에 nonce와 strict-dynamic이 들어간다", () => {
    const script = directive(buildCsp("abc123", false), "script-src");
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
  });

  it("script-src에 unsafe-inline이 없다", () => {
    expect(directive(buildCsp("abc123", false), "script-src")).not.toContain("'unsafe-inline'");
  });

  it("unsafe-eval은 개발 모드에서만 허용한다", () => {
    expect(directive(buildCsp("n", true), "script-src")).toContain("'unsafe-eval'");
    expect(directive(buildCsp("n", false), "script-src")).not.toContain("'unsafe-eval'");
  });

  it("style-src에는 nonce가 없고 unsafe-inline이 있다", () => {
    const style = directive(buildCsp("abc123", false), "style-src");
    expect(style).toContain("'unsafe-inline'");
    expect(style).not.toContain("nonce");
  });

  it("frame-ancestors와 object-src를 막는다", () => {
    const csp = buildCsp("n", false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("upgrade-insecure-requests를 넣지 않는다", () => {
    expect(buildCsp("n", false)).not.toContain("upgrade-insecure-requests");
  });

  it("개행 없는 한 줄이다", () => {
    expect(buildCsp("n", true)).not.toMatch(/[\r\n]/);
  });
});
