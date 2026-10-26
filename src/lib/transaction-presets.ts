import { PAYMENT_METHODS } from "@/lib/validation/transaction";
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

/** 거래처 자동완성이 채우는 값 */
export type MerchantSuggestion = {
  merchant: string;
  categoryId: string;
  paymentMethod: TransactionDto["paymentMethod"];
};

/** (유형, 거래처, 카테고리, 결제수단) 그룹 하나의 건수와 마지막 거래일 */
export type MerchantGroup = {
  type: TxType;
  merchant: string;
  categoryId: string;
  paymentMethod: TransactionDto["paymentMethod"];
  count: number;
  lastOn: string;
};

type Tally = { count: number; lastOn: string };

function addTally(map: Map<string, Tally>, key: string, g: MerchantGroup) {
  const t = map.get(key);
  if (!t) map.set(key, { count: g.count, lastOn: g.lastOn });
  else {
    t.count += g.count;
    if (g.lastOn > t.lastOn) t.lastOn = g.lastOn;
  }
}

/** 건수 desc → 최근 날짜 desc → tie 키 asc 중 첫 번째 */
function best(map: Map<string, Tally>, tieOrder: (key: string) => number | string): string | null {
  let result: string | null = null;
  let top: Tally | null = null;
  for (const [key, t] of map) {
    if (
      !top ||
      t.count > top.count ||
      (t.count === top.count &&
        (t.lastOn > top.lastOn ||
          (t.lastOn === top.lastOn && tieOrder(key) < tieOrder(result as string))))
    ) {
      result = key;
      top = t;
    }
  }
  return result;
}

/**
 * 그룹별 집계에서 유형당 limit개의 거래처 제안을 고른다.
 * 거래처마다 카테고리·결제수단은 가장 자주 쓴 값(동률은 최근, 다음은 id/목록 순서)이고,
 * 거래처는 총 건수 → 최근 날짜 → 이름 순으로 정렬한다.
 */
export function pickMerchantSuggestions(
  rows: MerchantGroup[],
  limit = 100,
): Record<TxType, MerchantSuggestion[]> {
  const result: Record<TxType, MerchantSuggestion[]> = { INCOME: [], EXPENSE: [] };
  for (const type of ["INCOME", "EXPENSE"] as const) {
    const byMerchant = new Map<string, MerchantGroup[]>();
    for (const r of rows) {
      if (r.type !== type) continue;
      const list = byMerchant.get(r.merchant);
      if (list) list.push(r);
      else byMerchant.set(r.merchant, [r]);
    }
    const entries = [...byMerchant].map(([merchant, groups]) => {
      const categories = new Map<string, Tally>();
      const methods = new Map<string, Tally>();
      const total: Tally = { count: 0, lastOn: "" };
      for (const g of groups) {
        addTally(categories, g.categoryId, g);
        if (g.paymentMethod) addTally(methods, g.paymentMethod, g);
        total.count += g.count;
        if (g.lastOn > total.lastOn) total.lastOn = g.lastOn;
      }
      const suggestion: MerchantSuggestion = {
        merchant,
        categoryId: best(categories, (k) => k) as string,
        paymentMethod: best(methods, (k) =>
          PAYMENT_METHODS.indexOf(k as (typeof PAYMENT_METHODS)[number]),
        ) as MerchantSuggestion["paymentMethod"],
      };
      return { suggestion, total };
    });
    entries.sort(
      (a, b) =>
        b.total.count - a.total.count ||
        (a.total.lastOn < b.total.lastOn ? 1 : a.total.lastOn > b.total.lastOn ? -1 : 0) ||
        (a.suggestion.merchant < b.suggestion.merchant ? -1 : a.suggestion.merchant > b.suggestion.merchant ? 1 : 0),
    );
    result[type] = entries.slice(0, limit).map((e) => e.suggestion);
  }
  return result;
}
