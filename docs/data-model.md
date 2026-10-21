# Data Model

원본: `prisma/schema.prisma`. 도메인 의미는 `knowledge/` 문서 참고.

## 모델

| 모델 | 핵심 컬럼 | 관계·제약 |
| --- | --- | --- |
| `Category` | `name`, `type`, `sortOrder`, `archivedAt?` | `@@unique([type, name])` |
| `Transaction` | `type`, `amount`, `occurredOn`(DATE), `categoryId`, `merchant?`, `item?`, `purpose?`, `paymentMethod?`, `memo?`, `recurringExpenseId?` | Category `Restrict`, RecurringExpense `SetNull`. 인덱스: `occurredOn`, `(categoryId, occurredOn)`, `recurringExpenseId` |
| `RecurringExpense` | `categoryId`, `item`, `amount`, `dayOfMonth`, `merchant?`, `paymentMethod?`, `memo?`, `nextRunOn`(DATE), `lastRunOn?`(DATE) | Category `Restrict`. 인덱스 `nextRunOn` |
| `MonthlyBudget` | `yearMonth`(PK, CHAR(7)), `totalAmount` | 월당 1행 |
| `CategoryBudget` | `yearMonth`, `categoryId`, `amount` | `@@unique([yearMonth, categoryId])`, Category `Restrict` |
| `Session` | `tokenHash`(unique), `expiresAt` | |
| `LoginAttempt` | `ipHash`, `success`, `createdAt` | 인덱스 `createdAt`, `(ipHash, createdAt)` |

Enum: `TransactionType { INCOME, EXPENSE }`, `PaymentMethod { CASH, BANK_TRANSFER, CREDIT_CARD, DEBIT_CARD, OTHER }`.

User 테이블·userId 컬럼은 없다 (단일 관리자, [knowledge/product-scope.md](../knowledge/product-scope.md)).

## 컬럼 규약

| 규약 | 내용 |
| --- | --- |
| id | `String @id @default(cuid())` (MonthlyBudget만 `yearMonth` PK) |
| 금액 | `Int` (KRW 정수) |
| 달력 날짜 | `DateTime @db.Date`. 쓰기 `toDbDate("YYYY-MM-DD")`, 읽기 `fromDbDate(date)` |
| 시각 | `DateTime @db.Timestamptz` (`createdAt`, `updatedAt`, `archivedAt`, `expiresAt`) |
| 월 | `String @db.Char(7)` `"YYYY-MM"` |
| 삭제 | Category는 하드 삭제 없음(`archivedAt`). 나머지는 하드 삭제 |
| 선택 텍스트 | nullable. 빈 문자열은 검증 단계에서 `null`로 변환 |

## Prisma 사용 규칙

- 클라이언트: `import { db } from "@/lib/db"` (adapter-pg, 개발 중 globalThis 싱글턴).
- 생성 위치 `src/generated/prisma` — `npm run build`/`typecheck`가 `prisma generate`를 실행한다.
- 날짜 범위 조회: `monthRange(month)` → `{ gte: toDbDate(start), lt: toDbDate(endExclusive) }`.
- 동시성이 필요한 쓰기: `db.$transaction` + 조건부 `updateMany`(낙관적) 또는 `FOR UPDATE` 잠금 (`server/recurring.ts` 참고).

## 마이그레이션

| 상황 | 명령 |
| --- | --- |
| 스키마 변경 (로컬) | `npm run db:migrate` (`prisma migrate dev`, `DIRECT_DATABASE_URL` 사용) |
| 운영 적용 | `npm run db:deploy` — 코드 배포보다 먼저. 빌드에서 실행하지 않는다 |
| 시드 | `npm run db:seed` (upsert, 재실행 안전) |

- `prisma/migrations/*` 기존 파일은 수정하지 않는다.
- 통합 테스트 global setup이 테스트 DB에 `migrate deploy`를 자동 실행한다.
- 운영 절차 상세: `README.md` "배포".

## 환경 변수

| 이름 | 용도 | 파일 |
| --- | --- | --- |
| `DATABASE_URL` | 런타임 (운영: pooled) | `.env` |
| `DIRECT_DATABASE_URL` | Prisma CLI·마이그레이션 (운영: direct) | `.env` |
| `TEST_DATABASE_URL` | 통합 테스트 | `.env` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` | 로그인 | `.env.local` (`$`는 `\$`로 이스케이프) |
