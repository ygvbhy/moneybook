"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { AmountInput } from "@/components/amount-input";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { PAYMENT_METHODS } from "@/lib/validation/transaction";
import { recurringSchema, type RecurringInput } from "@/lib/validation/recurring";
import { createRecurring, updateRecurring } from "@/server/actions/recurring";
import type { CategoryDto } from "@/server/categories";
import type { RecurringDto } from "@/server/recurring";

type FormValues = z.input<typeof recurringSchema>;

const NONE = "none";
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 수정 모드면 대상 고정지출 */
  recurring?: RecurringDto;
  categories: CategoryDto[];
};

export function RecurringFormDialog({ open, onOpenChange, recurring, categories }: Props) {
  const isEdit = !!recurring;
  const title = isEdit ? "고정지출 수정" : "고정지출 추가";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            매달 자동으로 등록될 지출을 입력합니다
          </DialogDescription>
        </DialogHeader>
        <RecurringForm
          recurring={recurring}
          categories={categories}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function RecurringForm({
  recurring,
  categories,
  onDone,
}: {
  recurring?: RecurringDto;
  categories: CategoryDto[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues, unknown, RecurringInput>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      categoryId: recurring?.categoryId ?? "",
      item: recurring?.item ?? "",
      amount: recurring?.amount,
      dayOfMonth: recurring?.dayOfMonth,
      merchant: recurring?.merchant ?? "",
      paymentMethod: recurring?.paymentMethod ?? "",
      memo: recurring?.memo ?? "",
    },
  });

  const options = categories.filter(
    (c) => c.type === "EXPENSE" && (!c.archived || c.id === recurring?.categoryId),
  );

  function onSubmit(values: RecurringInput) {
    startTransition(async () => {
      const result = recurring
        ? await updateRecurring(recurring.id, values)
        : await createRecurring(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof FormValues, { message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      toast.success("저장했습니다");
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="rec-category">카테고리</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <SelectTrigger
                id="rec-category"
                className="w-full"
                aria-invalid={!!errors.categoryId}
                aria-describedby={errors.categoryId ? "rec-category-error" : undefined}
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
        <FieldError id="rec-category-error" message={errors.categoryId?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rec-item">지출 내역</Label>
        <Input
          id="rec-item"
          aria-invalid={!!errors.item}
          aria-describedby={errors.item ? "rec-item-error" : undefined}
          {...register("item")}
        />
        <FieldError id="rec-item-error" message={errors.item?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rec-amount">금액</Label>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <AmountInput
              id="rec-amount"
              ref={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              value={field.value ?? null}
              onChange={field.onChange}
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? "rec-amount-error" : undefined}
            />
          )}
        />
        <FieldError id="rec-amount-error" message={errors.amount?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rec-day">매월 일자</Label>
        <Controller
          control={control}
          name="dayOfMonth"
          render={({ field }) => (
            <Select
              value={field.value ? String(field.value) : undefined}
              onValueChange={(v) => field.onChange(Number(v))}
            >
              <SelectTrigger
                id="rec-day"
                className="w-full"
                aria-invalid={!!errors.dayOfMonth}
                aria-describedby={errors.dayOfMonth ? "rec-day-error" : undefined}
              >
                <SelectValue placeholder="일자 선택" />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}일
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError id="rec-day-error" message={errors.dayOfMonth?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rec-merchant">거래처</Label>
        <Input id="rec-merchant" aria-invalid={!!errors.merchant} {...register("merchant")} />
        <FieldError id="rec-merchant-error" message={errors.merchant?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rec-payment">결제 수단</Label>
        <Controller
          control={control}
          name="paymentMethod"
          render={({ field }) => (
            <Select
              value={typeof field.value === "string" && field.value ? field.value : NONE}
              onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id="rec-payment" className="w-full">
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
        <FieldError id="rec-payment-error" message={errors.paymentMethod?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rec-memo">메모</Label>
        <Textarea id="rec-memo" rows={3} aria-invalid={!!errors.memo} {...register("memo")} />
        <FieldError id="rec-memo-error" message={errors.memo?.message} />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
