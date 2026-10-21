# 가계부 웹

1인용 개인 가계부(Personal Ledger). 수입·지출 기록, 월간 캘린더, 월별 통계, 카테고리 예산을 관리한다.

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui
- Prisma 7 + PostgreSQL 17 · Zod · React Hook Form · Recharts · Vitest

## 로컬 실행

필요: Node 24, Docker

```bash
npm install
cp .env.example .env              # DB 연결 정보
docker compose up -d --wait       # Postgres (ledger, ledger_test DB)
npm run db:migrate                # 마이그레이션 적용
npm run db:seed                   # 기본 카테고리 12개
```

관리자 계정은 `.env.local`에 둔다 (docker compose가 `.env`의 `$`를 변수로 해석하므로 분리).

```bash
npm run hash-password             # 비밀번호 입력 → bcrypt 해시 출력
```

```dotenv
# .env.local
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH="\$2b\$12\$..."   # Next가 .env 파일의 $VAR를 확장하므로 $마다 \ 를 붙인다
```

```bash
npm run dev                       # http://localhost:3000
```

## 검증

```bash
npm run typecheck
npm run lint
npm test                          # 단위 + 통합 (통합은 ledger_test DB 사용)
npm run test:tz                   # 통합 테스트를 TZ=UTC, TZ=Asia/Seoul에서 각각 실행
npm run build
```

통합 테스트는 `TEST_DATABASE_URL`의 DB만 사용하며, 다른 DB를 가리키면 시작 전에 중단된다.

## 배포 (Vercel)

1. 관리형 Postgres(예: Neon)를 만든다.
2. Vercel 프로젝트 환경변수를 설정한다.
   - `DATABASE_URL`: pooled 연결 문자열 (런타임)
   - `DIRECT_DATABASE_URL`: direct 연결 문자열 (마이그레이션)
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`: Vercel 환경변수에는 `\` 이스케이프 없이 해시를 그대로 넣는다
3. 마이그레이션은 빌드에서 실행하지 않는다 (Preview 배포가 운영 DB를 바꾸지 않도록). 배포 전에 로컬에서 운영 direct URL로 실행한다.
   ```bash
   DIRECT_DATABASE_URL="<운영 direct URL>" npm run db:deploy
   DATABASE_URL="<운영 URL>" npm run db:seed   # 최초 1회
   ```
4. 빌드 명령은 기본값(`npm run build` = `prisma generate && next build`)을 사용한다.

## 운영 메모

- 로그인 실패가 15분 안에 IP당 5회 또는 전체 30회를 넘으면 잠긴다. 15분을 기다리거나 DB에서 해제한다.
  ```sql
  DELETE FROM "LoginAttempt";
  ```
- 세션은 30일 유지되며 로그아웃 시 서버에서 즉시 폐기된다.
- 거래 날짜는 Asia/Seoul 기준 달력 날짜(`DATE`)로 저장한다.
