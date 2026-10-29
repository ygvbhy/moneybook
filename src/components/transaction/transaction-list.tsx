"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TagIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionCardList } from "@/components/transaction/transaction-card-list";
import { TransactionTable } from "@/components/transaction/transaction-table";
import { toastDeleted } from "@/components/transaction/undo-delete";
import { deleteTransactions, updateTransactionsCategory } from "@/server/actions/transactions";
import type { CategoryDto } from "@/server/categories";
import type { TransactionDto } from "@/server/transactions";

const MIXED_NOTICE = "수입·지출이 섞여 있어 카테고리를 바꿀 수 없습니다";

export function TransactionList({
  transactions,
  categories,
  showYear,
}: {
  transactions: TransactionDto[];
  categories: CategoryDto[];
  showYear: boolean;
}) {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const focusBarOnClose = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryValue, setCategoryValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // 목록이 바뀌면(필터 변경·refresh) 현재 목록에 없는 선택을 제거한다 (렌더 중 상태 조정)
  const [prevTransactions, setPrevTransactions] = useState(transactions);
  if (prevTransactions !== transactions) {
    setPrevTransactions(transactions);
    const present = new Set(transactions.map((tx) => tx.id));
    if ([...selectedIds].some((id) => !present.has(id))) {
      setSelectedIds(new Set([...selectedIds].filter((id) => present.has(id))));
    }
  }

  const selected = transactions.filter((tx) => selectedIds.has(tx.id));
  const count = selected.length;
  const types = new Set(selected.map((tx) => tx.type));
  const mixed = types.size > 1;
  const selectedType = types.size === 1 ? [...types][0] : null;
  const usableCategories = selectedType
    ? categories.filter((c) => c.type === selectedType && !c.archived)
    : [];
  const inSelectMode = selectMode || selectedIds.size > 0;

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(transactions.map((tx) => tx.id)) : new Set());
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  function finish() {
    // 처리 후엔 트리거 버튼이 비활성되거나 사라지므로 닫힐 때 포커스를 동작 바로 옮긴다
    focusBarOnClose.current = true;
    clearSelection();
    setCategoryOpen(false);
    setDeleteOpen(false);
    router.refresh();
  }

  function applyFailure(error: string) {
    toast.error(error);
    if (error.includes("이미 삭제")) finish();
  }

  function onDelete() {
    const ids = selected.map((tx) => tx.id);
    startTransition(async () => {
      const result = await deleteTransactions(ids);
      if (!result.ok) return applyFailure(result.error);
      toastDeleted({
        message: `${result.data?.count ?? ids.length}건을 삭제했습니다`,
        deleted: result.data?.deleted,
        refresh: () => router.refresh(),
      });
      finish();
    });
  }

  function onChangeCategory() {
    const ids = selected.map((tx) => tx.id);
    startTransition(async () => {
      const result = await updateTransactionsCategory({ ids, categoryId: categoryValue });
      if (!result.ok) return applyFailure(result.error);
      toast.success(`${result.data?.count ?? ids.length}건의 카테고리를 바꿨습니다`);
      finish();
    });
  }

  // Dialog.Trigger를 쓰지 않아 Radix가 포커스를 돌려줄 곳이 없으므로 직접 정한다.
  // 취소면 연 버튼으로, 처리 후면 동작 바로 옮긴다
  function onCloseAutoFocus(e: Event) {
    e.preventDefault();
    const opener = openerRef.current;
    openerRef.current = null;
    if (!focusBarOnClose.current && opener?.isConnected) opener.focus();
    else barRef.current?.focus();
    focusBarOnClose.current = false;
  }

  function rememberOpener() {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  function openCategory() {
    rememberOpener();
    setCategoryValue("");
    setCategoryOpen(true);
  }

  function openDelete() {
    rememberOpener();
    setDeleteOpen(true);
  }

  return (
    <>
      <div
        ref={barRef}
        tabIndex={-1}
        className="sticky top-0 z-30 flex h-12 items-center gap-2 bg-background outline-none"
      >
        {/* PC */}
        <div className="hidden w-full items-center gap-2 md:flex">
          {/* live 영역은 하나로 유지해야 0건 → 1건 변화도 스크린 리더가 읽는다 */}
          <p className="mr-auto flex items-center gap-2 text-sm" aria-live="polite">
            {count === 0 ? (
              <span className="text-muted-foreground">거래를 선택하면 일괄 편집할 수 있습니다</span>
            ) : (
              <>
                <span className="font-medium tabular-nums">{count}건 선택</span>
                {mixed && <span className="text-muted-foreground">{MIXED_NOTICE}</span>}
              </>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={count === 0 || mixed || pending}
            onClick={openCategory}
          >
            카테고리 변경
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={count === 0 || pending}
            onClick={openDelete}
          >
            삭제
          </Button>
          {count > 0 && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={clearSelection}>
              선택 해제
            </Button>
          )}
        </div>
        {/* 모바일 */}
        <div className="flex w-full items-center gap-1 md:hidden">
          {inSelectMode ? (
            <>
              <p className="mr-auto shrink-0 text-sm" aria-live="polite">
                <span className="font-medium tabular-nums">{count}건 선택</span>
                {mixed && <span className="sr-only"> {MIXED_NOTICE}</span>}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => toggleAll(true)}
              >
                전체 선택
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="카테고리 변경"
                // 좁은 화면이라 혼합 안내 문구 대신, 비활성처럼 보이게 두고 누르면 토스트로 알린다
                aria-disabled={mixed || undefined}
                className="aria-disabled:opacity-50"
                disabled={count === 0 || pending}
                onClick={() => (mixed ? toast.info(MIXED_NOTICE) : openCategory())}
              >
                <TagIcon aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="삭제"
                disabled={count === 0 || pending}
                onClick={openDelete}
              >
                <Trash2Icon aria-hidden />
              </Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={clearSelection}>
                완료
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setSelectMode(true)}
            >
              선택
            </Button>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <TransactionTable
          transactions={transactions}
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
        />
      </div>
      <div className="md:hidden">
        <TransactionCardList
          transactions={transactions}
          showYear={showYear}
          selectMode={inSelectMode}
          selectedIds={selectedIds}
          onToggle={toggle}
        />
      </div>

      <Dialog open={categoryOpen} onOpenChange={(open) => !pending && setCategoryOpen(open)}>
        <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>카테고리 변경</DialogTitle>
            <DialogDescription>선택한 {count}건의 카테고리를 바꿉니다</DialogDescription>
          </DialogHeader>
          {usableCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">바꿀 수 있는 카테고리가 없습니다</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="bulk-category">카테고리</Label>
              <Select value={categoryValue || undefined} onValueChange={setCategoryValue}>
                <SelectTrigger id="bulk-category" className="w-full">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {usableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={pending || usableCategories.length === 0 || !categoryValue}
              onClick={onChangeCategory}
            >
              {pending ? "저장 중..." : "변경"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>선택한 {count}건을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제한 거래는 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
            >
              {pending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
