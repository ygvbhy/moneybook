# Testing

Vitest (`vitest.config.mts`), 두 프로젝트.

| 프로젝트 | 경로 | 대상 | 특징 |
| --- | --- | --- | --- |
| `unit` | `tests/unit/**/*.test.ts` | `src/lib/*` 순수 함수, 스키마 | DB 없음 |
| `integration` | `tests/integration/**/*.test.ts` | action·서비스 + 실제 Postgres | 파일 순차 실행, `DATABASE_URL`을 `TEST_DATABASE_URL`로 교체 |

## 명령

```bash
npm test               # unit + integration
npm run test:unit
npm run test:tz        # integration을 TZ=UTC, TZ=Asia/Seoul에서 각각 실행
```

전제: `docker compose up -d --wait` (ledger_test DB는 `docker/init.sql`이 생성).

## 안전장치 (변경 금지)

- `tests/setup/mocks.ts`: `DATABASE_URL !== TEST_DATABASE_URL`이면 즉시 중단.
- `resetDb()`가 모든 테이블을 TRUNCATE한다 → 개발 DB를 가리키면 데이터가 지워진다.
- `tests/setup/global-setup.ts`: 테스트 DB에 `prisma migrate deploy`.

## 목·스텁

| 대상 | 대체 |
| --- | --- |
| `next/headers` | `testCookies`, `testHeaders` (메모리 맵) |
| `next/cache` | `revalidatePath` no-op |
| `next/navigation` | `redirect(path)` → `throw new Error("REDIRECT:" + path)` |
| `server-only` | `tests/stubs/server-only.ts` (alias) |

## 헬퍼 (`tests/setup/db.ts`)

- `resetDb()` — TRUNCATE + 기본 카테고리 12개 재시드 + 쿠키/헤더 초기화. `beforeEach`에서 호출.
- `loginAsTest()` — 세션 행 생성 + 쿠키 주입.
- `categoryId(name, type?)` — 시드 카테고리 id.
- `txInput({ categoryId, ...over })` — 기본 `EXPENSE`, `10_000`, `2026-10-21`.

## 규칙

- 새 action은 `auth-guard.test.ts`가 디렉터리를 탐색해 자동 검사한다 (세션 없이 호출 → `REDIRECT:/login`, DB 불변). 예외 추가 시 `EXCLUDED`에 명시.
- 오늘 날짜에 의존하는 서비스는 `today`를 인자로 받으므로 테스트에서 고정 날짜를 주입한다.
- 날짜·월 경계 로직은 `it.each` 표 형태로 경계값(2월, 윤년, 30일 달, 연도 넘김)을 검증한다.
- 테스트 이름·설명은 한국어.

## 버그 수정 순서

1. 재현 테스트 작성 (순수 로직 → unit, DB·action → integration)
2. 실패 확인 → 수정 → 통과
3. `npm run typecheck && npm run lint && npm test`
