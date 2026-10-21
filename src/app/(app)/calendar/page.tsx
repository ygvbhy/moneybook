import { requireSession } from "@/lib/auth/dal";
import { isValidDateString, monthOf, normalizeMonthParam, todayInSeoul } from "@/lib/date";
import { upcomingIn } from "@/lib/recurring";
import { getDailyTotals, listTransactionsByDate } from "@/server/calendar";
import { listRecurring, materializeRecurring } from "@/server/recurring";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader } from "@/components/app-shell/page-header";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { DayPanel } from "@/components/calendar/day-panel";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  await requireSession();
  const today = todayInSeoul();
  await materializeRecurring(today);
  const sp = await searchParams;
  const month = normalizeMonthParam(typeof sp.month === "string" ? sp.month : undefined, today);
  const dateParam = typeof sp.date === "string" ? sp.date : undefined;
  const date =
    isValidDateString(dateParam) && monthOf(dateParam) === month ? dateParam : null;

  const [totals, transactions, recurring] = await Promise.all([
    getDailyTotals(month),
    date ? listTransactionsByDate(date) : Promise.resolve([]),
    listRecurring(),
  ]);
  const upcoming = upcomingIn(month, recurring);
  const upcomingTotals: Record<string, number> = {};
  for (const u of upcoming) upcomingTotals[u.date] = (upcomingTotals[u.date] ?? 0) + u.amount;
  const selectedUpcoming = date ? upcoming.filter((u) => u.date === date) : [];

  return (
    <>
      <PageHeader title="캘린더">
        <MonthSwitcher month={month} basePath="/calendar" searchParams={sp} />
      </PageHeader>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
        <CalendarGrid
          month={month}
          selectedDate={date}
          today={today}
          totals={totals}
          upcoming={upcomingTotals}
        />
        <DayPanel date={date} transactions={transactions} upcoming={selectedUpcoming} />
      </div>
    </>
  );
}
