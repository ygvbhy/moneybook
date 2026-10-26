import { NextRequest } from "next/server";
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

// 문서의 unstable_doesProxyMatch는 Next 16.x 패키지에 아직 middleware 이름으로 노출된다.
function matches(url: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url });
}

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe("proxy matcher", () => {
  it.each(["/", "/login", "/login/x", "/transactions"])("%s 에서 실행된다", (path) => {
    expect(matches(path)).toBe(true);
  });

  it.each(["/_next/static/a.js", "/icon.svg", "/favicon.ico"])("%s 에서는 실행되지 않는다", (path) => {
    expect(matches(path)).toBe(false);
  });
});

describe("proxy", () => {
  it("쿠키 없이 /에 접근하면 /login으로 리다이렉트한다", () => {
    const response = proxy(request("/"));
    expect(getRedirectUrl(response)).toBe("http://localhost:3000/login");
  });

  it("쿠키 없이 /login에 접근하면 리다이렉트하지 않고 nonce가 든 CSP를 붙인다", () => {
    const response = proxy(request("/login"));
    expect(getRedirectUrl(response)).toBeNull();
    const nonce = response.headers.get("x-middleware-request-x-nonce");
    expect(nonce).toBeTruthy();
    expect(response.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
  });

  it("쿠키가 있으면 통과시키고 CSP를 붙인다", () => {
    const response = proxy(request("/", { cookie: "ledger_session=token" }));
    expect(getRedirectUrl(response)).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toContain("'strict-dynamic'");
  });

  it("쿠키 없는 Server Action 요청은 리다이렉트하지 않고 CSP를 붙인다", () => {
    const response = proxy(request("/transactions", { "next-action": "abc" }));
    expect(getRedirectUrl(response)).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src");
  });

  it("클라이언트가 보낸 x-nonce를 렌더에 쓰지 않는다", () => {
    const response = proxy(request("/login", { "x-nonce": "evil" }));
    const nonce = response.headers.get("x-middleware-request-x-nonce");
    expect(nonce).toBeTruthy();
    expect(nonce).not.toBe("evil");
  });

  it("요청마다 nonce가 다르다", () => {
    const a = proxy(request("/login")).headers.get("x-middleware-request-x-nonce");
    const b = proxy(request("/login")).headers.get("x-middleware-request-x-nonce");
    expect(a).not.toBe(b);
  });
});
