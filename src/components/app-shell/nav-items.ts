import { CalendarDays, ChartColumn, LayoutDashboard, PiggyBank, ReceiptText, Repeat } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/transactions", label: "거래 내역", icon: ReceiptText },
  { href: "/reports", label: "연간", icon: ChartColumn },
  { href: "/recurring", label: "고정지출", icon: Repeat },
  { href: "/budgets", label: "예산", icon: PiggyBank },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
