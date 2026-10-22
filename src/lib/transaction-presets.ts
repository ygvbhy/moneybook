import type { TransactionDto } from "@/server/transactions";

type TxType = "INCOME" | "EXPENSE";

/** 거래 추가 폼의 "최근 거래" 칩이 채우는 값 */
export type TransactionPreset = {
  type: TxType;
  amount: number;
  categoryId: string;
  categoryName: string;
  merchant: string | null;
  item: string | null;
  paymentMethod: TransactionDto["paymentMethod"];
};

function presetKey(p: TransactionPreset): string {
  return [p.type, p.categoryId, p.amount, p.merchant, p.item, p.paymentMethod].join("|");
}

/** 최근순 입력에서 같은 내용은 처음 한 번만 남기고, 유형당 limit개까지 고른다 */
export function pickRecentPresets(
  rows: TransactionPreset[],
  limit = 5,
): Record<TxType, TransactionPreset[]> {
  const result: Record<TxType, TransactionPreset[]> = { INCOME: [], EXPENSE: [] };
  const seen = new Set<string>();
  for (const row of rows) {
    if (result[row.type].length >= limit) continue;
    const key = presetKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result[row.type].push(row);
  }
  return result;
}
