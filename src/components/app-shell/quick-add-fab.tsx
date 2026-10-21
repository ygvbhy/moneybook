"use client";

import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransactionDialog } from "@/components/transaction/transaction-dialog-provider";
import { isValidDateString, isValidYearMonth } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * 거래 추가 진입점. 기본 날짜: `?date=` 우선, 다음으로 이번 달이 아닌 `?month=`의 1일, 아니면 오늘.
 */
export function QuickAddFab() {
  const searchParams = useSearchParams();
  const { today, openCreate } = useTransactionDialog();

  function defaultDate() {
    const date = searchParams.get("date");
    if (isValidDateString(date)) return date;
    const month = searchParams.get("month");
    if (isValidYearMonth(month) && month !== today.slice(0, 7)) return `${month}-01`;
    return today;
  }

  return (
    <Button
      type="button"
      size="icon-lg"
      aria-label="거래 추가"
      onClick={() => openCreate({ date: defaultDate() })}
      className={cn(
        "fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 size-14 rounded-full shadow-lg md:right-8 md:bottom-8",
      )}
    >
      <Plus className="size-6" aria-hidden />
    </Button>
  );
}
