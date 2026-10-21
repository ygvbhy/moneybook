import { NextResponse, type NextRequest } from "next/server";

// 낙관적 차단: 쿠키 존재 여부만 본다 (DB 검증은 requireSession). /login → / 리다이렉트는 하지 않는다.
export function proxy(request: NextRequest) {
  // Server Action은 각자 requireSession()으로 검증하고 redirect를 응답으로 돌려준다.
  // 여기서 307로 돌리면 클라이언트가 action 응답 대신 HTML을 받아 오류 화면이 뜬다.
  if (request.headers.has("next-action")) return NextResponse.next();
  if (!request.cookies.has("ledger_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|css|js|map|woff2?)$).*)",
  ],
};
