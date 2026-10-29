<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Moneybook: 1인용 개인 가계부 웹앱 (Next.js 16 App Router + Prisma 7 + PostgreSQL).
이 파일은 **목차**다. 상세 규칙은 아래 문서에 있고, 여기서는 위치와 읽을 시점만 안내한다.

## 읽는 순서

1. 이 파일
2. 작업과 관련된 `docs/` 문서 (프로젝트 구조·규칙)
3. 작업과 관련된 `knowledge/` 문서 (도메인·비즈니스 규칙)
4. 실행·검증·배포 명령은 `README.md`

필요한 문서만 읽는다. 전부 읽지 않는다.

## docs/ — 프로젝트 자체

| 문서 | 내용 | 읽을 때 |
| --- | --- | --- |
| [docs/architecture.md](docs/architecture.md) | 기술 스택, 계층, 읽기/쓰기 흐름, 인증 위치, 캐시 무효화 | 처음 작업할 때, 새 기능 설계 |
| [docs/folder-structure.md](docs/folder-structure.md) | 디렉터리 지도, 새 코드를 둘 위치 | 파일을 새로 만들 때 |
| [docs/coding-style.md](docs/coding-style.md) | 명명, import, 서버/클라이언트 경계, 커밋 메시지, Do/Don't | 코드를 쓸 때 항상 |
| [docs/api.md](docs/api.md) | Server Action 계약(`ActionResult`), action 목록, URL search params | action·폼·페이지 파라미터 변경 |
| [docs/frontend.md](docs/frontend.md) | 공통 컴포넌트, 상태 관리, 반응형, 색 토큰, 접근성, 피드백 | UI 변경 |
| [docs/data-model.md](docs/data-model.md) | Prisma 모델, 컬럼 규약, 마이그레이션 규칙 | 스키마·쿼리 변경 |
| [docs/testing.md](docs/testing.md) | Vitest 구성, 테스트 DB 안전장치, 목, 헬퍼, 검증 명령 | 테스트 작성·실행 |

## knowledge/ — 서비스·비즈니스 규칙

| 문서 | 내용 |
| --- | --- |
| [knowledge/product-scope.md](knowledge/product-scope.md) | 제품 범위, 만들지 않는 기능 |
| [knowledge/glossary.md](knowledge/glossary.md) | 도메인 용어 ↔ 코드 식별자 ↔ 화면 문구 |
| [knowledge/date-and-amount.md](knowledge/date-and-amount.md) | Asia/Seoul 날짜 규칙, 월 범위, KRW 금액 규칙 |
| [knowledge/auth.md](knowledge/auth.md) | 단일 관리자 로그인, 세션, 로그인 시도 제한 |
| [knowledge/transaction.md](knowledge/transaction.md) | 거래 필드, 검증, 카테고리 일치, 검색·필터·정렬 |
| [knowledge/category.md](knowledge/category.md) | 기본 카테고리, 보관/복원, 유형 불변 |
| [knowledge/budget.md](knowledge/budget.md) | 전체·카테고리 예산, 사용률, 초과·미배정 계산 |
| [knowledge/recurring.md](knowledge/recurring.md) | 고정지출 발생일 계산, 자동 등록, 예정 표시 |
| [knowledge/reporting.md](knowledge/reporting.md) | 대시보드·캘린더·거래 내역의 집계 규칙 |
| [knowledge/backup.md](knowledge/backup.md) | 전체 백업 JSON 내보내기·복원(전체 교체), 검증, 크기 한도 |

## 절대 규칙 (상세는 링크 문서)

- 모든 페이지와 Server Action은 `requireSession()`을 먼저 호출한다. 예외는 `login` action 하나. → [docs/api.md](docs/api.md)
- 날짜는 `"YYYY-MM-DD"` 문자열 + `src/lib/date.ts` 함수로만 다룬다. 로컬 TZ 메서드·날짜 라이브러리 금지. → [knowledge/date-and-amount.md](knowledge/date-and-amount.md)
- 금액은 KRW 정수(1 ~ 1,000,000,000). → [knowledge/date-and-amount.md](knowledge/date-and-amount.md)
- 카테고리는 하드 삭제하지 않고 보관한다. 예외는 백업 복원의 전체 교체 하나. → [knowledge/category.md](knowledge/category.md), [knowledge/backup.md](knowledge/backup.md)
- 통합 테스트는 `TEST_DATABASE_URL` DB만 쓴다 (TRUNCATE 함). → [docs/testing.md](docs/testing.md)
- 운영 마이그레이션은 빌드에서 돌리지 않고 코드 배포보다 먼저 실행한다. → `README.md` "배포"
- 의존성 버전은 정확히 고정한다 (`.npmrc`의 `save-exact=true`).
- 답변·문서·주석·UI 문구는 한국어. 코드 식별자는 영어.

## 완료 전 검증

```bash
npm run typecheck && npm run lint && npm test
npm run test:tz   # 날짜·집계를 건드렸을 때
npm run build     # 라우트·설정을 건드렸을 때
```

## 기타 위치

- `.claude/plans/*.md`: 과거 구현 계획과 결정 기록 (git 미추적, 로컬에만 존재). 결정 배경이 필요할 때만 참고한다. 현재 동작의 기준은 코드와 이 문서들이다.
- `src/generated/prisma/`: Prisma 생성 클라이언트 (git 미추적, `prisma generate`로 생성). 직접 수정 금지.
