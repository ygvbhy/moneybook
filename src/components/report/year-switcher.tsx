import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { todayInSeoul } from "@/lib/date";

export function YearSwitcher({ year }: { year: number }) {
  const currentYear = Number(todayInSeoul().slice(0, 4));
  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/reports?year=${year - 1}`}
        aria-label="이전 해"
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronLeft aria-hidden />
      </Link>
      <span className="min-w-20 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {year}년
      </span>
      <Link
        href={`/reports?year=${year + 1}`}
        aria-label="다음 해"
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronRight aria-hidden />
      </Link>
      {year !== currentYear && (
        <Link
          href={`/reports?year=${currentYear}`}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "ml-1" })}
        >
          올해
        </Link>
      )}
    </div>
  );
}
