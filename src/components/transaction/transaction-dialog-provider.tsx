"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TransactionDialog } from "@/components/transaction/transaction-dialog";
import type { MerchantSuggestion, TransactionPreset } from "@/lib/transaction-presets";
import type { CategoryDto } from "@/server/categories";
import type { TransactionDto } from "@/server/transactions";

type TxType = "INCOME" | "EXPENSE";

type Target =
  | { mode: "create"; date: string; source?: TransactionDto; key: number; formKey: number }
  | { mode: "edit"; tx: TransactionDto; key: number; formKey: number };

type Ctx = {
  today: string;
  openCreate: (defaults?: { date?: string }) => void;
  openEdit: (tx: TransactionDto) => void;
};

const TransactionDialogContext = createContext<Ctx | null>(null);

export function useTransactionDialog(): Ctx {
  const ctx = useContext(TransactionDialogContext);
  if (!ctx) throw new Error("useTransactionDialog must be used within TransactionDialogProvider");
  return ctx;
}

export function TransactionDialogProvider({
  categories,
  recentCategoryIds,
  recentPresets,
  merchantSuggestions,
  today,
  children,
}: {
  categories: CategoryDto[];
  recentCategoryIds: Record<TxType, string[]>;
  recentPresets: Record<TxType, TransactionPreset[]>;
  merchantSuggestions: Record<TxType, MerchantSuggestion[]>;
  today: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  const openCreate = useCallback(
    (defaults?: { date?: string }) => {
      const now = Date.now();
      setTarget({ mode: "create", date: defaults?.date ?? today, key: now, formKey: now });
      setOpen(true);
    },
    [today],
  );
  const openEdit = useCallback((tx: TransactionDto) => {
    const now = Date.now();
    setTarget({ mode: "edit", tx, key: now, formKey: now });
    setOpen(true);
  }, []);
  // 다이얼로그 key는 유지하고 폼만 다시 마운트한다. 닫은 뒤 포커스가 원래 트리거로 돌아가게 하기 위함
  const openDuplicate = useCallback(
    (tx: TransactionDto) => {
      setTarget((t) => ({
        mode: "create",
        date: today,
        source: tx,
        key: t?.key ?? Date.now(),
        formKey: Date.now(),
      }));
    },
    [today],
  );

  const value = useMemo(() => ({ today, openCreate, openEdit }), [today, openCreate, openEdit]);

  return (
    <TransactionDialogContext.Provider value={value}>
      {children}
      {target && (
        <TransactionDialog
          key={target.key}
          open={open}
          onOpenChange={setOpen}
          formKey={target.formKey}
          formProps={{
            transaction: target.mode === "edit" ? target.tx : undefined,
            defaultDate: target.mode === "create" ? target.date : target.tx.occurredOn,
            duplicateFrom: target.mode === "create" ? target.source : undefined,
            onDuplicate: target.mode === "edit" ? () => openDuplicate(target.tx) : undefined,
            categories,
            recentCategoryIds,
            recentPresets,
            merchantSuggestions,
          }}
        />
      )}
    </TransactionDialogContext.Provider>
  );
}
