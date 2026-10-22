"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDownIcon, FileUpIcon, FileSpreadsheetIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_IMPORT_BYTES, TRANSACTION_CSV_HEADERS } from "@/lib/transaction-csv";
import { exportTransactionsCsv, importTransactionsCsv } from "@/server/actions/transactions";

const MAX_SHOWN_ROW_ERRORS = 20;

export function TransactionCsvMenu() {
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, startExport] = useTransition();

  function download(filename: string, csv: string) {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleExport(scope: "filtered" | "all") {
    startExport(async () => {
      const input =
        scope === "filtered"
          ? {
              scope,
              params: Object.fromEntries(new URLSearchParams(window.location.search)),
            }
          : { scope };
      const result = await exportTransactionsCsv(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!result.data || result.data.count === 0) {
        toast.info("내보낼 거래가 없습니다");
        return;
      }
      download(result.data.filename, result.data.csv);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={exporting}>
            <FileSpreadsheetIcon aria-hidden />
            CSV
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => handleExport("filtered")}>
            <FileDownIcon aria-hidden />
            현재 목록 내보내기
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleExport("all")}>
            <FileDownIcon aria-hidden />
            전체 내보내기
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setImportOpen(true)}>
            <FileUpIcon aria-hidden />
            CSV 가져오기…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>CSV 가져오기</DialogTitle>
            <DialogDescription>
              내보낸 파일과 같은 형식의 CSV를 거래로 등록합니다
            </DialogDescription>
          </DialogHeader>
          {/* 다이얼로그가 닫히면 내용이 언마운트되어 파일·오류 상태가 초기화된다 */}
          <ImportForm onDone={() => setImportOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setRowErrors([]);
    if (file.size > MAX_IMPORT_BYTES) {
      setError("파일이 너무 큽니다 (최대 800KB)");
      return;
    }
    startTransition(async () => {
      try {
        const text = await file.text();
        const result = await importTransactionsCsv(text);
        if (!result.ok) {
          setError(result.error);
          setRowErrors(result.fieldErrors?.rows ?? []);
          return;
        }
        toast.success(`${result.data?.count ?? 0}건을 가져왔습니다`);
        onDone();
        router.refresh();
      } catch {
        setError("가져오기 요청에 실패했습니다. 파일 크기를 줄여 다시 시도하세요");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>첫 줄 헤더: {TRANSACTION_CSV_HEADERS.join(", ")}</p>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>날짜는 YYYY-MM-DD, 유형은 수입/지출로 입력합니다</li>
          <li>카테고리는 이름이 같아야 하며, 보관된 카테고리는 복원한 뒤 가져오세요</li>
          <li>엑셀에서는 &quot;CSV UTF-8&quot;로 저장하세요</li>
          <li>같은 파일을 다시 가져오면 중복 등록됩니다</li>
        </ul>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="csv-file">CSV 파일</Label>
        <Input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {error && (
        <div
          role="alert"
          className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 p-2 text-sm text-destructive"
        >
          <p>{error}</p>
          {rowErrors.slice(0, MAX_SHOWN_ROW_ERRORS).map((message, i) => (
            <p key={i}>{message}</p>
          ))}
          {rowErrors.length > MAX_SHOWN_ROW_ERRORS && (
            <p>외 {rowErrors.length - MAX_SHOWN_ROW_ERRORS}건</p>
          )}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={!file || pending}>
        {pending ? "가져오는 중..." : "가져오기"}
      </Button>
    </form>
  );
}
