import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { shiftMonth, todayInSeoul } from "@/lib/date";

type Props = {
  month: string;
  /** 현재 경로 (예: "/transactions") */
  basePath: string;
  /** 유지할 나머지 검색 파라미터. month, date는 무시된다 */
  searchParams?: Record<string, string | string[] | undefined>;
};

function hrefFor(basePath: string, month: string, sp: Props["searchParams"]) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp ?? {})) {
    if (k === "month" || k === "date" || v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) qs.append(k, item);
  }
  qs.set("month", month);
  return `${basePath}?${qs.toString()}`;
}

export function MonthSwitcher({ month, basePath, searchParams }: Props) {
  const [year, mm] = month.split("-");
  const currentMonth = todayInSeoul().slice(0, 7);
  return (
    <div className="flex items-center gap-1">
      <Link
        href={hrefFor(basePath, shiftMonth(month, -1), searchParams)}
        aria-label="이전 달"
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronLeft aria-hidden />
      </Link>
      <span className="min-w-28 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {year}년 {Number(mm)}월
      </span>
      <Link
        href={hrefFor(basePath, shiftMonth(month, 1), searchParams)}
        aria-label="다음 달"
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronRight aria-hidden />
      </Link>
      {month !== currentMonth && (
        <Link
          href={hrefFor(basePath, currentMonth, searchParams)}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "ml-1" })}
        >
          이번 달
        </Link>
      )}
    </div>
  );
}
