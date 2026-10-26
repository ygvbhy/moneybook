# Auth

## 계정

- 관리자 1명. `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`(bcrypt cost 12, `npm run hash-password`로 생성).
- 비밀번호 규칙(`adminPasswordError`, `src/lib/validation/auth.ts`): 12자 이상, 72바이트 이하(bcrypt는 72바이트 이후를 무시). `hash-password`에서만 검사하고 로그인 스키마(최대 200자)는 그대로다 — 기존 비밀번호를 잠그지 않기 위해.
- 아이디가 틀려도 bcrypt 비교를 항상 실행한다 (응답 시간으로 아이디 유추 방지). 아이디 비교는 SHA-256 + `timingSafeEqual`.
- 실패 메시지는 구분하지 않는다: `"아이디 또는 비밀번호가 올바르지 않습니다"`.

## 세션 (`src/lib/auth/session.ts`)

| 항목 | 값 |
| --- | --- |
| 쿠키 | `ledger_session`, HttpOnly, SameSite=Lax, Secure(production), Path=/, 수명 30일 |
| 토큰 | 32바이트 랜덤(base64url). DB에는 SHA-256 해시(`tokenHash`)만 저장 |
| 만료 | 미사용 7일(`SESSION_IDLE_DAYS`), 최대 30일(`SESSION_DAYS`, 생성 시각 기준). DB `expiresAt` = min(createdAt + 30일, 지금 + 7일) |
| 갱신 | `getSession`이 목표 만료와 1시간 넘게 차이 나면 `updateMany`로 갱신. 갱신 건수 0이면 null, 예외면 오류 이름만 로그하고 기존 세션 반환(렌더를 막지 않음). 쿠키는 렌더 중 갱신할 수 없어 30일 그대로 |
| 로그아웃 | DB 행 삭제 + 쿠키 삭제 (즉시 폐기) |
| 만료 세션 | 조회 시 삭제, 로그인 시도마다 일괄 정리 |

`getSession`은 React `cache`로 요청당 1회 조회한다.

## 로그인 시도 제한 (`src/lib/auth/rate-limit.ts`, `server/actions/auth.ts`)

| 규칙 | 값 |
| --- | --- |
| 창 | 최근 15분 |
| IP당 실패 한도 | 5회 초과 시 차단 |
| 전체 실패 한도 | 30회 초과 시 차단. 단 신뢰 IP는 제외 |
| 신뢰 IP | 최근 30일(`TRUSTED_IP_DAYS`) 안에 같은 IP 해시로 성공한 기록이 있는 IP. 전체 잠금 DoS 완화용이며 IP당 한도는 그대로 적용. 해시 정확 일치라 IP가 바뀌면 적용되지 않음 |
| IP 식별 | `x-real-ip` → `x-forwarded-for` 첫 값 → `"unknown"`, SHA-256 해시로 저장. Vercel이 두 헤더를 덮어써 위조할 수 없다는 전제 — 다른 플랫폼·앞단 프록시를 쓰면 재검토 |

처리 순서:
1. 시도 행을 먼저 INSERT (병렬 요청으로 한도 우회 방지)
2. 오래된 시도(실패 24시간 초과, 성공 30일 초과 — 성공 기록은 신뢰 IP 근거라 길게 보관)·만료 세션 정리
3. 방금 넣은 행 포함 실패 수와 신뢰 IP 여부 COUNT → 차단이면 **방금 넣은 행을 삭제**(재시도로 잠금 연장 방지)하고 남은 분을 안내: `"로그인 시도가 너무 많습니다. N분 후 다시 시도하세요"`
4. bcrypt 비교 → 성공 시 행을 `success: true`로 바꾸고 세션 생성 후 `/`로 리다이렉트

잠금 해제: 15분 대기 또는 `DELETE FROM "LoginAttempt" WHERE success = false;` (성공 기록은 남김, README 운영 메모).

## 인증 검사 위치

- `proxy.ts`: 쿠키 존재만 확인. Server Action 요청(`next-action` 헤더)과 `/login`으로 시작하는 경로는 쿠키 검사를 생략 — action에 307을 돌려주면 클라이언트가 HTML을 받아 오류가 나기 때문. 매칭되는 모든 요청에 CSP nonce를 붙인다([architecture.md](../docs/architecture.md) 보안 헤더).
- `/login` 페이지: 이미 세션이 있으면 `/`로 리다이렉트. proxy는 `/login → /` 리다이렉트를 하지 않는다.
- 모든 페이지·action: `requireSession()` (없으면 `redirect("/login")`).
