# Recurring Expense (고정지출)

매월 같은 일자에 지출 거래를 자동 등록한다. 지출만 지원 (수입·주간·연간·일시중지 없음).

## 입력 (`recurringSchema`)

| 필드 | 필수 | 규칙 |
| --- | --- | --- |
| `categoryId` | ✓ | 지출 카테고리, 보관되지 않은 것 (수정 시 현재 보관 카테고리는 유지 가능) |
| `item` 지출 내역 | ✓ | trim, 1~100자 |
| `amount` | ✓ | 1 ~ 10억 |
| `dayOfMonth` 매월 일자 | ✓ | 1~31 |
| `merchant`, `paymentMethod`, `memo` | | 거래와 같은 규칙 |

## 발생일 규칙 (`src/lib/recurring.ts`)

- 그 달에 일자가 없으면 말일: `occurrenceIn(ym, day) = ym-min(day, 말일)`. 매번 원래 `dayOfMonth`로 다시 계산 (1/31 → 2/28 → 3/31).
- 등록 시 첫 발생일: `occurrenceOnOrAfter(day, today)` — 오늘이 그 날이면 오늘, 이미 지났으면 다음 달.
- 미래 날짜 거래는 미리 만들지 않는다. 그 날이 된 뒤 생성.

## 자동 등록 (`materializeRecurring(today)`)

- 시점: 인증된 앱 페이지 5개(`/`, `/calendar`, `/transactions`, `/recurring`, `/budgets`)가 렌더할 때 `requireSession()` 직후 호출. 크론 없음.
- 대상: `nextRunOn <= today`인 항목. `dueDates`로 밀린 발생일을 모두 생성(여러 달 몰아서 가능).
- 생성 거래: `type EXPENSE`, `amount`, `categoryId`, `item`, `merchant`, `paymentMethod`, `memo`, `purpose = null`, `recurringExpenseId`.
- 중복 방지: 트랜잭션 안에서 `nextRunOn`이 그대로일 때만 커서를 옮기고(`updateMany` count 1) 그 다음에 거래를 insert.
- 생성된 거래는 일반 거래처럼 수정·삭제 가능. **삭제해도 다시 생기지 않는다** (커서가 이미 지나감).
- 카테고리가 나중에 보관돼도 생성은 계속된다.
- 실패 격리: 항목 하나의 트랜잭션이 실패하면 롤백하고 서버 로그(`[recurring] materialize failed <id>`)만 남긴 뒤 다음 항목을 처리한다. 페이지는 정상 렌더되고, 커서가 그대로라 다음 렌더에서 다시 시도한다. 화면에는 실패를 표시하지 않는다(목록의 "다음 등록"이 지난 날짜로 남음). 대상 조회 자체가 실패하면 그대로 오류.
- 계속 실패하는 항목은 삭제로 정리한다. 수정(`updateRecurring`)은 같은 생성 단계를 먼저 거치므로 함께 실패한다.

## 수정 (`updateRecurring`)

1. `SELECT ... FOR UPDATE`로 행 잠금
2. 먼저 도래분 materialize (수정 전 값으로)
3. 카테고리 검증
4. 일자가 바뀌면 `nextRunOn = occurrenceOnOrAfter(newDay, max(today, lastRunOn 다음 달 1일))`
   - 새 날짜가 이번 달에 이미 지났으면 다음 달부터
   - 이번 달 것이 이미 생성됐으면 이번 달에 다시 만들지 않음
5. 금액·카테고리 등 변경은 앞으로 생성될 거래에만 적용 (기존 거래 불변)

## 삭제

- 고정지출 행만 삭제. 이미 생성된 거래는 남고 `recurringExpenseId`가 `null`이 된다 (`SetNull`).
- 없는 항목: `"이미 삭제되었거나 존재하지 않는 고정지출입니다"`.

## 예정 표시 (`upcomingIn(month, items)`)

- 캘린더에서 표시 월의 발생일이 `nextRunOn` 이상인 항목을 회색 "예정"으로 표시.
- 대시보드 "남은 고정지출" 카드도 같은 함수로 선택 월의 예정 목록과 합계를 보여 준다.
- 예정 금액은 합계·대시보드 요약·예산에 포함하지 않는다. 예외: 대시보드 "하루 사용 가능 금액"은 남은 예산에서 예정 합계를 뺀다 ([budget.md](budget.md)).

## 운영 주의

- 모든 앱 페이지가 렌더 시 `RecurringExpense`를 조회하므로 마이그레이션 없이 배포하면 전 페이지가 오류. → `README.md` "배포".
