"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TransactionDialog } from "@/components/transaction/transaction-dialog";
import type { CategoryDto } from "@/server/categories";
import type { TransactionDto } from "@/server/transactions";

type TxType = "INCOME" | "EXPENSE";

type Target =
  | { mode: "create"; date: string; key: number }
  | { mode: "edit"; tx: TransactionDto; key: number };

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
  today,
  children,
}: {
  categories: CategoryDto[];
  recentCategoryIds: Record<TxType, string[]>;
  today: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  const openCreate = useCallback(
    (defaults?: { date?: string }) => {
      setTarget({ mode: "create", date: defaults?.date ?? today, key: Date.now() });
      setOpen(true);
    },
    [today],
  );
  const openEdit = useCallback((tx: TransactionDto) => {
    setTarget({ mode: "edit", tx, key: Date.now() });
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ today, openCreate, openEdit }), [today, openCreate, openEdit]);

  return (
    <TransactionDialogContext.Provider value={value}>
      {children}
      {target && (
        <TransactionDialog
          key={target.key}
          open={open}
          onOpenChange={setOpen}
          formProps={{
            transaction: target.mode === "edit" ? target.tx : undefined,
            defaultDate: target.mode === "create" ? target.date : target.tx.occurredOn,
            categories,
            recentCategoryIds,
          }}
        />
      )}
    </TransactionDialogContext.Provider>
  );
}
