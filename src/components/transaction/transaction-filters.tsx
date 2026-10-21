"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TYPE_LABELS } from "@/lib/labels";
import type { CategoryDto } from "@/server/categories";

const ALL = "all";

type Props = {
  categories: CategoryDto[];
  type?: "INCOME" | "EXPENSE";
  categoryId?: string;
  q?: string;
  sort: "asc" | "desc";
};

export function TransactionFilters({ categories, type, categoryId, q, sort }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [lastPushedQ, setLastPushedQ] = useState<string | undefined>(undefined);

  // URL이 바뀌면(필터 초기화, 뒤로 가기) 입력값도 맞춘다
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    // 이 컴포넌트가 직접 push한 값이 아닐 때(뒤로 가기, 필터 초기화)만 입력값을 맞춘다
    // 직접 push한 값의 응답은 한 번만 건너뛰고 기억을 지운다(이후 같은 값으로의 외부 이동은 동기화)
    if ((q ?? "") === lastPushedQ) setLastPushedQ(undefined);
    else setQuery(q ?? "");
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  function update(changes: Record<string, string | undefined>) {
    const params = new URLSearchParams(window.location.search); // 디바운스 중 바뀐 필터를 지우지 않도록 실행 시점의 URL 기준
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const trimmed = value.trim();
      setLastPushedQ(trimmed);
      update({ q: trimmed || undefined });
    }, 300);
  }

  const visible = categories.filter((c) => !type || c.type === type);
  const groups = (["EXPENSE", "INCOME"] as const)
    .map((t) => ({ t, items: visible.filter((c) => c.type === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3" role="search" aria-label="거래 필터">
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={type ?? ALL}
        onValueChange={(v) => {
          if (!v) return;
          const next = v === ALL ? undefined : v;
          // 유형이 바뀌면 다른 유형의 카테고리 필터는 해제한다
          const cat = categories.find((c) => c.id === categoryId);
          update({ type: next, category: cat && next && cat.type !== next ? undefined : categoryId });
        }}
        aria-label="유형 필터"
      >
        <ToggleGroupItem value={ALL}>전체</ToggleGroupItem>
        <ToggleGroupItem value="INCOME">{TYPE_LABELS.INCOME}</ToggleGroupItem>
        <ToggleGroupItem value="EXPENSE">{TYPE_LABELS.EXPENSE}</ToggleGroupItem>
      </ToggleGroup>

      <Select
        value={categoryId ?? ALL}
        onValueChange={(v) => update({ category: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="w-40" aria-label="카테고리 필터">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>모든 카테고리</SelectItem>
          {groups.map((g) => (
            <SelectGroup key={g.t}>
              <SelectLabel>{TYPE_LABELS[g.t]}</SelectLabel>
              {g.items.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.archived ? " (보관됨)" : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            clearTimeout(timer.current);
            setLastPushedQ(query.trim());
            update({ q: query.trim() || undefined });
          }
        }}
        placeholder="거래처·항목·메모 검색"
        aria-label="검색"
        maxLength={100}
        className="w-full sm:w-56"
      />

      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={sort}
        onValueChange={(v) => v && update({ sort: v === "asc" ? "asc" : undefined })}
        aria-label="정렬"
        className="ml-auto"
      >
        <ToggleGroupItem value="desc">최신순</ToggleGroupItem>
        <ToggleGroupItem value="asc">오래된순</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
