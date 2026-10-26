# Frontend

## 공통 컴포넌트

| 컴포넌트 | 위치 | 용도 |
| --- | --- | --- |
| `PageHeader`, `PageEmpty` | `components/app-shell/page-header.tsx` | 페이지 제목 + 우측 컨트롤, 빈 상태 박스 |
| `PageSkeleton` | `components/app-shell/page-skeleton.tsx` | `loading.tsx`용 (`cards`, `rows`) |
| `MonthSwitcher` | `components/month-switcher.tsx` | 이전/다음 달·이번 달 링크 (Server Component) |
| `AmountInput` | `components/amount-input.tsx` | 천 단위 쉼표 표시, `number \| null` 반환, "원" 접미사 |
| `AmountText` | `components/transaction/amount-text.tsx` | 수입 `+`/지출 `-` 기호 + 색 |
| `BudgetMeter` | `components/budget/budget-meter.tsx` | 사용액·잔여·사용률·초과 표시 |
| `useTransactionDialog()` | `components/transaction/transaction-dialog-provider.tsx` | 어디서든 거래 추가/수정 다이얼로그 열기 |
| `NAV_ITEMS`, `isActivePath` | `components/app-shell/nav-items.ts` | 사이드바·하단 탭 공용 메뉴 |
| shadcn `ui/*` | `components/ui/` | Button, Card, Dialog, Sheet, AlertDialog, Select, ToggleGroup, Checkbox 등 |

## 상태 관리

전역 상태 라이브러리는 없다. 상태 종류별 위치:

| 상태 | 저장 위치 |
| --- | --- |
| 서버 데이터 | Server Component가 조회해 props로 전달. 변경 후 `router.refresh()` |
| 월·날짜·필터 | URL search params ([api.md](api.md)) |
| 거래 다이얼로그 열림·대상 | `TransactionDialogProvider` (context: `today`, `openCreate`, `openEdit`) |
| 폼 | react-hook-form + `zodResolver` |
| 사이드바 접힘 | 쿠키 `sidebar_collapsed=1` (레이아웃이 서버에서 읽음) |
| 테마 | next-themes (`class` 속성, 기본 system) |

- props가 바뀔 때 로컬 상태를 맞추는 경우 `useEffect` 대신 "렌더 중 이전 값 비교" 패턴을 쓴다 (`calendar-grid.tsx`, `transaction-filters.tsx`).
- 다이얼로그를 새로 열 때 `key={Date.now()}`로 폼을 리마운트해 초기화한다.

## 반응형 (기준 `md` = 768px)

| | < 768px | ≥ 768px |
| --- | --- | --- |
| 내비 | `MobileHeader` + `BottomNav` | `Sidebar` (접기 가능, w-56 ↔ w-16) |
| 거래 폼 | 하단 `Sheet` | `Dialog` (SSR·하이드레이션 중엔 Dialog) |
| 거래 목록 | `TransactionCardList` | `TransactionTable` |
| 거래 일괄 편집 | `TransactionList`가 선택 상태·동작 바를 갖고 위 두 목록을 함께 렌더 (모바일은 "선택" 모드) | 동일 (표 체크박스 열) |
| 거래 추가 | `QuickAddFab` (항상 표시) | 동일 |

FAB 기본 날짜: `?date=` → 이번 달이 아닌 `?month=`의 1일 → 오늘.

## 색·표기

- 금액 색 토큰: `text-income`(파랑), `text-expense`(빨강). `globals.css`의 `--income`/`--expense` (라이트·다크 각각 정의).
- 색만으로 구분하지 않는다: 수입 `+`, 지출 `-` 기호를 함께 쓴다. 숫자에는 `tabular-nums`.
- 수입/지출 토글은 `TYPE_TOGGLE_ITEM_CLASS[type]`로 선택 상태를 금액 색으로 강조한다.
- 고정지출 "예정"은 `text-muted-foreground`(회색).
- 보관된 카테고리는 이름 뒤 `(보관됨)`.

## 접근성 체크리스트

- [ ] 모든 입력에 `<Label htmlFor>`; 오류는 `aria-invalid` + `aria-describedby` + `role="alert"` 문구
- [ ] 아이콘 버튼에 `aria-label`, 아이콘에 `aria-hidden`
- [ ] 포커스 링 유지 (`focus-visible:ring-3 focus-visible:ring-ring/50`)
- [ ] 현재 메뉴 `aria-current="page"`
- [ ] 애니메이션에 `motion-reduce:transition-none`
- [ ] 캘린더 그리드: roving tabindex, 화살표/Home/End 이동
- [ ] Dialog·Sheet 포커스 트랩은 Radix 기본 동작 사용

## 피드백

- 성공·실패: sonner `toast.success("저장했습니다" | "삭제했습니다")`, `toast.error(result.error)`.
- 필드 오류: 인라인 표시. 접힌 "상세 입력" 영역에 오류가 있으면 펼친다.
- 삭제: `AlertDialog` 확인 후 실행. 진행 중 버튼 `disabled` + "저장 중..." / "삭제 중...".
- 수정 대상이 이미 삭제됐으면(`"이미 삭제"` 포함 메시지) 다이얼로그를 닫는다.
