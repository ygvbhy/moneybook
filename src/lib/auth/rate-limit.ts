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

export function limitFor(reason: "ip" | "global"): number {
  return reason === "ip" ? IP_LIMIT : GLOBAL_LIMIT;
}

/**
 * 차단 중인 범위의 "실제" 실패 수(차단된 시도 행 제외)에서, 만료되면 다시 한도 미만(≤ limit-1)이 되는
 * 실패의 위치(오래된 순, 0부터). 즉 (realCount - limit + 1)번째로 오래된 행의 인덱스.
 */
export function unblockingFailureIndex(realCount: number, limit: number): number {
  return Math.max(0, realCount - limit);
}

/** 창 안에서 해당 실패가 만료될 때까지 남은 분(올림, 최소 1) */
export function retryAfterMinutes(failureAt: Date, now: Date): number {
  const unblockAt = failureAt.getTime() + WINDOW_MINUTES * 60_000;
  const minutes = Math.ceil((unblockAt - now.getTime()) / 60_000);
  return Math.max(1, minutes);
}
