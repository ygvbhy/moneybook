// 순수 날짜 함수. 로컬 TZ 메서드(getDate 등)는 쓰지 않는다.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

const seoulFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const pad = (n: number) => String(n).padStart(2, "0");

/** 서울 기준 오늘 (YYYY-MM-DD) */
export function todayInSeoul(now: Date = new Date()): string {
  return seoulFormatter.format(now);
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

// Date.UTC는 0~99년을 1900년대로 바꾸고, 9999-12의 다음 달(10000-01)은 toDbDate가 거부한다.
// 그래서 유효 연도는 1900~9998로 제한한다 (shiftMonth("9998-12", 1) = "9999-01"은 계산값으로만 허용).
const MIN_YEAR = 1900;
const MAX_YEAR = 9998;

/** "YYYY-MM"이 유효(연도 1900~9998)하면 {year, month}, 아니면 null */
export function parseYearMonth(
  value: unknown,
): { year: number; month: number } | null {
  if (typeof value !== "string") return null;
  const m = MONTH_RE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) return null;
  return { year, month };
}

export function isValidYearMonth(value: unknown): value is string {
  return parseYearMonth(value) !== null;
}

/** 유효한 "YYYY-MM"이면 그대로, 아니면 today가 속한 달 */
export function normalizeMonthParam(
  param: string | null | undefined,
  today: string,
): string {
  return isValidYearMonth(param) ? param : today.slice(0, 7);
}

export function shiftMonth(ym: string, delta: number): string {
  const p = parseYearMonth(ym);
  if (!p) throw new Error(`Invalid year-month: ${ym}`);
  const d = new Date(Date.UTC(p.year, p.month - 1 + delta, 1));
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${pad(d.getUTCMonth() + 1)}`;
}

/** month를 끝으로 과거 count개월을 오래된 순으로. 유효 연도(1900~) 밖의 달은 뺀다 */
export function recentMonths(month: string, count: number): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = shiftMonth(month, -i);
    if (isValidYearMonth(m)) months.push(m);
  }
  return months;
}

/** "YYYY-MM"의 말일(일자 숫자) */
export function lastDayOfMonth(ym: string): number {
  const p = parseYearMonth(ym);
  if (!p) throw new Error(`Invalid year-month: ${ym}`);
  return new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
}

/** 반열린 구간 [start, endExclusive) */
export function monthRange(ym: string): { start: string; endExclusive: string } {
  return { start: `${ym}-01`, endExclusive: `${shiftMonth(ym, 1)}-01` };
}

export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** 'YYYY-MM-DD' -> UTC 자정 Date (Prisma DATE 저장용) */
export function toDbDate(dateStr: string): Date {
  if (!isValidDateString(dateStr)) throw new Error(`Invalid date: ${dateStr}`);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromDbDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export type GridCell = { date: string; inMonth: boolean };

/** 월요일 시작 6주(42칸) 그리드 */
export function buildMonthGrid(ym: string): GridCell[] {
  const p = parseYearMonth(ym);
  if (!p) throw new Error(`Invalid year-month: ${ym}`);
  const first = new Date(Date.UTC(p.year, p.month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // 월=0 ... 일=6
  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(p.year, p.month - 1, 1 - offset + i));
    cells.push({
      date: fromDbDate(d),
      inMonth: d.getUTCMonth() === p.month - 1,
    });
  }
  return cells;
}
