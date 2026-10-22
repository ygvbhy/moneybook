import { PAYMENT_METHOD_LABELS, TYPE_LABELS } from "@/lib/labels";
import { parseAmountInput } from "@/lib/money";
import {
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  transactionSchema,
  type TransactionInput,
} from "@/lib/validation/transaction";

export const TRANSACTION_CSV_HEADERS = [
  "날짜",
  "유형",
  "금액",
  "카테고리",
  "거래처",
  "구매 항목",
  "구매 이유",
  "결제 수단",
  "메모",
] as const;

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 800_000;

const BOM = "\uFEFF";

/** TransactionDto가 구조적으로 만족하는 내보내기용 거래 (server 타입을 import하지 않기 위해 따로 정의) */
export type CsvTransaction = {
  type: (typeof TRANSACTION_TYPES)[number];
  amount: number;
  occurredOn: string;
  categoryName: string;
  merchant: string | null;
  item: string | null;
  purpose: string | null;
  paymentMethod: (typeof PAYMENT_METHODS)[number] | null;
  memo: string | null;
};

/** CategoryDto가 구조적으로 만족하는 가져오기용 카테고리 */
export type CsvCategory = {
  id: string;
  name: string;
  type: (typeof TRANSACTION_TYPES)[number];
  archived: boolean;
};

/**
 * RFC 4180 파서. 앞의 BOM은 제거하고 CRLF/LF를 모두 처리하며 마지막 개행은 무시한다.
 * 따옴표는 칸의 맨 앞에 올 때만 인용으로 취급하고, 칸 중간의 `"`는 글자 그대로 둔다.
 * 닫히지 않은 따옴표만 실패다.
 */
export function parseCsv(text: string): { ok: true; rows: string[][] } | { ok: false } {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false; // 따옴표 칸 안
  let atCellStart = true;
  let pending = false; // 아직 행에 넣지 않은 내용이 있는지 (마지막 개행 무시용)

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
      pending = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
      atCellStart = true;
      pending = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      atCellStart = true;
      pending = false;
    } else {
      cell += ch;
      atCellStart = false;
      pending = true;
    }
  }
  if (quoted) return { ok: false };
  if (pending) {
    row.push(cell);
    rows.push(row);
  }
  return { ok: true, rows };
}

function escapeCell(cell: string): string {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** `,` `"` 개행이 든 셀만 따옴표로 감싸고 행은 CRLF로 잇는다 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
}

/** BOM(엑셀 한글 호환) + 헤더 + 거래 행. null은 빈 셀이다 */
export function formatTransactionsCsv(rows: readonly CsvTransaction[]): string {
  const body = rows.map((t) => [
    t.occurredOn,
    TYPE_LABELS[t.type],
    String(t.amount),
    t.categoryName,
    t.merchant ?? "",
    t.item ?? "",
    t.purpose ?? "",
    t.paymentMethod ? PAYMENT_METHOD_LABELS[t.paymentMethod] : "",
    t.memo ?? "",
  ]);
  return BOM + toCsv([[...TRANSACTION_CSV_HEADERS], ...body]);
}

export type ParseTransactionsResult =
  | { ok: true; inputs: TransactionInput[] }
  | { ok: false; error: string; rowErrors?: string[] };

function findKey<K extends string>(labels: Record<K, string>, label: string): K | undefined {
  return (Object.keys(labels) as K[]).find((k) => labels[k] === label);
}

/**
 * 내보내기와 같은 형식의 CSV를 거래 입력으로 바꾼다. 헤더는 순서와 무관하게 이름이 정확히 일치해야 하고,
 * 모든 행을 끝까지 검사해 오류를 모은다. 카테고리는 (유형, 이름)으로 매칭한다.
 */
