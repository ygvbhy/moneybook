export const TYPE_LABELS = { INCOME: "수입", EXPENSE: "지출" } as const;

export const PAYMENT_METHOD_LABELS = {
  CASH: "현금",
  BANK_TRANSFER: "계좌이체",
  CREDIT_CARD: "신용카드",
  DEBIT_CARD: "체크카드",
  OTHER: "기타",
} as const;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "YYYY-MM-DD" -> "10월 21일 (수)". UTC 기준 계산이라 실행 환경 TZ와 무관하다 */
export function formatDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday})`;
}
