# Budget

## 구조

- 전체 예산(`MonthlyBudget`): 월 전체 **지출** 한도. 월당 1행. 별도로 입력한다 (카테고리 합계로 자동 계산하지 않음).
- 카테고리 예산(`CategoryBudget`): 월 × **지출** 카테고리 한도. 수입 카테고리에는 설정 불가 → `"지출 카테고리에만 예산을 설정할 수 있습니다"`.
- 해당 월에만 적용. 이월·복사 없음.
- 금액 1 ~ 10억 정수. 빈 값 = 미설정 → 행 삭제. 값이 있으면 upsert.

## 계산 (`src/lib/budget.ts`, 순수 함수)

| 값 | 식 |
| --- | --- |
| 사용액 `spent` | 해당 월 지출 거래 합계 (전체는 월 지출 합계 1회 계산, 카테고리 합산 아님) |
| 사용률 `rate` | `round(spent / budget × 1000) / 10` (소수 1자리). 예산 없음 또는 ≤ 0이면 `null` |
| 잔여 `remaining` | `budget − spent`, 예산 없으면 `null` |
| 초과 `over` | 예산이 있고 `spent > budget` |
| 초과액 `overAmount` | `over`면 `spent − budget`, 아니면 0 |
| 배정 합계 `allocated` | 카테고리 예산 합 |
| 미배정 `unallocated` | `total − allocated`, 전체 예산 없으면 `null` |
| 배정 경고 `allocationWarning` | 전체 예산이 있고 `allocated > total` |

## 표시

- `BudgetMeter`: 예산 없으면 사용액만, 있으면 잔여·사용률·진행바, 초과 시 빨간 배지 `초과 N원` (진행바는 100%에서 멈춤).
- 예산 페이지 카테고리 목록: 활성 지출 카테고리 + 그 달에 예산이나 지출이 있는 보관 카테고리.
- 대시보드: 남은 예산 카드, 예산 진행 카드, 차트에 카테고리별 사용률.
- 고정지출 "예정" 금액은 사용액에 포함하지 않는다 (등록된 거래만).

## 하루 사용 가능 금액 (`dailyAllowance`, 대시보드 "전체 예산" 카드)

| 값 | 식 |
| --- | --- |
| 남은 일수 `daysLeft` | `말일 − 오늘 일자 + 1` (오늘 포함, `today` 문자열 기준) |
| 예정액 `upcomingTotal` | 선택 월 `upcomingIn` 합계 (등록 실패로 지난 날짜에 남은 예정 포함) |
| 가용액 `available` | `remaining − upcomingTotal` |
| 하루 금액 `perDay` | `available > 0`이면 `floor(available / daysLeft)`, 아니면 0 |

- 선택 월이 서울 기준 이번 달이고, 전체 예산이 있고, 초과가 아닐 때만 표시 (그 외 `null` → 숨김).
- 문구: `available > 0`이면 "하루 N원 사용 가능 · 남은 D일" + 예정액이 있으면 "(고정지출 예정 M원 제외)". `available ≤ 0`이면 예정액이 있을 때 "남은 고정지출을 빼면 쓸 수 있는 예산이 없습니다", 없을 때 "남은 예산이 없습니다".
- 예정액 차감은 이 표시에만 적용한다. `spent`·`remaining`·`rate`는 그대로 등록된 거래 기준.
