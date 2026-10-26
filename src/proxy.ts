import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

// 낙관적 차단: 쿠키 존재 여부만 본다 (DB 검증은 requireSession). /login → / 리다이렉트는 하지 않는다.
export function proxy(request: NextRequest) {
  // 요청마다 새 nonce를 만들고 요청 헤더를 덮어써, 클라이언트가 보낸 x-nonce는 렌더에 쓰이지 않는다.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Server Action은 각자 requireSession()으로 검증하고 redirect를 응답으로 돌려준다.
  // 여기서 307로 돌리면 클라이언트가 action 응답 대신 HTML을 받아 오류 화면이 뜬다.
  const skipCookieCheck =
    request.headers.has("next-action") || request.nextUrl.pathname.startsWith("/login");
  if (!skipCookieCheck && !request.cookies.has("ledger_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|css|js|map|woff2?)$).*)",
  ],
};
