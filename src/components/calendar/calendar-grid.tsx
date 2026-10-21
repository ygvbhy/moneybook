"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { buildMonthGrid } from "@/lib/date";
import { formatCompactKRW, formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DayTotal } from "@/lib/aggregate";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

type Props = {
  month: string;
  selectedDate: string | null;
  today: string;
  totals: Record<string, DayTotal>;
};

export function CalendarGrid({ month, selectedDate, today, totals }: Props) {
  const router = useRouter();
  const cells = buildMonthGrid(month);
  const inMonthDates = cells.filter((c) => c.inMonth).map((c) => c.date);
  const initial =
    selectedDate ?? (inMonthDates.includes(today) ? today : inMonthDates[0]);
  const [focused, setFocused] = useState(initial);
  const refs = useRef(new Map<string, HTMLDivElement>());

  // 월/선택이 바뀌면 포커스 후보를 다시 맞춘다 (렌더 중 상태 조정)
  const [prevKey, setPrevKey] = useState(`${month}|${selectedDate}`);
  if (prevKey !== `${month}|${selectedDate}`) {
    setPrevKey(`${month}|${selectedDate}`);
    setFocused(initial);
  }
  const rovingDate = inMonthDates.includes(focused) ? focused : initial;

  function select(date: string) {
    router.push(`/calendar?month=${month}&date=${date}`, { scroll: false });
  }

  function moveTo(index: number) {
    const next = Math.min(Math.max(index, 0), inMonthDates.length - 1);
    const date = inMonthDates[next];
    setFocused(date);
    refs.current.get(date)?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, date: string) {
    const i = inMonthDates.indexOf(date);
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in deltas) {
      e.preventDefault();
      moveTo(i + deltas[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      moveTo(inMonthDates.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(date);
    }
  }

  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7));

  return (
    <div role="grid" aria-label={`${month.replace("-", "년 ")}월 달력`} className="select-none">
      <div role="row" className="grid grid-cols-7 pb-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            role="columnheader"
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border">
        {rows.map((row, r) => (
          <div key={r} role="row" className={cn("grid grid-cols-7", r > 0 && "border-t")}>
            {row.map((cell, c) => {
              const day = Number(cell.date.slice(8));
              const border = c > 0 ? "border-l" : "";
              if (!cell.inMonth) {
                return (
                  <div
                    key={cell.date}
                    role="gridcell"
                    aria-disabled="true"
                    className={cn(
                      "flex min-h-14 flex-col items-center p-1 text-xs text-muted-foreground/40 sm:min-h-20 sm:items-start sm:text-sm",
                      border,
                    )}
                  >
                    {day}
                  </div>
                );
              }
              const t = totals[cell.date];
              const m = Number(cell.date.slice(5, 7));
              const label = `${m}월 ${day}일, 지출 ${formatKRW(t?.expense ?? 0)}원, 수입 ${formatKRW(t?.income ?? 0)}원, 거래 ${t?.count ?? 0}건`;
              const isSelected = cell.date === selectedDate;
              const isToday = cell.date === today;
              return (
                <div
                  key={cell.date}
                  ref={(el) => {
                    if (el) refs.current.set(cell.date, el);
                    else refs.current.delete(cell.date);
                  }}
                  role="gridcell"
                  tabIndex={cell.date === rovingDate ? 0 : -1}
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={label}
                  title={label}
                  onClick={() => select(cell.date)}
                  onFocus={() => setFocused(cell.date)}
                  onKeyDown={(e) => onKeyDown(e, cell.date)}
                  className={cn(
                    "flex min-h-14 cursor-pointer flex-col items-center gap-0.5 p-1 text-xs outline-none hover:bg-accent focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-20 sm:items-start sm:text-sm",
                    border,
                    isSelected && "bg-accent ring-2 ring-inset ring-primary",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full tabular-nums",
                      isToday && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {day}
                  </span>
                  {t && t.count > 0 && (
                    <>
                      <span aria-hidden className="size-1 rounded-full bg-primary sm:hidden" />
                      <span aria-hidden className="hidden items-center gap-1 sm:flex">
                        <span className="size-1.5 rounded-full bg-primary" />
                      </span>
                      {t.expense > 0 && (
                        <span aria-hidden className="text-[10px] leading-tight tabular-nums sm:text-xs">
                          −{formatCompactKRW(t.expense)}
                        </span>
                      )}
                      {t.income > 0 && (
                        <span
                          aria-hidden
                          className="hidden text-[10px] leading-tight text-emerald-700 tabular-nums min-[420px]:block sm:text-xs dark:text-emerald-400"
                        >
                          +{formatCompactKRW(t.income)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
