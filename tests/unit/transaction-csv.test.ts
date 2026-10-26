import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  TRANSACTION_CSV_HEADERS,
  formatTransactionsCsv,
  parseCsv,
  parseTransactionsCsv,
  toCsv,
  type CsvCategory,
  type CsvTransaction,
} from "@/lib/transaction-csv";
import type { TransactionDto } from "@/server/transactions";
import type { CategoryDto } from "@/server/categories";

const HEADER = TRANSACTION_CSV_HEADERS.join(",");

const categories: CsvCategory[] = [
  { id: "c-food", name: "식비", type: "EXPENSE", archived: false },
  { id: "c-old", name: "옛날", type: "EXPENSE", archived: true },
  { id: "c-salary", name: "급여", type: "INCOME", archived: false },
];

function rowsOf(text: string): string[][] {
  const r = parseCsv(text);
  if (!r.ok) throw new Error("파싱 실패");
  return r.rows;
}

function failed(text: string) {
  const r = parseTransactionsCsv(text, categories);
  if (r.ok) throw new Error("실패해야 합니다");
  return r;
}

describe("상수와 타입", () => {
  it("상한과 헤더 개수", () => {
    expect(MAX_IMPORT_ROWS).toBe(5000);
    expect(MAX_IMPORT_BYTES).toBe(800_000);
    expect(TRANSACTION_CSV_HEADERS).toHaveLength(9);
  });
  it("TransactionDto, CategoryDto가 구조적 타입을 만족한다 (컴파일 검사)", () => {
    const tx = {} as TransactionDto;
    const cat = {} as CategoryDto;
    const txs: readonly CsvTransaction[] = [tx];
    const cats: readonly CsvCategory[] = [cat];
    expect([txs, cats]).toBeDefined();
  });
});

