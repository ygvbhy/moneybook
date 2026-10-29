# Folder Structure

```
prisma/
  schema.prisma          모델 정의 (생성 위치: src/generated/prisma)
  migrations/            prisma migrate 결과. 직접 수정 금지
  seed.ts                기본 카테고리 12개 upsert
prisma.config.ts         Prisma CLI 설정 (DIRECT_DATABASE_URL, seed 명령)
scripts/hash-password.ts 관리자 비밀번호 bcrypt 해시 생성
docker/init.sql          ledger_test DB 생성
src/
  proxy.ts               CSP nonce + 쿠키 존재 확인 → /login 리다이렉트 (Next 16의 middleware 대체)
  app/
    layout.tsx           루트: 폰트, ThemeProvider, Toaster
    error.tsx, not-found.tsx
    login/               로그인 페이지 + login-form.tsx (인증 불필요)
    (app)/               인증 필요 영역. layout.tsx가 앱 셸과 거래 다이얼로그 Provider를 제공
      page.tsx           / 대시보드
      calendar/          /calendar
      transactions/      /transactions
      reports/           /reports 연간 요약
      recurring/         /recurring 고정지출
      budgets/           /budgets 예산 + 카테고리 관리
  components/
    ui/                  shadcn 생성 컴포넌트
    app-shell/           사이드바, 하단 탭, 모바일 헤더, FAB, PageHeader/PageEmpty, PageSkeleton, 테마 토글, 백업 다이얼로그, NAV_ITEMS
    transaction/ calendar/ dashboard/ budget/ recurring/ report/   기능별 컴포넌트
    amount-input.tsx     금액 입력 (공용)
    month-switcher.tsx   월 이동 링크 (공용)
  lib/                   순수 함수·스키마·상수 (클라이언트에서도 import 가능, 예외 아래)
    db.ts                Prisma 싱글턴 (server-only)
    auth/                세션·비밀번호·IP·rate limit (rate-limit.ts 외 server-only)
    validation/          Zod 스키마 (도메인별 파일)
    date.ts money.ts budget.ts recurring.ts aggregate.ts labels.ts type-toggle.ts action-result.ts utils.ts csp.ts
  server/                서버 전용 (모든 파일 `import "server-only"`)
    <domain>.ts          서비스: Prisma 쿼리, DTO 타입·변환
    actions/<domain>.ts  Server Action ("use server")
    action-utils.ts      runService, validationFailure
    service-error.ts     ServiceError, prismaCode, logSafeError(로그용 오류 축약), 공용 오류 메시지
  generated/prisma/      Prisma 생성 클라이언트 (git 미추적)
tests/
  unit/                  lib/* 순수 함수, proxy, service-error
  integration/           실제 테스트 DB로 action·서비스 검증
  setup/                 global-setup(마이그레이션), mocks(next/*), db 헬퍼
  stubs/server-only.ts   Vitest용 server-only 대체
```

## 새 코드를 둘 위치

| 추가하려는 것 | 위치 |
| --- | --- |
| 새 화면 (인증 필요) | `src/app/(app)/<route>/page.tsx` + `loading.tsx`, `NAV_ITEMS`(`components/app-shell/nav-items.ts`)에 메뉴 추가 |
| DB 조회·변경 로직 | `src/server/<domain>.ts` |
| 클라이언트에서 호출할 변경 | `src/server/actions/<domain>.ts` (export는 async 함수만) |
| 순수 계산 | `src/lib/<topic>.ts` + `tests/unit/<topic>.test.ts` |
| 입력 스키마 | `src/lib/validation/<domain>.ts` |
| action/클라이언트 공용 타입 | `src/lib/*` (`"use server"` 파일은 타입 export 불가 → `lib/action-result.ts` 패턴) |
| 화면 라벨 매핑 | `src/lib/labels.ts` |
| 기능 UI | `src/components/<domain>/` |
| 여러 기능에서 쓰는 UI | `src/components/` 루트 또는 `app-shell/` |
| shadcn 기본 컴포넌트 | `src/components/ui/` (shadcn CLI, `components.json`) |
| 스키마 변경 | `prisma/schema.prisma` → `npm run db:migrate` |

`src/hooks`는 `components.json`에 alias만 있고 디렉터리는 없다.
