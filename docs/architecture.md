# Architecture

## 기술 스택 (package.json 고정 버전)

| 영역 | 사용 |
| --- | --- |
| 프레임워크 | Next.js 16.4.2 (App Router, Turbopack), React 19.3.1, TypeScript 6.0.3 (strict) |
| DB | PostgreSQL 17 (로컬: Docker Compose), Prisma 7.10.1 + `@prisma/adapter-pg` |
| 검증 | Zod 4.6.7 (클라이언트·서버 공용 스키마) |
| 폼 | react-hook-form 7.90.0 + `@hookform/resolvers` 5.9.2 |
| UI | Tailwind CSS 4.3.3, shadcn (style `radix-nova`, `radix-ui`), lucide-react, sonner(토스트), next-themes, recharts |
| 인증 | 자체 구현: bcryptjs + DB 세션 |
| 테스트 | Vitest 5.0.5 (unit / integration 프로젝트) |
| 런타임 | Node 24, 배포 Vercel + 관리형 Postgres |

Next 16 차이점(예: `middleware.ts` → `src/proxy.ts`, `next lint` 없음, `PageProps`/`LayoutProps` 전역 타입)은 `node_modules/next/dist/docs/`에서 확인한다.

## 계층

```
app/ (Server Component 페이지·레이아웃)  ──읽기──▶ server/*.ts (서비스: Prisma 쿼리·집계)
components/ (Client Component)           ──쓰기──▶ server/actions/*.ts ──▶ server/*.ts
                                                                         └─▶ lib/db.ts (Prisma)
모든 계층 ──▶ lib/*.ts (순수 함수: 날짜·금액·예산·고정지출 계산, Zod 스키마, 라벨)
```

| 계층 | 책임 | 하지 않는 것 |
| --- | --- | --- |
| `src/app/**/page.tsx` | 인증, `materializeRecurring`, search params 정규화, 서비스 병렬 호출, 렌더 | DB 직접 접근 |
| `src/server/actions/*` | 인증 → Zod 검증 → 서비스 호출 → `revalidatePath` → `ActionResult` 반환 | 쿼리 작성 |
| `src/server/*` | Prisma 쿼리, DTO 변환, 도메인 검증(`ServiceError`) | 인증, 캐시 무효화 |
| `src/lib/*` | 순수 계산, 스키마, 상수 | DB·Next API 사용 (예외: `lib/db.ts`, `lib/auth/*`) |

- REST API·Route Handler는 없다. 외부 진입점은 페이지 GET과 Server Action POST뿐이다.
- 클라이언트 fetch / React Query / 전역 스토어는 쓰지 않는다.

## 읽기 흐름 (페이지 렌더)

1. `src/proxy.ts`: `ledger_session` 쿠키가 없으면 `/login`으로 리다이렉트 (존재 여부만 확인, DB 접근 없음). `next-action` 헤더 요청은 통과시킨다.
2. `src/app/(app)/layout.tsx`: `requireSession()` → 카테고리 목록·최근 카테고리 조회 → `TransactionDialogProvider`에 전달.
3. `page.tsx`: `requireSession()` → `todayInSeoul()` → `await materializeRecurring(today)` → `searchParams` 정규화 → `Promise.all`로 서비스 호출 → 컴포넌트에 DTO 전달.

## 쓰기 흐름 (Server Action)

1. 클라이언트 폼: RHF + `zodResolver(같은 스키마)` → `startTransition`에서 action 호출.
2. action: `requireSession()` → `schema.safeParse` → `runService(() => svc.x())` → `revalidatePath("/", "layout")`.
3. 클라이언트: `result.ok`에 따라 토스트, 필드 오류 `setError`, `router.refresh()`.

계약 상세는 [api.md](api.md).

## 인증 위치 (2중)

| 위치 | 확인 내용 |
| --- | --- |
| `src/proxy.ts` | 쿠키 존재 (낙관적 차단) |
| `requireSession()` (`src/lib/auth/dal.ts`) | DB 세션 유효성. 모든 페이지·action에서 호출 |

규칙은 [knowledge/auth.md](../knowledge/auth.md).

## 캐시·렌더링

- 페이지는 쿠키를 읽으므로 동적 렌더링이다. `next.config.ts`에 Cache Components 설정 없음.
- 모든 변경 action은 `revalidatePath("/", "layout")`로 앱 전체를 무효화한다 (정밀 무효화 안 함).
- 집계는 저장하지 않고 조회 시 Prisma `groupBy`/`aggregate`로 계산한다. 집계용 raw SQL은 쓰지 않는다 (유일한 raw SQL은 `updateRecurring`의 `SELECT ... FOR UPDATE` 잠금).
- 고정지출 자동 등록은 **페이지 렌더 중 DB 쓰기**다 (`materializeRecurring`). 렌더 중이므로 이 함수 안에서 `revalidatePath`·`cookies` 쓰기를 하지 않는다.

## 오류·로딩

- `src/app/(app)/error.tsx`: "다시 시도" = `router.refresh()` + `reset()`.
- `src/app/error.tsx`: 레이아웃 오류용으로 위 파일을 re-export.
- `loading.tsx`: 라우트별 `PageSkeleton`.
- 예상된 실패는 `ServiceError`(메시지를 사용자에게 그대로 노출), 그 외는 서버 로그 + 일반 메시지.

## 보안 헤더 (`next.config.ts`)

`X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `X-Robots-Tag: noindex`.
