import { requireSession } from "@/lib/auth/dal";
import { isValidDateString, monthOf, normalizeMonthParam, todayInSeoul } from "@/lib/date";
import { getDailyTotals, listTransactionsByDate } from "@/server/calendar";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader } from "@/components/app-shell/page-header";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { DayPanel } from "@/components/calendar/day-panel";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  await requireSession();
  const sp = await searchParams;
  const today = todayInSeoul();
  const month = normalizeMonthParam(typeof sp.month === "string" ? sp.month : undefined, today);
  const dateParam = typeof sp.date === "string" ? sp.date : undefined;
  const date =
    isValidDateString(dateParam) && monthOf(dateParam) === month ? dateParam : null;

  const [totals, transactions] = await Promise.all([
    getDailyTotals(month),
    date ? listTransactionsByDate(date) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="캘린더">
        <MonthSwitcher month={month} basePath="/calendar" searchParams={sp} />
      </PageHeader>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
        <CalendarGrid month={month} selectedDate={date} today={today} totals={totals} />
        <DayPanel date={date} transactions={transactions} />
      </div>
    </>
  );
}
