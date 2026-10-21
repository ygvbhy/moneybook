"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { logout } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActivePath } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

// 접힌 상태에서만 오른쪽 Tooltip을 붙인다.
function CollapsedTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactElement;
}) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ defaultCollapsed = false }: { defaultCollapsed?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar_collapsed=${next ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <TooltipProvider>
      <aside
        data-collapsed={collapsed}
        className={cn(
          "peer fixed inset-y-0 left-0 hidden flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 motion-reduce:transition-none md:flex",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div
          className={cn(
            "flex items-center py-6",
            collapsed ? "justify-center px-3" : "justify-between px-5",
          )}
        >
          {!collapsed && (
            <Link
              href="/"
              className="whitespace-nowrap rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Moneybook
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-expanded={!collapsed}
            onClick={toggle}
          >
            <ToggleIcon className="size-4" aria-hidden />
          </Button>
        </div>
        <nav aria-label="주 메뉴" className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <CollapsedTooltip key={href} collapsed={collapsed} label={label}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {collapsed ? <span className="sr-only">{label}</span> : label}
                </Link>
              </CollapsedTooltip>
            );
          })}
        </nav>
        <div className={cn("flex flex-col gap-1 border-t p-3", collapsed && "items-center")}>
          {collapsed ? (
            <CollapsedTooltip collapsed label="테마 전환">
              <ThemeToggle />
            </CollapsedTooltip>
          ) : (
            <ThemeToggle withLabel />
          )}
          <form action={logout}>
            {collapsed ? (
              <CollapsedTooltip collapsed label="로그아웃">
                <Button type="submit" variant="ghost" size="icon" aria-label="로그아웃">
                  <LogOut className="size-4" aria-hidden />
                </Button>
              </CollapsedTooltip>
            ) : (
              <Button type="submit" variant="ghost" className="w-full justify-start gap-3">
                <LogOut className="size-4" aria-hidden />
                로그아웃
              </Button>
            )}
          </form>
        </div>
      </aside>
    </TooltipProvider>
  );
}
