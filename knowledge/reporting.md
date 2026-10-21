# Reporting (집계·표시)

공통: 집계는 조회 시 계산 (저장 안 함). 수입과 지출은 따로 합산. 기간은 선택 월 `[01, 다음 달 01)`. 등록된 거래만 포함 (고정지출 예정 제외).

## 대시보드 (`/`, `server/dashboard.ts`)

| 영역 | 규칙 |
| --- | --- |
| 요약 카드 | 총수입, 총지출, 순현금흐름(`수입 − 지출`, "계좌 잔고 아님" 표기), 남은 예산(미설정 시 "예산 미설정") |
| 예산 진행 | 전체 예산 `BudgetOverview` ([budget.md](budget.md)) |
| 카테고리별 지출 | 지출만, 금액 내림차순, 동률은 `categoryId` 순. 카테고리 예산 사용률·초과 함께 표시. 지출 없으면 "이 달의 지출이 없습니다" |
| 최근 거래 | 선택 월 안에서 `occurredOn desc, createdAt desc` 5건 |

## 캘린더 (`/calendar`, `server/calendar.ts`)

- 월요일 시작 6주 그리드. 앞뒤 달 칸은 흐리게, 선택 불가.
- 날짜 칸: 일별 수입·지출 합계, 거래 유무, 오늘 강조, 예정 고정지출(회색). `sm`(640px) 이상은 전체 금액, 미만은 축약 금액(`formatCompactKRW`) + 거래 점.
- 날짜 선택(`?date=`): 그날 거래 목록(생성 순) + 예정 항목 + 이 날짜로 거래 추가.
- 거래 클릭 → 수정 다이얼로그.

## 거래 내역 (`/transactions`)

필터·검색·정렬과 합계 규칙은 [transaction.md](transaction.md).

## 순수 집계 함수 (`src/lib/aggregate.ts`)

`summarize`, `dailyTotals`, `categoryTotals` — DB 쿼리와 같은 규칙의 순수 버전 (단위 테스트 대상).
