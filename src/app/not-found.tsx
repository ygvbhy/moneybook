import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-lg font-medium">페이지를 찾을 수 없습니다</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        대시보드로 이동
      </Link>
    </main>
  );
}