export function parseTransactionsCsv(
  text: string,
  categories: readonly CsvCategory[],
): ParseTransactionsResult {
  const parsed = parseCsv(text);
  if (!parsed.ok) return { ok: false, error: "CSV 형식이 올바르지 않습니다" };

  const [headerRow = [], ...dataRows] = parsed.rows;
  const header = headerRow.map((h) => h.trim());
  // 엑셀이 남기는 헤더 끝의 빈 칸은 버린다. 그 칸에 값이 있는 행은 아래 넘치는 칸 검사가 잡는다
  while (header.length > 0 && header[header.length - 1] === "") header.pop();
  const known: readonly string[] = TRANSACTION_CSV_HEADERS;
  const missing = known.filter((h) => !header.includes(h));
  const unknown = header.filter((h) => !known.includes(h));
  const duplicated = [...new Set(header.filter((h, i) => header.indexOf(h) !== i))];
  if (missing.length || unknown.length || duplicated.length) {
    const parts: string[] = [];
    if (missing.length) parts.push(`없는 열 [${missing.join(", ")}]`);
    if (unknown.length) parts.push(`알 수 없는 열 [${unknown.join(", ")}]`);
    if (duplicated.length) parts.push(`중복 열 [${duplicated.join(", ")}]`);
    return { ok: false, error: `헤더를 확인하세요: ${parts.join(", ")}` };
  }

  const col = Object.fromEntries(known.map((h) => [h, header.indexOf(h)]));
  const records = dataRows
    .map((cells, i) => ({ rowNo: i + 2, cells: cells.map((c) => c.trim()) }))
    .filter((r) => r.cells.some((c) => c !== ""));
  if (records.length === 0) return { ok: false, error: "가져올 거래가 없습니다" };
  if (records.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: "한 번에 5,000건까지 가져올 수 있습니다" };
  }

  const inputs: TransactionInput[] = [];
  const rowErrors: string[] = [];
  let errorRows = 0;

  for (const { rowNo, cells } of records) {
    const get = (name: (typeof TRANSACTION_CSV_HEADERS)[number]) => cells[col[name]] ?? "";
    const messages: string[] = [];
    const mapFailed = new Set<string>();

    // 헤더보다 많은 칸에 값이 있으면 조용히 버리지 않고 오류로 본다
    if (cells.slice(header.length).some((c) => c !== "")) {
      messages.push("열 개수가 헤더보다 많습니다");
    }

    const type = findKey(TYPE_LABELS, get("유형"));
    if (!type) {
      messages.push("유형은 수입 또는 지출이어야 합니다");
      mapFailed.add("type");
      mapFailed.add("categoryId"); // 유형을 모르면 카테고리를 매칭할 수 없다
    }

    const amount = parseAmountInput(get("금액"));
    if (amount === null) {
      messages.push("금액은 숫자로 입력하세요");
      mapFailed.add("amount");
    }

    const paymentLabel = get("결제 수단");
    const paymentMethod = paymentLabel ? findKey(PAYMENT_METHOD_LABELS, paymentLabel) : null;
    if (paymentMethod === undefined) {
      messages.push("결제 수단이 올바르지 않습니다");
      mapFailed.add("paymentMethod");
    }

    // 이름이 빈 경우는 스키마의 "카테고리를 선택하세요"에 맡긴다
    let categoryId = "";
    const categoryName = get("카테고리");
    if (type && categoryName) {
      const category = categories.find((c) => c.type === type && c.name === categoryName);
      if (!category) {
        messages.push(`카테고리 '${categoryName}'을(를) 찾을 수 없습니다`);
        mapFailed.add("categoryId");
      } else if (category.archived) {
        messages.push("보관된 카테고리는 사용할 수 없습니다");
        mapFailed.add("categoryId");
      } else {
        categoryId = category.id;
      }
    }

    const result = transactionSchema.safeParse({
      type,
      amount: amount ?? undefined,
      occurredOn: get("날짜"),
      categoryId,
      merchant: get("거래처"),
      item: get("구매 항목"),
      purpose: get("구매 이유"),
      memo: get("메모"),
      paymentMethod: paymentMethod ?? null,
    });
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (!mapFailed.has(String(issue.path[0]))) messages.push(issue.message);
      }
    }

    if (messages.length > 0) {
      errorRows++;
      rowErrors.push(...messages.map((m) => `${rowNo}행: ${m}`));
    } else if (result.success) {
      inputs.push(result.data);
    }
  }

  if (errorRows > 0) {
    return { ok: false, error: `${errorRows}개 행에 오류가 있습니다`, rowErrors };
  }
  return { ok: true, inputs };
}
