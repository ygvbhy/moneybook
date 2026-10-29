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

1. `src/proxy.ts`: 요청마다 CSP nonce를 만들어 요청 헤더(`x-nonce`, `Content-Security-Policy`)와 응답 헤더에 넣는다. `ledger_session` 쿠키가 없으면 `/login`으로 리다이렉트 (존재 여부만 확인, DB 접근 없음). `next-action` 헤더 요청과 `/login`으로 시작하는 경로는 쿠키 검사를 생략한다.
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
| `src/proxy.ts` | 쿠키 존재 (낙관적 차단), CSP nonce |
| `requireSession()` (`src/lib/auth/dal.ts`) | DB 세션 유효성. 모든 페이지·action에서 호출 |

규칙은 [knowledge/auth.md](../knowledge/auth.md).

## 캐시·렌더링

- 페이지는 쿠키를 읽으므로 동적 렌더링이다. `next.config.ts`에 Cache Components 설정 없음.
- 모든 변경 action은 `revalidatePath("/", "layout")`로 앱 전체를 무효화한다 (정밀 무효화 안 함).
- Server Action body 한도는 `next.config.ts`의 `experimental.serverActions.bodySizeLimit: "4mb"`(기본 1MB). 백업 복원이 파일 전체를 보내기 때문이며, 클라이언트 상한은 `MAX_BACKUP_BYTES`(3.5MB) → [knowledge/backup.md](../knowledge/backup.md).
- 집계는 저장하지 않고 조회 시 Prisma `groupBy`/`aggregate`로 계산한다. 집계용 raw SQL은 쓰지 않는다 (유일한 raw SQL은 `updateRecurring`의 `SELECT ... FOR UPDATE` 잠금).
- 고정지출 자동 등록은 **페이지 렌더 중 DB 쓰기**다 (`materializeRecurring`). 렌더 중이므로 이 함수 안에서 `revalidatePath`·`cookies` 쓰기를 하지 않는다. 항목별 실패는 잡아서 로그만 남기므로 페이지를 막지 않는다 → [knowledge/recurring.md](../knowledge/recurring.md).

## 오류·로딩

- `src/app/(app)/error.tsx`: "다시 시도" = `router.refresh()` + `reset()`.
- `src/app/error.tsx`: 레이아웃 오류용으로 위 파일을 re-export.
- `loading.tsx`: 라우트별 `PageSkeleton`.
- 예상된 실패는 `ServiceError`(메시지를 사용자에게 그대로 노출), 그 외는 서버 로그 + 일반 메시지.

## 보안 헤더

| 위치 | 헤더 |
| --- | --- |
| `next.config.ts` (정적) | `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `X-Robots-Tag: noindex`, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `poweredByHeader: false` |
| `src/proxy.ts` (요청마다) | `Content-Security-Policy` — 정책은 `src/lib/csp.ts` `buildCsp` |
| Vercel (플랫폼 기본) | `Strict-Transport-Security` — 앱에서 설정하지 않는다 |

CSP 규칙:
- `script-src 'self' 'nonce-…' 'strict-dynamic'` (dev만 `'unsafe-eval'`). Next가 요청 CSP 헤더에서 nonce를 읽어 프레임워크 스크립트에 붙이고, 루트 레이아웃이 `headers()`의 `x-nonce`를 `ThemeProvider nonce`로 넘긴다. 그래서 루트 레이아웃이 동적이고 모든 페이지(`/_not-found` 포함)가 동적 렌더링이다.
- `style-src 'self' 'unsafe-inline'`에는 nonce를 넣지 않는다. nonce가 있으면 `'unsafe-inline'`이 무시되어 Radix·Recharts의 `style` 속성이 막힌다.
- `upgrade-insecure-requests`는 넣지 않는다 (리소스가 모두 same-origin이고, 로컬 http `next start`를 깨뜨림).
- 새 인라인 `<script>`나 외부 스크립트·폰트·이미지 도메인을 추가하면 `buildCsp`도 고친다. Vercel Toolbar는 `'strict-dynamic'`과 호환되지 않아 끈다(README).
