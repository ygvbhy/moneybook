"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AmountInput } from "@/components/amount-input";
import { PAYMENT_METHOD_LABELS, TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  transactionSchema,
  type TransactionInput,
} from "@/lib/validation/transaction";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/server/actions/transactions";
import type { CategoryDto } from "@/server/categories";
import type { TransactionDto } from "@/server/transactions";

type TxType = (typeof TRANSACTION_TYPES)[number];
type FormValues = z.input<typeof transactionSchema>;

export type TransactionFormProps = {
  /** 수정 모드면 대상 거래 */
  transaction?: TransactionDto;
  /** 생성 모드의 기본값 */
  defaultDate: string;
  defaultType?: TxType;
  categories: CategoryDto[];
  recentCategoryIds: Record<TxType, string[]>;
  onDone: () => void;
};

const NONE = "none";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function TransactionForm({
  transaction: tx,
  defaultDate,
  defaultType = "EXPENSE",
  categories,
  recentCategoryIds,
  onDone,
}: TransactionFormProps) {
  const isEdit = !!tx;
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasDetails = !!(tx && (tx.merchant || tx.item || tx.purpose || tx.paymentMethod || tx.memo));
  const [detailsOpen, setDetailsOpen] = useState(hasDetails);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormValues, unknown, TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: tx?.type ?? defaultType,
      amount: tx?.amount,
      categoryId: tx?.categoryId ?? "",
      occurredOn: tx?.occurredOn ?? defaultDate,
      merchant: tx?.merchant ?? "",
      item: tx?.item ?? "",
      purpose: tx?.purpose ?? "",
      paymentMethod: tx?.paymentMethod ?? "",
      memo: tx?.memo ?? "",
    },
  });

  const type = useWatch({ control, name: "type" }) as TxType;
  const categoryId = useWatch({ control, name: "categoryId" });

  // 현재 유형의 활성 카테고리 + (수정 시) 현재 카테고리가 보관됨이면 포함
  const options = categories.filter(
    (c) => c.type === type && (!c.archived || c.id === tx?.categoryId),
  );
  const activeById = new Map(categories.filter((c) => !c.archived).map((c) => [c.id, c]));
  const chips = (recentCategoryIds[type] ?? [])
    .map((id) => activeById.get(id))
    .filter((c): c is CategoryDto => !!c && c.type === type)
    .slice(0, 5);

  function applyFailure(result: { error: string; fieldErrors?: Record<string, string[]> }) {
    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof FormValues, { message: messages[0] });
    }
    toast.error(result.error);
    // 이미 삭제된 거래면 더 이상 수정할 수 없으므로 닫는다
    if (isEdit && result.error.includes("이미 삭제")) onDone();
  }

  function onSubmit(values: TransactionInput) {
    startTransition(async () => {
      const result = tx ? await updateTransaction(tx.id, values) : await createTransaction(values);
      if (!result.ok) return applyFailure(result);
      toast.success("저장했습니다");
      onDone();
    });
  }

  function onDelete() {
    if (!tx) return;
    startTransition(async () => {
      const result = await deleteTransaction(tx.id);
      setConfirmOpen(false);
      if (!result.ok) return applyFailure(result);
      toast.success("삭제했습니다");
      onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (errs) => {
        if (errs.merchant || errs.item || errs.purpose || errs.paymentMethod || errs.memo) {
          setDetailsOpen(true);
        }
      })}
      className="flex flex-col gap-4"
      noValidate
    >
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={field.value}
            onValueChange={(v) => {
              if (!v || v === field.value) return;
              field.onChange(v);
              setValue("categoryId", "");
            }}
            aria-label="거래 유형"
            className="w-full"
          >
            {TRANSACTION_TYPES.map((t) => (
              <ToggleGroupItem key={t} value={t} className="flex-1">
                {TYPE_LABELS[t]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-amount">금액</Label>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <AmountInput
              id="tx-amount"
              autoFocus
              ref={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              value={field.value ?? null}
              onChange={field.onChange}
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? "tx-amount-error" : undefined}
            />
          )}
        />
        <FieldError id="tx-amount-error" message={errors.amount?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-category">카테고리</Label>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="최근 사용한 카테고리">
            {chips.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={categoryId === c.id ? "default" : "outline"}
                aria-pressed={categoryId === c.id}
                onClick={() => setValue("categoryId", c.id, { shouldValidate: !!errors.categoryId })}
              >
                {c.name}
              </Button>
            ))}
          </div>
        )}
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <SelectTrigger
                id="tx-category"
                className="w-full"
                aria-invalid={!!errors.categoryId}
                aria-describedby={errors.categoryId ? "tx-category-error" : undefined}
              >
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.archived ? " (보관됨)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError id="tx-category-error" message={errors.categoryId?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-date">날짜</Label>
        <Input
          id="tx-date"
          type="date"
          aria-invalid={!!errors.occurredOn}
          aria-describedby={errors.occurredOn ? "tx-date-error" : undefined}
          {...register("occurredOn")}
        />
        <FieldError id="tx-date-error" message={errors.occurredOn?.message} />
      </div>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          aria-expanded={detailsOpen}
          aria-controls="tx-details"
          onClick={() => setDetailsOpen((o) => !o)}
        >
          상세 입력
          <ChevronDown className={cn("transition-transform", detailsOpen && "rotate-180")} aria-hidden />
        </Button>
        <div id="tx-details" hidden={!detailsOpen} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tx-merchant">거래처</Label>
            <Input id="tx-merchant" aria-invalid={!!errors.merchant} {...register("merchant")} />
            <FieldError id="tx-merchant-error" message={errors.merchant?.message} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tx-item">구매 항목</Label>
            <Input id="tx-item" aria-invalid={!!errors.item} {...register("item")} />
            <FieldError id="tx-item-error" message={errors.item?.message} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tx-purpose">구매 이유</Label>
            <Input id="tx-purpose" aria-invalid={!!errors.purpose} {...register("purpose")} />
            <FieldError id="tx-purpose-error" message={errors.purpose?.message} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tx-payment">결제 수단</Label>
            <Controller
              control={control}
              name="paymentMethod"
              render={({ field }) => (
                <Select
                  value={typeof field.value === "string" && field.value ? field.value : NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                >
                  <SelectTrigger id="tx-payment" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>선택 안 함</SelectItem>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError id="tx-payment-error" message={errors.paymentMethod?.message} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tx-memo">메모</Label>
            <Textarea id="tx-memo" rows={3} aria-invalid={!!errors.memo} {...register("memo")} />
            <FieldError id="tx-memo-error" message={errors.memo?.message} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        {isEdit ? (
          <Button type="button" variant="destructive" disabled={pending} onClick={() => setConfirmOpen(true)}>
            삭제
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>

      {isEdit && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>거래를 삭제할까요?</AlertDialogTitle>
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
      )}
    </form>
  );
}
