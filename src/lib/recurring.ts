// 고정지출 날짜 계산. 순수 함수이며 날짜는 "YYYY-MM-DD" 문자열로만 다룬다.
import { lastDayOfMonth, shiftMonth } from "@/lib/date";

const pad = (n: number) => String(n).padStart(2, "0");

/** ym 월의 발생일. 그 달에 day가 없으면 말일 */
export function occurrenceIn(ym: string, day: number): string {
  return `${ym}-${pad(Math.min(day, lastDayOfMonth(ym)))}`;
}

/** date 이상인 첫 발생일. date가 속한 달의 발생일이 지났으면 다음 달의 발생일 */
export function occurrenceOnOrAfter(day: number, date: string): string {
  const ym = date.slice(0, 7);
  const thisMonth = occurrenceIn(ym, day);
  return thisMonth >= date ? thisMonth : occurrenceIn(shiftMonth(ym, 1), day);
}

/** nextRunOn부터 today 이하인 발생일을 모두 모으고, 그 다음 발생일(next)을 돌려준다 */
export function dueDates(
  nextRunOn: string,
  day: number,
  today: string,
): { dates: string[]; next: string } {
  const dates: string[] = [];
  let current = nextRunOn;
  while (current <= today) {
    dates.push(current);
    current = occurrenceIn(shiftMonth(current.slice(0, 7), 1), day);
  }
  return { dates, next: current };
}
