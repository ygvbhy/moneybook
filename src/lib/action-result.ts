// "use server" 파일은 async 함수만 export할 수 있으므로 공용 타입은 여기에 둔다.
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
