# 가계부 웹

1인용 개인 가계부(Moneybook). 수입·지출 기록, 월간 캘린더, 월별 통계, 카테고리 예산, 매월 자동 등록되는 고정지출을 관리한다. 거래는 CSV로 내보내고 가져올 수 있다.

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
3. 마이그레이션은 빌드에서 실행하지 않는다 (Preview 배포가 운영 DB를 바꾸지 않도록). **코드 배포보다 먼저** 로컬에서 운영 direct URL로 실행한다. 모든 앱 페이지가 렌더 시 고정지출 테이블을 조회하므로, 마이그레이션 없이 배포하면 전 페이지가 오류가 난다.
   ```bash
   DIRECT_DATABASE_URL="<운영 direct URL>" npm run db:deploy
   DATABASE_URL="<운영 URL>" npm run db:seed   # 최초 1회
   ```
4. 빌드 명령은 기본값(`npm run build` = `prisma generate && next build`)을 사용한다.

### 보안 설정 (Vercel 대시보드)

코드로 할 수 없는 설정이다. 환경변수를 바꾸면 **재배포해야** 적용된다.

- **환경 분리**: 운영 `DATABASE_URL`·`DIRECT_DATABASE_URL`·`ADMIN_USERNAME`·`ADMIN_PASSWORD_HASH`는 Production 환경에만 둔다. Preview는 다음 중 하나로 한다.
  - 별도 DB(예: Neon 브랜치)와 별도 관리자 값을 Preview 환경변수로 둔다. 마이그레이션은 그 브랜치 direct URL로 `DIRECT_DATABASE_URL="<Preview direct URL>" npm run db:deploy`.
  - Preview를 쓰지 않는다. Preview에 관리자 값이 없으면 로그인이 오류가 난다.
- **Deployment Protection**: Settings → Deployment Protection에서 Vercel Authentication을 켠다. Preview URL은 추측 가능한 공개 주소다.
- **Vercel Toolbar 끄기**: 앱 CSP(`'strict-dynamic'`)와 호환되지 않아 Preview에서 막힌다. Settings → General → Vercel Toolbar에서 끈다.
- **로그인 rate limit (선택)**: Firewall에서 `/login` 경로 POST 요청에 rate limit 규칙을 추가하면 앱의 시도 제한 앞단에서 걸러진다.
- **DB**: 연결 문자열에 `sslmode=require`를 쓴다. 앱 런타임(`DATABASE_URL`)은 데이터 읽기·쓰기 권한만 있는 롤, 마이그레이션(`DIRECT_DATABASE_URL`)은 소유자 롤로 분리하면 좋다. 백업·PITR(Neon 기본 기능)을 켜 둔다.
- **IP 식별 전제**: 로그인 시도 제한은 `x-real-ip`/`x-forwarded-for`로 IP를 구분한다. Vercel이 이 헤더를 덮어써 위조할 수 없다는 전제이므로, 다른 플랫폼이나 앞단 프록시를 쓰게 되면 다시 검토한다.
- **HSTS**: Vercel이 기본으로 붙이므로 앱에서 설정하지 않는다.

### 배포 후 확인

```bash
curl -sI https://<도메인>/login
```

- `content-security-policy`(`'nonce-…'` 포함), `permissions-policy`, `cross-origin-opener-policy`, `strict-transport-security`가 있고 `x-powered-by`가 없다.
- 브라우저 개발자 도구 콘솔에 CSP 위반(`Refused to …`)이 없고, 로그인·거래 추가·다크모드 전환·차트가 동작한다.

## 운영 메모

- 로그인 실패가 15분 안에 IP당 5회를 넘으면 그 IP가, 전체 30회를 넘으면 모든 IP가 잠긴다. 단 최근 30일 안에 로그인에 성공한 IP(신뢰 IP)는 전체 한도를 적용받지 않는다(IP당 한도는 적용). 신뢰 IP는 IP가 정확히 같아야 하므로 모바일처럼 IP가 자주 바뀌는 환경에서는 적용되지 않을 수 있다. 15분을 기다리거나 DB에서 해제한다. 성공 기록은 신뢰 IP의 근거이므로 실패 기록만 지운다.
  ```sql
  DELETE FROM "LoginAttempt" WHERE success = false;
  ```
- 세션은 7일 동안 접속하지 않으면 만료되고, 계속 접속해도 로그인 후 최대 30일이면 만료된다. 로그아웃 시 서버에서 즉시 폐기된다. 모든 세션을 강제로 끊으려면:
  ```sql
  DELETE FROM "Session";
  ```
- 관리자 비밀번호는 12자 이상, 72바이트 이하(bcrypt 한계, 한글은 1자 3바이트)여야 한다(`npm run hash-password`가 검사). 지금 쓰는 비밀번호가 12자 미만이면 새로 만들어 교체한다.
- 유출이 의심될 때 (세션 삭제는 항상 마지막에 한다. 먼저 지우면 유출된 값으로 다시 로그인할 수 있다)
  - 관리자 비밀번호·해시 유출: `npm run hash-password`로 새 해시 생성 → Vercel `ADMIN_PASSWORD_HASH` 교체 → 재배포 → `DELETE FROM "Session";`
  - DB 자격증명 유출(세션 행을 직접 만들 수 있다): DB 비밀번호 교체 → Vercel `DATABASE_URL`·`DIRECT_DATABASE_URL` 교체 → 재배포 → `DELETE FROM "Session";` → 관리자 비밀번호도 교체 권장
- 거래 날짜는 Asia/Seoul 기준 달력 날짜(`DATE`)로 저장한다.
- 고정지출은 앱 페이지를 렌더할 때 오늘(서울)까지 도래한 발생분을 실제 거래로 만든다(`materializeRecurring`). 다음 발생일 커서(`nextRunOn`)로 중복을 막으므로 자동 생성된 거래를 지워도 다시 생기지 않는다. 그 달에 없는 날짜는 말일에 등록한다. 캘린더에는 아직 등록 전인 발생일을 회색 "예정"으로, 대시보드에는 선택 월의 "남은 고정지출" 목록과 합계로 보여 주며, 예정 금액은 합계·대시보드 요약·예산에 포함하지 않는다.
