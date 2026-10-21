import { requireSession } from "@/lib/auth/dal";
import { todayInSeoul } from "@/lib/date";
import { listCategories } from "@/server/categories";
import { listRecurring, materializeRecurring } from "@/server/recurring";
import { RecurringList } from "@/components/recurring/recurring-list";

export default async function RecurringPage() {
  await requireSession();
  const today = todayInSeoul();
  await materializeRecurring(today);
  const [items, categories] = await Promise.all([listRecurring(), listCategories()]);

  return <RecurringList items={items} categories={categories} />;
}
