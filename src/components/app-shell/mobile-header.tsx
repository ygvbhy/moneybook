import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

/** 모바일(<768px) 상단 바: 사이드바가 숨겨지므로 테마 전환·로그아웃을 여기서 제공한다 */
export function MobileHeader() {
  return (
    <header className="flex items-center justify-between border-b px-4 py-2 md:hidden">
      <Link
        href="/"
        className="rounded-md text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Moneybook
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <form action={logout}>
          <Button type="submit" variant="ghost" size="icon" aria-label="로그아웃">
            <LogOut className="size-4" aria-hidden />
          </Button>
        </form>
      </div>
    </header>
  );
}
