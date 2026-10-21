"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  archiveCategory,
  createCategory,
  renameCategory,
  restoreCategory,
} from "@/server/actions/categories";
import { TYPE_LABELS } from "@/lib/labels";
import { TYPE_TOGGLE_ITEM_CLASS } from "@/lib/type-toggle";
import type { ActionResult } from "@/lib/action-result";
import type { CategoryDto } from "@/server/categories";

type Type = "INCOME" | "EXPENSE";

function errorText(res: Extract<ActionResult<unknown>, { ok: false }>) {
  return res.fieldErrors?.name?.[0] ?? res.error;
}

function CategoryItem({ category }: { category: CategoryDto }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = `rename-${category.id}`;

  function run(fn: () => Promise<ActionResult<unknown>>, success: string, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(errorText(res));
        toast.error(errorText(res));
        return;
      }
      toast.success(success);
      onOk?.();
      router.refresh();
    });
  }

  return (
    <li className="py-3">
      {editing ? (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => renameCategory(category.id, name), "이름을 변경했습니다", () =>
              setEditing(false),
            );
          }}
        >
          <div className="flex flex-wrap gap-2">
            <Label htmlFor={inputId} className="sr-only">
              {category.name} 새 이름
            </Label>
            <Input
              id={inputId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="min-w-0 flex-1"
              aria-invalid={!!error}
              autoFocus
            />
            <Button type="submit" disabled={pending}>
              저장
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setName(category.name);
                setError(null);
              }}
            >
              취소
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={category.archived ? "text-muted-foreground" : "font-medium"}>
            {category.name}
            {category.archived && <span className="ml-1 text-sm">(보관됨)</span>}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              이름 변경<span className="sr-only"> ({category.name})</span>
            </Button>
            {category.archived ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => run(() => restoreCategory(category.id), "카테고리를 복원했습니다")}
              >
                복원<span className="sr-only"> ({category.name})</span>
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={pending}>
                    보관<span className="sr-only"> ({category.name})</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>&apos;{category.name}&apos; 카테고리를 보관할까요?</AlertDialogTitle>
                    <AlertDialogDescription>
                      보관하면 새 거래 입력에서 선택할 수 없지만, 기존 거래 내역은 그대로
                      유지됩니다. 언제든 복원할 수 있습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => run(() => archiveCategory(category.id), "카테고리를 보관했습니다")}
                    >
                      보관
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}
      {!editing && error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

export function CategoryManager({ categories }: { categories: CategoryDto[] }) {
  const router = useRouter();
  const [type, setType] = useState<Type>("EXPENSE");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const list = categories.filter((c) => c.type === type);
  const active = list.filter((c) => !c.archived);
  const archived = list.filter((c) => c.archived);

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await createCategory({ name: newName, type });
      if (!res.ok) {
        setError(errorText(res));
        return;
      }
      toast.success("카테고리를 추가했습니다");
      setNewName("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>카테고리 관리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleGroup
          type="single"
          variant="outline"
          value={type}
          onValueChange={(v) => {
            if (v === "INCOME" || v === "EXPENSE") {
              setType(v);
              setError(null);
            }
          }}
          aria-label="카테고리 유형"
        >
          <ToggleGroupItem value="EXPENSE" className={TYPE_TOGGLE_ITEM_CLASS.EXPENSE}>
            {TYPE_LABELS.EXPENSE}
          </ToggleGroupItem>
          <ToggleGroupItem value="INCOME" className={TYPE_TOGGLE_ITEM_CLASS.INCOME}>
            {TYPE_LABELS.INCOME}
          </ToggleGroupItem>
        </ToggleGroup>

        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <div className="flex gap-2">
            <Label htmlFor="new-category-name" className="sr-only">
              {TYPE_LABELS[type]} 카테고리 이름
            </Label>
            <Input
              id="new-category-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`새 ${TYPE_LABELS[type]} 카테고리 이름`}
              maxLength={30}
              className="min-w-0 flex-1"
              aria-invalid={!!error}
              aria-describedby={error ? "new-category-error" : undefined}
            />
            <Button type="submit" disabled={pending}>
              추가
            </Button>
          </div>
          {error && (
            <p id="new-category-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {TYPE_LABELS[type]} 카테고리가 없습니다
          </p>
        ) : (
          <ul className="divide-y">
            {[...active, ...archived].map((c) => (
              <CategoryItem key={c.id} category={c} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
