# API: Server Actions & URL Params

REST API는 없다. 클라이언트 → 서버 변경은 전부 Server Action(`src/server/actions/*`)이다.

## 반환 계약 (`src/lib/action-result.ts`)

```ts
type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

- 검증 실패: `validationFailure(zodError)` → `error: "입력값을 확인하세요"` + `fieldErrors`.
- 잘못된 id: `{ ok: false, error: "잘못된 요청입니다" }`.
- `ServiceError`: 메시지 그대로. 그 외 예외: 서버 로그 + `"처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요"`.

## Action 템플릿

```ts
"use server";

const idSchema = z.string().min(1);

export async function updateX(id: string, input: unknown): Promise<ActionResult> {
  await requireSession();                       // 1. 반드시 runService 밖 (redirect를 throw함)
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "잘못된 요청입니다" };
  const parsed = xSchema.safeParse(input);      // 2. 입력은 unknown으로 받아 검증
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await runService(() => svc.updateX(parsedId.data, parsed.data)); // 3.
  revalidatePath("/", "layout");                // 4.
  return result;
}
```

### revalidate 규칙

| action 종류 | 호출 조건 |
| --- | --- |
| create / set | `if (result.ok)`일 때만 |
| update / delete / rename / archive / restore | 항상 (이미 삭제된 대상이어도 목록 갱신) |
| import | `if (result.ok)`일 때만 |
| 읽기 전용 (export) | 호출하지 않는다 (값만 반환) |
| restore (백업 복원) | `if (result.ok)`일 때만 (실패하면 데이터가 그대로) |

### 체크리스트 (새 action)

- [ ] 첫 줄 `await requireSession()` — `tests/integration/auth-guard.test.ts`가 모든 export를 자동 검사한다
- [ ] 입력 `unknown` + Zod `safeParse`
- [ ] 오늘 날짜가 필요하면 action에서 `todayInSeoul()`을 계산해 서비스에 인자로 넘긴다 (서비스는 today를 주입받음 → 테스트 가능)
- [ ] 서비스 호출은 `runService`
- [ ] `revalidatePath("/", "layout")`

## Action 목록

| 파일 | 함수 | 입력 | data |
| --- | --- | --- | --- |
| `auth.ts` | `login(prevState, FormData \| {username,password})` | `loginSchema` | 성공 시 `redirect("/")` (세션 불필요한 유일한 action) |
| `auth.ts` | `logout()` | — | `redirect("/login")` |
| `transactions.ts` | `createTransaction(input)` | `transactionSchema` | `{ id }` |
| | `updateTransaction(id, input)` / `deleteTransaction(id)` | | — |
| | `deleteTransactions(ids)` | id 배열 (중복 제거 후 1 ~ 5,000건) | `{ count }`. 이미 없는 id는 무시, 전부 없으면 `TX_NOT_FOUND` |
| | `updateTransactionsCategory(input)` | `{ ids, categoryId }` (ids 규칙은 위와 같음) | `{ count }`. 규칙은 [knowledge/transaction.md](../knowledge/transaction.md) "일괄 편집" |
| | `exportTransactionsCsv(input)` | `{ scope: "filtered", params? }` (`/transactions` search params) \| `{ scope: "all" }` | `{ filename, csv, count }` (읽기 전용) |
| | `importTransactionsCsv(text)` | CSV 문자열 (≤ 800KB) | `{ count }`. 행 오류는 `fieldErrors.rows`에 `"N행: 메시지"` 목록 |
| `categories.ts` | `createCategory(input)` | `categorySchema` | `{ id }` |
| | `renameCategory(id, name)` / `archiveCategory(id)` / `restoreCategory(id)` | `categoryNameSchema` | — |
| `budgets.ts` | `setTotalBudget(input)` | `totalBudgetSchema` (`amount` null = 삭제) | — |
| | `setCategoryBudget(input)` | `categoryBudgetSchema` | — |
| `recurring.ts` | `createRecurring(input)` | `recurringSchema` | `{ id }` |
| | `updateRecurring(id, input)` / `deleteRecurring(id)` | | — |
| `backup.ts` | `exportBackup()` | — | `{ filename, json, counts }` (읽기 전용) |
| | `restoreBackup(input)` | 파싱한 백업 객체, `backupSchema` | `{ counts }`. 전체 교체. 검증 오류는 `fieldErrors.rows`에 `"경로: 메시지"` 최대 20개 → [knowledge/backup.md](../knowledge/backup.md) |

## 클라이언트 호출 패턴

```ts
startTransition(async () => {
  const result = await action(values);
  if (!result.ok) {
    for (const [field, msgs] of Object.entries(result.fieldErrors ?? {})) setError(field, { message: msgs[0] });
    toast.error(result.error);
    return;
  }
  toast.success("저장했습니다");
  onDone();            // 다이얼로그 닫기 + router.refresh()
});
```

## URL search params

잘못된 값은 오류 없이 기본값으로 대체하거나 무시한다.

| 경로 | 파라미터 | 정규화 |
| --- | --- | --- |
| `/` `/budgets` | `month=YYYY-MM` | `normalizeMonthParam` → 무효면 서울 기준 이번 달 |
| `/calendar` | `month`, `date=YYYY-MM-DD` | `date`가 무효이거나 `month` 밖이면 선택 없음 |
| `/transactions` | `month`, `range=all`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `type=INCOME\|EXPENSE`, `category=<id>`, `payment=<PaymentMethod>\|none`, `q`, `sort=asc`, `page=N` | `page`는 `paginate`: 양의 정수(앞자리 0 없음)가 아니면 1, 마지막 페이지를 넘으면 마지막 페이지(URL 유지). 필터 변경 시 제거. `ListParams`에 넣지 않으므로 CSV "현재 목록" 내보내기는 page와 무관하게 필터 결과 전체. 나머지는 `parseListParams`: `range=all`이 `from`/`to`보다 우선, `from`·`to`는 둘 다 `isValidPeriodDate`이고 `from <= to`일 때만 기간(아니면 월별), 알 수 없는 type·payment, 없는 category 무시, `q`는 trim 후 100자, `sort`는 `asc` 외 `desc` |
| `/recurring` | 없음 | |
| `/reports` | `year=YYYY` | `normalizeYearParam` → 1900~9998 정수가 아니면 서울 기준 올해 |

- `MonthSwitcher`는 월 이동 시 `month`, `date`, `page`를 제외한 나머지 파라미터를 유지한다.
- 필터 변경은 `router.replace`, 날짜 선택은 `router.push(..., { scroll: false })`.
