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

export const TX_NOT_FOUND = "이미 삭제되었거나 존재하지 않는 거래입니다";
export const CATEGORY_NOT_FOUND = "이미 삭제되었거나 존재하지 않는 카테고리입니다";
export const CATEGORY_DUPLICATE = "같은 이름의 카테고리가 있습니다(보관됨이면 복원하세요)";
