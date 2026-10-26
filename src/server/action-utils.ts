import "server-only";
import type { ZodError } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ServiceError, logSafeError } from "@/server/service-error";

export function validationFailure(error: ZodError): ActionResult<never> {
  return {
    ok: false,
    error: "입력값을 확인하세요",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}

/**
 * 서비스 호출을 ActionResult로 변환한다. ServiceError는 메시지를 그대로 돌려주고,
 * 그 외 예상 못한 오류는 서버에만 로그를 남기고 일반 메시지를 돌려준다.
 * requireSession()(redirect를 던짐)은 반드시 이 함수 밖에서 호출해야 한다.
 */
export async function runService<T = void>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return data === undefined ? { ok: true } : { ok: true, data };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error("[action] unexpected error", logSafeError(e));
    return { ok: false, error: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요" };
  }
}
