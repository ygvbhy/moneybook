# Backup

앱 데이터 전체를 JSON 파일 하나로 내보내고, 그 파일로 전체를 교체 복원한다.
진입점은 사이드바 하단(테마 전환 위)·모바일 헤더의 "백업" 버튼 (`BackupButton`, `components/app-shell/backup-dialog.tsx`).

## 담는 것

| 담음 | 담지 않음 |
| --- | --- |
| Category(보관 포함), Transaction, RecurringExpense, MonthlyBudget, CategoryBudget | Session, LoginAttempt |

## 파일 형식 (`backupSchema`, `src/lib/validation/backup.ts`)

```json
{
  "format": "moneybook-backup",
  "version": 1,
  "exportedAt": "2026-10-29T03:00:00.000Z",
  "categories": [], "transactions": [], "recurringExpenses": [],
  "monthlyBudgets": [], "categoryBudgets": []
}
```

- id·`createdAt`·`archivedAt`을 그대로 담는다. 복원 후 정렬·보관 상태·고정지출 연결이 원래와 같다.
- 시각(`exportedAt`, `createdAt`, `archivedAt`)은 ISO 8601 UTC, 날짜(`occurredOn`, `nextRunOn`, `lastRunOn`)는 `"YYYY-MM-DD"`.
- 파일명 `moneybook-backup-<오늘>.json`. 내보내기는 읽기 전용.

## 복원 검증 (하나라도 실패하면 아무것도 바꾸지 않음)

- `format`·`version` 일치. 거래·고정지출은 기존 입력 스키마(`transactionSchema`, `recurringSchema`) 규칙, 예산 금액은 1 ~ 1,000,000,000.
- 중복: 각 컬렉션 id, 카테고리 (유형, 이름), 전체 예산 `yearMonth`, 카테고리 예산 (`yearMonth`, `categoryId`).
- 참조: 거래의 카테고리가 있고 유형이 같음, `recurringExpenseId`가 있으면 그 고정지출이 있음, 고정지출·카테고리 예산은 지출 카테고리.
- 보관 카테고리를 가리키는 거래·고정지출도 허용한다(원래 상태 그대로 복원).
- 오류는 `"transactions.3.amount: 메시지"` 형식으로 최대 20개를 `fieldErrors.rows`에 담는다.

## 복원 동작

- **전체 교체**: 5개 테이블을 모두 지우고 파일 내용을 넣는다. 카테고리 하드 삭제 금지 규칙([category.md](category.md))의 유일한 예외다.
- 한 트랜잭션(`$transaction` 배열형, timeout 30초). DB 단계에서 실패해도 전부 롤백된다. 거래는 1,000건씩 나눠 삽입한다(Postgres 파라미터 한도).
- 로그인 세션은 유지된다.
- 화면 흐름: 파일 선택 → 내보낸 시각·항목별 건수 요약 → "복원…" → `AlertDialog` 확인 → 성공 시 "복원했습니다" + 새로고침.

## 크기 한도

- 앱에서 복원할 수 있는 파일은 3.5MB까지 (`MAX_BACKUP_BYTES`). 클라이언트가 파일을 파싱한 객체를 action에 넘기며, Server Action body 한도는 `next.config.ts`에서 `4mb`로 올렸다(기본 1MB, Vercel 요청 한도 약 4.5MB).
- 내보낸 파일이 3.5MB를 넘으면 내보내기는 되지만 "앱에서 복원할 수 없습니다" 경고를 띄운다.
