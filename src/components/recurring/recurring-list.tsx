"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { PageEmpty, PageHeader } from "@/components/app-shell/page-header";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { formatKRW } from "@/lib/money";
import { deleteRecurring } from "@/server/actions/recurring";
import type { CategoryDto } from "@/server/categories";
import type { RecurringDto } from "@/server/recurring";

type FormState = { open: boolean; target?: RecurringDto };

export function RecurringList({
  items,
  categories,
}: {
  items: RecurringDto[];
  categories: CategoryDto[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ open: false });
  const [deleting, setDeleting] = useState<RecurringDto | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const result = await deleteRecurring(target.id);
      setDeleting(null);
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success("삭제했습니다");
    });
  }

  return (
    <>
      <PageHeader title="고정지출">
        <Button onClick={() => setForm({ open: true })}>
          <Plus aria-hidden />
          추가
        </Button>
      </PageHeader>
      <p className="-mt-3 mb-6 text-sm text-muted-foreground">
        매달 지정한 날이 되면 지출로 자동 등록됩니다. 이번 달 날짜가 이미 지났으면 다음 달부터, 그
        달에 없는 날짜는 말일에 등록됩니다.
      </p>

      {items.length === 0 ? (
        <PageEmpty message="등록된 고정지출이 없습니다" />
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    매월 {r.dayOfMonth}일
                  </span>
                  <span className="truncate font-medium">{r.item}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {r.categoryName}
                  {r.categoryArchived ? " (보관됨)" : ""}
                  {r.merchant ? ` · ${r.merchant}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">다음 등록 {r.nextRunOn}</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="font-semibold tabular-nums text-expense">
                  -{formatKRW(r.amount)}원
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${r.item} 수정`}
                    onClick={() => setForm({ open: true, target: r })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${r.item} 삭제`}
                    onClick={() => setDeleting(r)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RecurringFormDialog
        key={form.target?.id ?? "new"}
        open={form.open}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
        recurring={form.target}
        categories={categories}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting ? `${deleting.item} 고정지출을 삭제할까요?` : ""}</AlertDialogTitle>
            <AlertDialogDescription>이미 등록된 거래는 그대로 남습니다.</AlertDialogDescription>
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
