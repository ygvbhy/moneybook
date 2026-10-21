import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

export default function setup() {
  dotenv.config({ quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");

  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DIRECT_DATABASE_URL: url },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${result.stdout}\n${result.stderr}`);
  }
}
