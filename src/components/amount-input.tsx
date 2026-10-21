"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatKRW, parseAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode" | "defaultValue"
> & {
  value: number | null;
  onChange: (value: number | null) => void;
};

/** 천 단위 쉼표로 표시하고 정수|null을 내보내는 금액 입력. 캐럿은 항상 끝에 위치한다. ref/props는 input으로 전달된다 */
export const AmountInput = React.forwardRef<HTMLInputElement, Props>(function AmountInput(
  { value, onChange, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value === null ? "" : formatKRW(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          onChange(raw === "" ? null : parseAmountInput(raw));
        }}
        className={cn("pr-9 text-right tabular-nums", className)}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
      >
        원
      </span>
    </div>
  );
});
