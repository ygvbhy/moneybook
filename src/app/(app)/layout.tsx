import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/dal";
import { todayInSeoul } from "@/lib/date";
import {
  getMerchantSuggestions,
  getRecentCategoryIds,
  getRecentTransactionPresets,
} from "@/server/dashboard";
import { listCategories } from "@/server/categories";
import { Sidebar } from "@/components/app-shell/sidebar";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { MobileHeader } from "@/components/app-shell/mobile-header";
import { QuickAddFab } from "@/components/app-shell/quick-add-fab";
import { TransactionDialogProvider } from "@/components/transaction/transaction-dialog-provider";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireSession();
  const sidebarCollapsed = (await cookies()).get("sidebar_collapsed")?.value === "1";
  const [categories, expenseIds, incomeIds, recentPresets, merchantSuggestions] = await Promise.all([
    listCategories(),
    getRecentCategoryIds("EXPENSE"),
    getRecentCategoryIds("INCOME"),
    getRecentTransactionPresets(),
    getMerchantSuggestions(),
  ]);
  return (
    <TransactionDialogProvider
      categories={categories}
      recentCategoryIds={{ EXPENSE: expenseIds, INCOME: incomeIds }}
      recentPresets={recentPresets}
      merchantSuggestions={merchantSuggestions}
      today={todayInSeoul()}
    >
      <div className="flex min-h-full flex-1 flex-col">
        <Sidebar defaultCollapsed={sidebarCollapsed} />
        <div className="flex flex-1 flex-col transition-[padding] duration-200 motion-reduce:transition-none md:pl-56 md:peer-data-[collapsed=true]:pl-16">
        <MobileHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-36 md:px-8 md:pt-8 md:pb-24">
            {children}
          </main>
        </div>
        <BottomNav />
        <Suspense>
          <QuickAddFab />
        </Suspense>
      </div>
    </TransactionDialogProvider>
  );
}
