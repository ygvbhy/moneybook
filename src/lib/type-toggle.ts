/** 수입/지출 토글 항목: 선택된 유형을 금액과 같은 색으로 강조한다 */
export const TYPE_TOGGLE_ITEM_CLASS = {
  INCOME:
    "text-muted-foreground data-[state=on]:border-income data-[state=on]:bg-income/10 data-[state=on]:text-income",
  EXPENSE:
    "text-muted-foreground data-[state=on]:border-expense data-[state=on]:bg-expense/10 data-[state=on]:text-expense",
} as const;
