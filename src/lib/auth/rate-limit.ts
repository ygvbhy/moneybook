// 판정만 하는 순수 함수. 카운트는 "방금 넣은 시도 행"을 포함한다 (INSERT 후 COUNT).
export const IP_LIMIT = 5;
export const GLOBAL_LIMIT = 30;
export const WINDOW_MINUTES = 15;

export type LoginLimitResult =
  | { blocked: false; reason: null }
  | { blocked: true; reason: "ip" | "global" };

export function evaluateLoginLimit(counts: {
  ipFailures: number;
  globalFailures: number;
}): LoginLimitResult {
  if (counts.ipFailures > IP_LIMIT) return { blocked: true, reason: "ip" };
  if (counts.globalFailures > GLOBAL_LIMIT) return { blocked: true, reason: "global" };
  return { blocked: false, reason: null };
}

/** 창 안에서 가장 오래된 실패가 만료될 때까지 남은 분(올림, 최소 1) */
export function retryAfterMinutes(oldestFailureInWindow: Date, now: Date): number {
  const unblockAt = oldestFailureInWindow.getTime() + WINDOW_MINUTES * 60_000;
  const minutes = Math.ceil((unblockAt - now.getTime()) / 60_000);
  return Math.max(1, minutes);
}
