export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 1_000_000_000;

/** 숫자와 쉼표만 허용. 쉼표를 제거해 정수로 변환하고, 그 외(빈 값, 음수, 소수, 문자)는 null */
export function parseAmountInput(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,3}(,\d{3})*$|^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

const krw = new Intl.NumberFormat("ko-KR");
const compact = new Intl.NumberFormat("ko-KR", { notation: "compact" });

export function formatKRW(n: number): string {
  return krw.format(n);
}

export function formatCompactKRW(n: number): string {
  return compact.format(n);
}

/** 증감 표기: 증가 "▲12,000원", 감소 "▼12,000원", 0은 "변동 없음" */
export function formatKRWDelta(n: number): string {
  if (n === 0) return "변동 없음";
  return `${n > 0 ? "▲" : "▼"}${krw.format(Math.abs(n))}원`;
}
