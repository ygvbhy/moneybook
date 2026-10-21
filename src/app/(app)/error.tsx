"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    console.error(error);
  }, [error]);
  // 서버 컴포넌트 오류는 reset()만으로는 다시 조회하지 않으므로 refresh와 함께 호출한다
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
      <p className="text-base font-medium">데이터를 불러오지 못했습니다</p>
      <Button type="button" variant="outline" onClick={retry} disabled={pending}>
        다시 시도
      </Button>
    </div>
  );
}
