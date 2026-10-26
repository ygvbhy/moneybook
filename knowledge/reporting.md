# Reporting (집계·표시)

공통: 집계는 조회 시 계산 (저장 안 함). 수입과 지출은 따로 합산. 기간은 선택 월 `[01, 다음 달 01)`. 등록된 거래만 포함 (고정지출 예정 제외).

## 대시보드 (`/`, `server/dashboard.ts`)

| 영역 | 규칙 |
| --- | --- |
| 요약 카드 | 총수입, 총지출, 순현금흐름(`수입 − 지출`, "계좌 잔고 아님" 표기), 남은 예산(미설정 시 "예산 미설정"). 총수입·총지출·순현금흐름 아래 "전월 대비 ▲/▼금액"(`formatKRWDelta`, 0이면 "변동 없음", 색 없이 회색). 전월이 유효 범위(1900~) 밖이면 생략 |
| 예산 진행 | 전체 예산 `BudgetOverview` + 이번 달이면 하루 사용 가능 금액 ([budget.md](budget.md)) |
| 남은 고정지출 | 선택 월의 예정 고정지출(`upcomingIn`) 목록과 합계, 회색. 항목·"고정지출 관리" → `/recurring`. 없으면 "남은 고정지출이 없습니다". 지난달은 비고 다음 달 이후는 전체 |
| 월별 추이 | 선택 월을 끝으로 최근 6개월(`recentMonths`, 1900년 이전 달 제외) 월별 수입·지출 묶음 막대. 거래 없는 달은 0. 6개월 모두 0이면 "최근 6개월 거래가 없습니다" |
| 카테고리별 지출 | 지출만, 금액 내림차순, 동률은 `categoryId` 순. 카테고리 예산 사용률·초과 함께 표시. 둘째 줄에 전월 대비 증감(전월 지출 없으면 전액 증가). 선택 월 지출이 없는 카테고리는 전월에 있었어도 표시하지 않음. 지출 없으면 "이 달의 지출이 없습니다". 막대(클릭·탭)와 카테고리 이름(키보드 링크) → `/transactions?month=<선택 월>&type=EXPENSE&category=<id>` |
| 최근 거래 | 선택 월 안에서 `occurredOn desc, createdAt desc` 5건 |
| 결제수단별 지출 | 지출만 `getPaymentMethodSpending`. 결제 수단 없는 거래는 "미지정". 금액 내림차순, 동률은 `PAYMENT_METHODS` 순, 미지정은 마지막. 행마다 `-금액`·비중(소수 1자리)·진행바. 행 전체가 링크 → `/transactions?month=<선택 월>&type=EXPENSE&payment=<값\|none>`. 지출 없으면 "이 달의 지출이 없습니다" |

## 캘린더 (`/calendar`, `server/calendar.ts`)

- 월요일 시작 6주 그리드. 앞뒤 달 칸은 흐리게, 선택 불가.
- 날짜 칸: 일별 수입·지출 합계, 거래 유무, 오늘 강조, 예정 고정지출(회색). `sm`(640px) 이상은 전체 금액, 미만은 축약 금액(`formatCompactKRW`) + 거래 점.
- 날짜 선택(`?date=`): 그날 거래 목록(생성 순) + 예정 항목 + 이 날짜로 거래 추가.
- 거래 클릭 → 수정 다이얼로그.

## 거래 내역 (`/transactions`)

필터·검색·정렬과 합계 규칙은 [transaction.md](transaction.md).

## 연간 요약 (`/reports`, `server/reports.ts`)

- `?year=YYYY` (`normalizeYearParam`: 1900~9998 정수가 아니면 서울 기준 올해). 기간은 `[YYYY-01-01, (YYYY+1)-01-01)`.
- 월별: `getMonthlyTrend("YYYY-12", 12)` 재사용 → 1~12월, 거래 없는 달·미래 달은 0. 연 총수입·총지출·순수입은 이 12개월 합(추가 쿼리 없음). 순수입 표기는 순현금흐름과 같음(양수 `+` 파랑, 음수 `-` 빨강).
- 구성: 요약 3칸 → 월별 추이 막대 차트(`MonthlyTrendChart`) → 월별 표(월·수입·지출·순수입 + 합계 행) → 카테고리별 지출·수입.
- 카테고리별 합계 `getYearCategoryTotals`: `groupBy(["categoryId","type"])` 1회, 유형별로 금액 내림차순(동률 `categoryId`), 보관 카테고리 포함 `(보관됨)`. 행마다 금액·비중(소수 1자리)·진행바.
- 링크: 월 → `/transactions?month=YYYY-MM`, 카테고리 → `/transactions?from=YYYY-01-01&to=YYYY-12-31&type=<T>&category=<id>` (올해가 아니면 `month=YYYY-12` 추가 → 월별로 돌아가면 그 해 12월).
- 연 거래가 0건이면 요약 3칸(0)과 "이 해에는 거래가 없습니다"만 표시.

## 순수 집계 함수 (`src/lib/aggregate.ts`)

`summarize`, `dailyTotals`, `categoryTotals`, `monthlyTotals` — DB 쿼리와 같은 규칙의 순수 버전 (단위 테스트 대상). 월별 추이는 `getMonthlyTrend`가 `groupBy(["occurredOn","type"])` 한 번으로 읽어 `monthlyTotals`로 버킷팅한다(월 단위 raw SQL 없음).
