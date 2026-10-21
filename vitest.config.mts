import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({ quiet: true });

const root = path.dirname(fileURLToPath(import.meta.url));

const alias = {
  "@": path.resolve(root, "src"),
  "server-only": path.resolve(root, "tests/stubs/server-only.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          fileParallelism: false,
          // 통합 테스트는 반드시 테스트 DB를 쓴다 (개발 DB TRUNCATE 방지)
          env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
          globalSetup: ["tests/setup/global-setup.ts"],
          setupFiles: ["tests/setup/mocks.ts"],
        },
      },
    ],
  },
});
