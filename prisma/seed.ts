import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionType } from "../src/generated/prisma/client";

const expense = [
  "주거비",
  "식비",
  "생활용품",
  "교통",
  "구독",
  "게임/취미",
  "쇼핑",
  "의료/건강",
  "기타",
];
const income = ["급여", "부수입", "기타 수입"];

const categories = [
  ...expense.map((name, sortOrder) => ({ name, type: TransactionType.EXPENSE, sortOrder })),
  ...income.map((name, sortOrder) => ({ name, type: TransactionType.INCOME, sortOrder })),
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    for (const c of categories) {
      await prisma.category.upsert({
        where: { type_name: { type: c.type, name: c.name } },
        update: { sortOrder: c.sortOrder },
        create: c,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
