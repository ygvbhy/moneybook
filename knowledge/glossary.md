# Glossary

| 화면 용어 | 코드 식별자 | 의미 |
| --- | --- | --- |
| 거래 | `Transaction`, `TransactionDto` | 수입 또는 지출 1건 |
| 유형 | `type`, `TransactionType` | `INCOME`(수입) / `EXPENSE`(지출). `TYPE_LABELS` |
| 금액 | `amount` | KRW 정수, 항상 양수. 부호는 유형으로 표현 |
| 날짜 | `occurredOn` | 거래 발생 달력 날짜 (서울 기준) |
| 카테고리 | `Category`, `categoryId` | 유형별 분류. 유형마다 이름 고유 |
| 보관됨 | `archivedAt`, `archived` | 숨김 처리된 카테고리 (삭제 아님) |
| 거래처 | `merchant` | |
| 구매 항목 | `item` | 고정지출 화면에서는 "지출 내역" |
| 구매 이유 | `purpose` | 거래 전용 (고정지출에 없음) |
| 결제 수단 | `paymentMethod` | `PAYMENT_METHOD_LABELS`: 현금, 계좌이체, 신용카드, 체크카드, 기타 |
| 메모 | `memo` | |
| 순현금흐름 | `net` | 수입 − 지출. 계좌 잔고가 아님 |
| 전체 예산 | `MonthlyBudget.totalAmount`, `total` | 월 전체 지출 한도 |
| 카테고리 예산 | `CategoryBudget` | 월 × 지출 카테고리 한도 |
| 사용률 | `rate` | 사용액 / 예산 × 100 (소수 1자리) |
| 잔여 / 남은 예산 | `remaining` | 예산 − 사용액 |
| 초과 | `over`, `overAmount` | 사용액 > 예산 |
| 미배정 금액 | `unallocated` | 전체 예산 − 카테고리 예산 합계 |
| 고정지출 | `RecurringExpense`, `recurring` | 매월 같은 날 자동 등록되는 지출 |
| 매월 일자 | `dayOfMonth` | 1~31 |
| 다음 발생일 | `nextRunOn` | 아직 거래로 만들지 않은 다음 발생일 (커서) |
| 마지막 발생일 | `lastRunOn` | 마지막으로 거래를 만든 발생일 |
| 자동 등록 | `materializeRecurring` | 도래한 발생일을 실제 거래로 생성 |
| 예정 | `upcomingIn`, `UpcomingItem` | 아직 등록 전인 이번 표시 월의 발생일 (캘린더 회색) |
| 월 | `month`, `yearMonth`, `ym` | `"YYYY-MM"` |
| 이번 달 / 오늘 | `todayInSeoul()` | 서울 기준 |
