import { startTransition } from "react";
import { toast } from "sonner";
import type { BackupTransaction } from "@/lib/validation/backup";
import { undoDeleteTransactions } from "@/server/actions/transactions";

/** 삭제 완료 토스트를 띄우고, 삭제된 거래가 있으면 10초간 "되돌리기" 버튼을 함께 보여준다. */
export function toastDeleted({
  message,
  deleted,
  refresh,
}: {
  message: string;
  deleted: BackupTransaction[] | undefined;
  refresh: () => void;
}) {
  if (!deleted || deleted.length === 0) {
    toast.success(message);
    return;
  }
  toast.success(message, {
    duration: 10_000,
    action: {
      label: "되돌리기",
      onClick: () => {
        startTransition(async () => {
          try {
            const result = await undoDeleteTransactions(deleted);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            const count = result.data?.count ?? 0;
            if (count === 0) {
              toast.info("이미 되돌린 거래입니다");
              return;
            }
            toast.success(
              deleted.length === 1
                ? "되돌렸습니다"
                : `${count}건을 되돌렸습니다`,
            );
            refresh();
          } catch {
            toast.error("되돌리지 못했습니다");
          }
        });
      },
    },
  });
}
