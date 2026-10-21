# Coding Style

코드에서 관찰한 규칙이다. 포매터(Prettier) 설정은 없고 ESLint(`eslint-config-next` core-web-vitals + typescript)만 있다.

## 형식

- 2칸 들여쓰기, 큰따옴표, 세미콜론, 여러 줄 trailing comma. 한 줄은 대략 100자 이내.
- 파일명 kebab-case (`transaction-form.tsx`). 컴포넌트·타입 PascalCase, 함수·변수 camelCase, 상수 UPPER_SNAKE_CASE.
- import는 `@/*` alias(`./src/*`)를 쓴다. 같은 폴더 안은 상대 경로 허용 (`./nav-items`).
- 타입만 쓰는 import는 `import type`.

## 컴포넌트

- 일반 컴포넌트는 named export (`export function X`). `default export`는 Next 특수 파일(page, layout, loading, error, not-found)만.
- `"use client"`는 상호작용이 필요한 파일에만 붙인다. 페이지·레이아웃은 Server Component.
- 클라이언트 컴포넌트는 서버 모듈에서 **타입만** import한다 (`import type { TransactionDto } from "@/server/transactions"`). 함수는 `@/server/actions/*`만 호출한다.
- className 결합은 `cn()` (`@/lib/utils`).

## 서버 경계

- `src/server/*`, `src/lib/db.ts`, `src/lib/auth/*`(rate-limit 제외)는 첫 줄 `import "server-only"`.
- action 파일은 첫 줄 `"use server"`이며 async 함수만 export한다. 공용 타입은 `src/lib`에 둔다.
- Prisma 생성 클라이언트(`@/generated/prisma/client`)는 서버 코드에서만 import한다. `src/lib/validation/*`은 enum 값을 `as const` 배열로 따로 둔다 (`TRANSACTION_TYPES`, `PAYMENT_METHODS`).
- 서비스는 Prisma 행을 그대로 반환하지 않고 DTO로 변환한다: 날짜 → `"YYYY-MM-DD"`, `archivedAt` → `archived: boolean`, 카테고리 이름 포함.

## 오류

- 사용자에게 보여줄 예상 실패: `throw new ServiceError("한국어 메시지")`. 반복 메시지는 `service-error.ts` 상수.
- Prisma 오류는 `prismaCode(e)`로 판별 (`P2002` 중복, `P2025` 대상 없음) 후 `ServiceError`로 변환, 나머지는 다시 throw.
- 불가능한 상황에 대한 방어 코드를 추가하지 않는다.

## 언어

- 주석, UI 문구, 오류·검증 메시지: 한국어.
- 주석은 "왜"를 설명하거나 함수 계약(JSDoc `/** */`)을 적는다. 코드 반복 설명은 쓰지 않는다.

## 커밋 메시지 (git log 기준)

```
<type>: <한국어 요약>
```

`type`: `feat` `fix` `docs` `test` `chore`. 예: `feat: 캘린더에 아직 등록 전인 고정지출을 회색 예정으로 표시`

## Do / Don't

| Do | Don't |
| --- | --- |
| 날짜는 `lib/date.ts` 함수 사용 | `new Date().getDate()` 등 로컬 TZ 메서드, date-fns/dayjs 추가 |
| 금액 표시는 `formatKRW` / `formatCompactKRW` | `toLocaleString` 직접 호출 |
| 유형·결제 수단 표시는 `TYPE_LABELS`, `PAYMENT_METHOD_LABELS` | 컴포넌트에 라벨 하드코딩 |
| 입력 검증은 `lib/validation/*` 스키마를 클라이언트·서버 공용으로 | action과 폼에 다른 규칙 작성 |
| 의존성 추가 시 정확한 버전 (`save-exact`) | `^`/`~` 범위 버전 |
| 새 action은 기존 action 템플릿([api.md](api.md)) 그대로 | `requireSession()`을 `runService` 안에서 호출 |
| 집계는 Prisma `groupBy`/`aggregate` | 집계용 `$queryRaw` (BigInt 반환) |
