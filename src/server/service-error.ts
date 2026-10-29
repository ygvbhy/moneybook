import "server-only";

/** 사용자에게 그대로 보여줄 수 있는 예상된 실패 (검증 실패, 대상 없음 등) */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

/** Prisma known request error 코드 (P2002, P2025 ...). 아니면 undefined */
export function prismaCode(e: unknown): string | undefined {
  if (e instanceof Error && e.name === "PrismaClientKnownRequestError") {
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * console.error에 넘길 오류를 개인 데이터가 새지 않게 줄인다.
 * Prisma·드라이버 오류 메시지에는 쿼리 인자·값이 담길 수 있어 `{ name, code }`만 남기고,
 * 연결 진단이 필요한 초기화 오류와 그 외 오류는 그대로 둔다.
 */
export function logSafeError(e: unknown): unknown {
  if (!(e instanceof Error)) return e;
  if (e.name === "PrismaClientInitializationError") return e;
  if (e.name.startsWith("Prisma") || e.name === "DriverAdapterError") {
    const code = (e as { code?: unknown }).code;
    return { name: e.name, code: typeof code === "string" ? code : undefined };
  }
  return e;
}

export const TX_NOT_FOUND = "이미 삭제되었거나 존재하지 않는 거래입니다";
export const RECURRING_NOT_FOUND = "이미 삭제되었거나 존재하지 않는 고정지출입니다";
export const CATEGORY_NOT_FOUND = "이미 삭제되었거나 존재하지 않는 카테고리입니다";
export const CATEGORY_DUPLICATE = "같은 이름의 카테고리가 있습니다(보관됨이면 복원하세요)";
export const CATEGORY_MISSING = "카테고리를 찾을 수 없습니다";
export const CATEGORY_TYPE_MISMATCH = "거래 유형과 카테고리 유형이 일치하지 않습니다";
export const CATEGORY_ARCHIVED = "보관된 카테고리는 사용할 수 없습니다";
export const UNDO_CATEGORY_MISSING = "카테고리가 없어 되돌릴 수 없습니다";