describe("parseCsv", () => {
  it("따옴표 안의 쉼표, 줄바꿈, 이중 따옴표를 처리한다", () => {
    expect(rowsOf('a,"b,c","d\ne","f""g"\r\n1,2,3,4')).toEqual([
      ["a", "b,c", "d\ne", 'f"g'],
      ["1", "2", "3", "4"],
    ]);
  });
  it("따옴표 없는 칸 안의 따옴표는 글자 그대로 둔다", () => {
    expect(rowsOf('a"b,5" 모니터')).toEqual([['a"b', '5" 모니터']]);
  });
  it("CRLF와 LF가 섞여도 처리하고 마지막 개행은 무시한다", () => {
    expect(rowsOf("a,b\r\nc,d\ne,f\r\n")).toEqual([["a", "b"], ["c", "d"], ["e", "f"]]);
    expect(rowsOf("a,b\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("빈 줄은 빈 칸 하나인 행이 되고, 끝의 빈 칸은 보존한다", () => {
    expect(rowsOf("a,b\n\nc,")).toEqual([["a", "b"], [""], ["c", ""]]);
  });
  it("앞의 BOM을 제거한다", () => {
    expect(rowsOf("\uFEFFa,b")).toEqual([["a", "b"]]);
  });
  it("빈 문자열은 행이 없다", () => {
    expect(rowsOf("")).toEqual([]);
  });
  it("닫히지 않은 따옴표는 실패한다", () => {
    expect(parseCsv('a,"b')).toEqual({ ok: false });
  });
});

describe("toCsv", () => {
  it("쉼표, 따옴표, 개행이 든 셀만 따옴표로 감싸고 CRLF로 잇는다", () => {
    expect(toCsv([["a", "b,c", 'd"e'], ["f\ng", "h\ri", ""]])).toBe(
      'a,"b,c","d""e"\r\n"f\ng","h\ri",',
    );
  });
  it("parseCsv로 되돌아온다", () => {
    const rows = [["a,b", 'c"d', "e\r\nf", ""], ["", "", "", ""]];
    expect(rowsOf(toCsv(rows))).toEqual(rows);
  });
});

describe("toCsv 수식 주입 방어", () => {
  it("= + - @ ' 로 시작하는 셀 앞에 '를 붙인다", () => {
    expect(toCsv([["=1+1", "+a", "-b", "@c", "'x", "정상"]])).toBe("'=1+1,'+a,'-b,'@c,''x,정상");
  });
  it("접두 뒤에 인용 규칙을 적용한다", () => {
    expect(toCsv([["=a,b"]])).toBe("\"'=a,b\"");
  });
});

describe("formatTransactionsCsv", () => {
  it("BOM, 한국어 라벨, 빈 셀로 출력한다", () => {
    const csv = formatTransactionsCsv([
      {
        type: "EXPENSE",
        amount: 12500,
        occurredOn: "2026-10-21",
        categoryName: "식비",
        merchant: null,
        item: "점심, 커피",
        purpose: null,
        paymentMethod: "CREDIT_CARD",
        memo: null,
      },
    ]);
    expect(csv).toBe(`\uFEFF${HEADER}\r\n2026-10-21,지출,12500,식비,,"점심, 커피",,신용카드,`);
  });
});

describe("parseTransactionsCsv 헤더와 행 수", () => {
  const row = "2026-10-21,지출,12500,식비,,,,,";

  it("순서가 바뀐 헤더도 이름으로 찾는다", () => {
    const header = [...TRANSACTION_CSV_HEADERS].reverse().join(",");
    const r = parseTransactionsCsv(`${header}\n,,,,,식비,12500,지출,2026-10-21`, categories);
    expect(r).toMatchObject({ ok: true, inputs: [{ amount: 12500, occurredOn: "2026-10-21" }] });
  });
  it("미종결 따옴표는 형식 오류다", () => {
    expect(failed(`${HEADER}\n"${row}`).error).toBe("CSV 형식이 올바르지 않습니다");
  });
  it("누락된 열과 철자 틀린 선택 열은 파일 오류다", () => {
    const header = HEADER.replace("메모", "비고");
    const r = failed(`${header}\n${row}`);
    expect(r.error).toBe("헤더를 확인하세요: 없는 열 [메모], 알 수 없는 열 [비고]");
    expect(r.rowErrors).toBeUndefined();
  });
  it("모르는 열이 추가돼도 오류다", () => {
    expect(failed(`${HEADER},기타\n${row},`).error).toBe("헤더를 확인하세요: 알 수 없는 열 [기타]");
  });
  it("중복 열은 오류다", () => {
    expect(failed(`${HEADER},날짜\n${row},`).error).toContain("중복 열 [날짜]");
  });
  it("헤더 칸의 앞뒤 공백은 무시한다", () => {
    const header = TRANSACTION_CSV_HEADERS.map((h) => ` ${h} `).join(",");
    expect(parseTransactionsCsv(`${header}\n${row}`, categories).ok).toBe(true);
  });
  it("데이터가 없으면 오류다 (헤더만, 빈 줄만, 빈 파일)", () => {
    for (const text of [HEADER, `${HEADER}\n\n,,,,,,,,\n`, ""]) {
      expect(failed(text).error).toBe(text === "" ? "헤더를 확인하세요: 없는 열 [날짜, 유형, 금액, 카테고리, 거래처, 구매 항목, 구매 이유, 결제 수단, 메모]" : "가져올 거래가 없습니다");
    }
  });
  it("5,000행은 허용하고 5,001행은 거부한다", () => {
    const make = (n: number) => `${HEADER}\n${Array(n).fill(row).join("\n")}`;
    const ok = parseTransactionsCsv(make(5000), categories);
    expect(ok.ok && ok.inputs).toHaveLength(5000);
    expect(failed(make(5001)).error).toBe("한 번에 5,000건까지 가져올 수 있습니다");
  });
});

describe("parseTransactionsCsv 행 처리", () => {
  it("정상 행을 입력으로 바꾼다 (쉼표 금액, 선택 항목 null)", () => {
    const r = parseTransactionsCsv(
      `${HEADER}\n2026-10-21,지출,"12,500",식비,GS25,삼각김밥,,현금,\n2026-10-25,수입,3000000,급여,,,,,월급`,
      categories,
    );
    expect(r).toEqual({
      ok: true,
      inputs: [
        {
          type: "EXPENSE",
          amount: 12500,
          occurredOn: "2026-10-21",
          categoryId: "c-food",
          merchant: "GS25",
          item: "삼각김밥",
          purpose: null,
          memo: null,
          paymentMethod: "CASH",
        },
        {
          type: "INCOME",
          amount: 3000000,
          occurredOn: "2026-10-25",
          categoryId: "c-salary",
          merchant: null,
          item: null,
          purpose: null,
          memo: "월급",
          paymentMethod: null,
        },
      ],
    });
  });
  it("빈 줄은 건너뛰되 행 번호는 소비한다", () => {
    const r = failed(`${HEADER}\n2026-10-21,지출,100,식비,,,,,\n\n,,,,,,,,\n2026-10-22,지출,abc,식비,,,,,`);
    expect(r.error).toBe("1개 행에 오류가 있습니다");
    expect(r.rowErrors).toEqual(["5행: 금액은 숫자로 입력하세요"]);
  });
  it("셀 안에 줄바꿈이 있어도 행 번호는 레코드 순번이다", () => {
    const r = failed(`${HEADER}\n2026-10-21,지출,100,식비,,,,,"여러\n줄"\n2026-10-22,지출,x,식비,,,,,`);
    expect(r.rowErrors).toEqual(["3행: 금액은 숫자로 입력하세요"]);
  });
  it("유형, 날짜, 결제 수단 셀의 앞뒤 공백을 무시한다", () => {
    const r = parseTransactionsCsv(
      `${HEADER}\n 2026-10-21 , 지출 ,100, 식비 ,,,, 체크카드 ,`,
      categories,
    );
    expect(r).toMatchObject({
      ok: true,
      inputs: [{ type: "EXPENSE", occurredOn: "2026-10-21", paymentMethod: "DEBIT_CARD" }],
    });
  });
  it("필드별 매핑 오류 메시지", () => {
    const r = failed(
      `${HEADER}\n2026-10-21,기타,100,식비,,,,,\n2026-10-21,지출,abc,식비,,,,,\n2026-10-21,지출,100,식비,,,,수표,\n2026-10-21,지출,100,없는곳,,,,,`,
    );
    expect(r.error).toBe("4개 행에 오류가 있습니다");
    expect(r.rowErrors).toEqual([
      "2행: 유형은 수입 또는 지출이어야 합니다",
      "3행: 금액은 숫자로 입력하세요",
      "4행: 결제 수단이 올바르지 않습니다",
      "5행: 카테고리 '없는곳'을(를) 찾을 수 없습니다",
    ]);
  });
  it("스키마 오류를 전달한다 (날짜, 금액 범위, 카테고리 비움)", () => {
    const r = failed(
      `${HEADER}\n2026-02-30,지출,100,식비,,,,,\n2026-10-21,지출,0,식비,,,,,\n2026-10-21,지출,100,,,,,,`,
    );
    expect(r.rowErrors).toEqual([
      "2행: 올바른 날짜가 아닙니다",
      "3행: 금액은 1원 이상이어야 합니다",
      "4행: 카테고리를 선택하세요",
    ]);
  });
  it("한 행에 여러 오류가 있으면 각각 보고하고 오류 행 수는 한 번만 센다", () => {
    const r = failed(`${HEADER}\n2026-13-01,지출,abc,식비,,,,,`);
    expect(r.error).toBe("1개 행에 오류가 있습니다");
    expect(r.rowErrors).toEqual(["2행: 금액은 숫자로 입력하세요", "2행: 올바른 날짜가 아닙니다"]);
  });
  it("유형이 무효면 카테고리 오류를 내지 않는다", () => {
    const r = failed(`${HEADER}\n2026-10-21,기타,100,없는곳,,,,,`);
    expect(r.rowErrors).toEqual(["2행: 유형은 수입 또는 지출이어야 합니다"]);
  });
  it("금액 abc는 금액 오류 하나만 낸다", () => {
    expect(failed(`${HEADER}\n2026-10-21,지출,abc,식비,,,,,`).rowErrors).toEqual([
      "2행: 금액은 숫자로 입력하세요",
    ]);
  });
  it("다른 유형에만 있는 카테고리 이름은 찾을 수 없다", () => {
    expect(failed(`${HEADER}\n2026-10-21,지출,100,급여,,,,,`).rowErrors).toEqual([
      "2행: 카테고리 '급여'을(를) 찾을 수 없습니다",
    ]);
  });
  it("보관된 카테고리는 오류다", () => {
    expect(failed(`${HEADER}\n2026-10-21,지출,100,옛날,,,,,`).rowErrors).toEqual([
      "2행: 보관된 카테고리는 사용할 수 없습니다",
    ]);
  });
  it("헤더보다 많은 칸에 값이 있으면 오류다 (빈 칸만 넘치면 허용)", () => {
    expect(failed(`${HEADER}\n2026-10-21,지출,100,식비,,,,,,넘침`).rowErrors).toEqual([
      "2행: 열 개수가 헤더보다 많습니다",
    ]);
    expect(parseTransactionsCsv(`${HEADER}\n2026-10-21,지출,100,식비,,,,,,`, categories).ok).toBe(true);
  });
  it("헤더 끝의 빈 칸은 무시하고, 그 칸에 값이 있으면 행 오류다", () => {
    expect(parseTransactionsCsv(`${HEADER},,\n2026-10-21,지출,100,식비,,,,,,,`, categories).ok).toBe(true);
    expect(failed(`${HEADER},,\n2026-10-21,지출,100,식비,,,,,,,넘침`).rowErrors).toEqual([
      "2행: 열 개수가 헤더보다 많습니다",
    ]);
  });
  it("오류 행이 섞이면 모든 행을 끝까지 검사해 오류만 돌려준다", () => {
    const r = failed(`${HEADER}\n2026-10-21,지출,100,식비,,,,,\nx,지출,100,식비,,,,,\n2026-10-21,지출,y,식비,,,,,`);
    expect(r.error).toBe("2개 행에 오류가 있습니다");
    expect(r.rowErrors).toHaveLength(2);
  });
});

describe("왕복", () => {
  it("formatTransactionsCsv -> parseTransactionsCsv 결과가 원래 입력과 같다", () => {
    const rows: CsvTransaction[] = [
      {
        type: "EXPENSE",
        amount: 12500,
        occurredOn: "2026-10-21",
        categoryName: "식비",
        merchant: 'GS25 "본점"',
        item: "점심, 커피",
        purpose: "회의",
        paymentMethod: "BANK_TRANSFER",
        memo: "첫 줄\r\n둘째 줄",
      },
      {
        type: "INCOME",
        amount: 3_000_000,
        occurredOn: "2026-10-25",
        categoryName: "급여",
        merchant: null,
        item: null,
        purpose: null,
        paymentMethod: null,
        memo: null,
      },
    ];
    const r = parseTransactionsCsv(formatTransactionsCsv(rows), categories);
    expect(r).toEqual({
      ok: true,
      inputs: [
        {
          type: "EXPENSE",
          amount: 12500,
          occurredOn: "2026-10-21",
          categoryId: "c-food",
          merchant: 'GS25 "본점"',
          item: "점심, 커피",
          purpose: "회의",
          paymentMethod: "BANK_TRANSFER",
          memo: "첫 줄\r\n둘째 줄",
        },
        {
          type: "INCOME",
          amount: 3_000_000,
          occurredOn: "2026-10-25",
          categoryId: "c-salary",
          merchant: null,
          item: null,
          purpose: null,
          paymentMethod: null,
          memo: null,
        },
      ],
    });
  });
});

describe("수식 주입 방어 왕복", () => {
  it("위험한 첫 글자의 메모를 원래 문자열로 복원한다", () => {
    const memos = ['=HYPERLINK("x")', "'=a", "'안녕"];
    const csv = formatTransactionsCsv(
      memos.map((memo) => ({
        type: "EXPENSE",
        amount: 1000,
        occurredOn: "2026-10-21",
        categoryName: "식비",
        merchant: null,
        item: null,
        purpose: null,
        paymentMethod: null,
        memo,
      })),
    );
    const r = parseTransactionsCsv(csv, categories);
    if (!r.ok) throw new Error("파싱 실패");
    expect(r.inputs.map((i) => i.memo)).toEqual(memos);
  });
});
