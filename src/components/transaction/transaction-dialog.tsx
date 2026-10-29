"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TransactionForm,
  type TransactionFormProps,
} from "@/components/transaction/transaction-form";

const QUERY = "(min-width: 768px)";

function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

/** 서버 렌더/하이드레이션 중에는 true(Dialog)로 둔다 */
function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 바뀌면 다이얼로그는 그대로 두고 폼만 다시 마운트한다 */
  formKey: number;
  formProps: Omit<TransactionFormProps, "onDone">;
};

export function TransactionDialog({ open, onOpenChange, formKey, formProps }: Props) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const isEdit = !!formProps.transaction;
  const title = isEdit ? "거래 수정" : "거래 추가";
  const description = isEdit ? "거래 내용을 수정합니다" : "새 거래를 입력합니다";

  const form = (
    <TransactionForm
      key={formKey}
      {...formProps}
      onDone={() => {
        onOpenChange(false);
        router.refresh();
      }}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{description}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-xl p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
        </SheetHeader>
        {form}
      </SheetContent>
    </Sheet>
  );
}
