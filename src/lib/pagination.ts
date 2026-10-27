/**
 * page 검색 파라미터를 해석한다. 양의 안전 정수(앞자리 0 없음)만 인정하고 아니면 1페이지.
 * 요청 page가 마지막 페이지를 넘으면 마지막 페이지로 맞춘다.
 */
export function paginate(
  raw: string | string[] | undefined,
  total: number,
  pageSize: number,
): { page: number; pageCount: number; skip: number } {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const requested =
    value !== undefined && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
      ? Number(value)
      : 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requested, pageCount);
  return { page, pageCount, skip: (page - 1) * pageSize };
}
