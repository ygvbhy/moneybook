"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DatabaseBackup } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKRW } from "@/lib/money";
import { BACKUP_FORMAT, BACKUP_VERSION, MAX_BACKUP_BYTES } from "@/lib/validation/backup";
import { exportBackup, restoreBackup } from "@/server/actions/backup";

const MAX_SHOWN_ROW_ERRORS = 20;

const exportedAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
});

const COLLECTION_LABELS = [
  ["categories", "카테고리"],
  ["transactions", "거래"],
  ["recurringExpenses", "고정지출"],
  ["monthlyBudgets", "월 전체 예산"],
  ["categoryBudgets", "카테고리 예산"],
] as const;

type Summary = { exportedAt: string; counts: [string, number][] };

export function BackupButton({
  withLabel = false,
  ...props
}: { withLabel?: boolean } & Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={withLabel ? "default" : "icon"}
          aria-label="백업"
          className={withLabel ? "w-full justify-start gap-3" : undefined}
          {...props}
        >
          <DatabaseBackup className="size-4" aria-hidden />
          {withLabel && <span>백업</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>백업</DialogTitle>
          <DialogDescription>
            모든 데이터를 JSON 파일로 내보내거나, 백업 파일로 되돌립니다
          </DialogDescription>
        </DialogHeader>
        {/* 다이얼로그가 닫히면 내용이 언마운트되어 파일·오류 상태가 초기화된다 */}
        <BackupBody onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BackupBody({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [exporting, startExport] = useTransition();
  const [restoring, startRestore] = useTransition();
  const [parsed, setParsed] = useState<unknown>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function download(filename: string, json: string) {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleExport() {
    startExport(async () => {
      try {
        const result = await exportBackup();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (!result.data) return;
        const { filename, json, counts } = result.data;
        download(filename, json);
        const budgets = counts.monthlyBudgets + counts.categoryBudgets;
        toast.success(
          `백업을 내보냈습니다 (카테고리 ${formatKRW(counts.categories)} · 거래 ${formatKRW(counts.transactions)} · 고정지출 ${formatKRW(counts.recurringExpenses)} · 예산 ${formatKRW(budgets)})`,
        );
        if (new Blob([json]).size > MAX_BACKUP_BYTES) {
          toast.warning("파일이 3.5MB를 넘어 앱에서 복원할 수 없습니다");
        }
      } catch {
        toast.error("백업 내보내기에 실패했습니다");
      }
    });
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setParsed(null);
    setSummary(null);
    setError(null);
    setRowErrors([]);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError("파일이 너무 큽니다 (최대 3.5MB)");
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setError("JSON 파일을 읽을 수 없습니다");
      return;
    }
    const obj = data as Record<string, unknown> | null;
    if (
      typeof obj !== "object" ||
      obj === null ||
      obj.format !== BACKUP_FORMAT ||
      obj.version !== BACKUP_VERSION
    ) {
      setError("Moneybook 백업 파일이 아닙니다");
      return;
    }
    setParsed(data);
    const exportedAt = typeof obj.exportedAt === "string" ? new Date(obj.exportedAt) : null;
    setSummary({
      exportedAt:
        exportedAt && !Number.isNaN(exportedAt.getTime())
          ? exportedAtFormatter.format(exportedAt)
          : "알 수 없음",
      counts: COLLECTION_LABELS.map(([key, label]) => {
        const value = obj[key];
        return [label, Array.isArray(value) ? value.length : 0];
      }),
    });
  }

  function onRestore() {
    startRestore(async () => {
      try {
        const result = await restoreBackup(parsed);
        if (!result.ok) {
          setConfirmOpen(false);
          setError(result.error);
          setRowErrors(result.fieldErrors?.rows ?? []);
          return;
        }
        toast.success("복원했습니다");
        setConfirmOpen(false);
        onDone();
        router.refresh();
      } catch {
        setConfirmOpen(false);
        setError("복원 요청에 실패했습니다. 파일 크기를 확인하세요");
        setRowErrors([]);
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        백업 파일에는 개인 금융 데이터가 그대로 들어 있습니다. 안전한 곳에 보관하세요.
      </p>
      <section className="space-y-2">
        <h3 className="text-sm font-medium">내보내기</h3>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={exporting}
          onClick={handleExport}
        >
          {exporting ? "내보내는 중..." : "백업 내보내기"}
        </Button>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-medium">복원</h3>
        <div className="space-y-1.5">
          <Label htmlFor="backup-file">백업 파일</Label>
          <Input
            id="backup-file"
            type="file"
            accept=".json,application/json"
            disabled={restoring}
            onChange={onFileChange}
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
        {summary && (
          <div className="space-y-3 text-sm">
            <dl className="space-y-0.5">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">내보낸 시각</dt>
                <dd>{summary.exportedAt}</dd>
              </div>
              {summary.counts.map(([label, count]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{formatKRW(count)}건</dd>
                </div>
              ))}
            </dl>
            <p className="text-destructive">
              현재 데이터가 모두 지워지고 이 백업으로 바뀝니다. 지난 고정지출은 다음에 화면을 열 때
              자동 등록됩니다
            </p>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={restoring}
              onClick={() => setConfirmOpen(true)}
            >
              복원…
            </Button>
          </div>
        )}
      </section>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>현재 데이터를 모두 바꿀까요?</AlertDialogTitle>
            <AlertDialogDescription>
              지금 저장된 모든 데이터가 삭제되고 백업 파일의 내용으로 바뀝니다. 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={restoring}
              onClick={(e) => {
                e.preventDefault();
                onRestore();
              }}
            >
              {restoring ? "복원 중..." : "복원"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
