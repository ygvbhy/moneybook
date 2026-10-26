/** 요청마다 nonce를 넣은 Content-Security-Policy 헤더 값을 만든다. */
export function buildCsp(nonce: string, isDev: boolean): string {
  // style-src에 nonce를 넣으면 'unsafe-inline'이 무시되어 Radix·Recharts의 style 속성이 막힌다.
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
