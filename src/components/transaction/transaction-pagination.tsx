import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

type Props = {
  page: number;
  pageCount: number;
  /** 유지할 검색 파라미터. page는 무시된다 */
  searchParams: Record<string, string | string[] | undefined>;
};

function hrefFor(page: number, sp: Props["searchParams"]) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page" || v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) qs.append(k, item);
  }
  if (page !== 1) qs.set("page", String(page));
  const query = qs.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

export function TransactionPagination({ page, pageCount, searchParams }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="페이지 이동" className="mt-4 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1, searchParams)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          이전
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled>
          이전
        </Button>
      )}
      <span className="text-sm tabular-nums">
        {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          href={hrefFor(page + 1, searchParams)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          다음
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled>
          다음
        </Button>
      )}
    </nav>
  );
}
