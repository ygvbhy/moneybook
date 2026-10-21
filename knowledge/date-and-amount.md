# Date & Amount Rules

## 날짜

| 규칙 | 구현 |
| --- | --- |
| 모든 "오늘"·월 집계는 Asia/Seoul 기준 | `todayInSeoul()` (서버 TZ가 UTC여도 안전) |
| 날짜 값은 `"YYYY-MM-DD"`, 월은 `"YYYY-MM"` 문자열 | DTO·props·URL 모두 문자열 |
| DB 저장은 시각 없는 `DATE` | `toDbDate` / `fromDbDate` (UTC 자정 `Date`) |
| 월 범위는 반열린 구간 `[YYYY-MM-01, 다음 달 01)` | `monthRange(ym)` |
| 유효 연도 1900~9998 | `parseYearMonth`, `isValidYearMonth` |
| 존재하지 않는 날짜(2026-02-30) 거부 | `isValidDateString` |
| 잘못된 `month` 파라미터 → 이번 달 | `normalizeMonthParam` |
| 캘린더는 월요일 시작 6주(42칸) | `buildMonthGrid` |
| 날짜 라벨 `"10월 21일 (수)"` | `formatDateLabel` |

### Do / Don't

- Do: `shiftMonth`, `lastDayOfMonth`, `monthOf` 등 `lib/date.ts` 함수를 조합한다.
- Don't: `getDate()`, `getMonth()`, `toLocaleDateString()` 등 로컬 TZ 메서드, 날짜 라이브러리 추가.
- 날짜·집계 변경 후 `npm run test:tz`로 UTC·KST 양쪽 확인.

## 금액

| 규칙 | 구현 |
| --- | --- |
| KRW 정수, `MIN_AMOUNT = 1` ~ `MAX_AMOUNT = 1,000,000,000` | `lib/money.ts`, Zod 스키마 |
| 항상 양수로 저장. 수입/지출은 `type`으로 구분 | |
| 입력: 숫자와 천 단위 쉼표만 허용 | `parseAmountInput`, `AmountInput` |
| 표시: `ko-KR` 천 단위 쉼표 + "원" | `formatKRW` |
| 좁은 칸(캘린더 모바일): 축약 표기 | `formatCompactKRW` |
| 표시 부호: 수입 `+`, 지출 `-` | `AmountText` |

## 검증 메시지 (예)

- `"금액은 1원 이상이어야 합니다"`, `"금액은 10억 원 이하여야 합니다"`, `"올바른 날짜가 아닙니다"`, `"올바른 월 형식(YYYY-MM)이 아닙니다"`.
