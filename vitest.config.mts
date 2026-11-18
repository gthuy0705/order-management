import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest does not load .env into process.env. Node's built-in loader keeps
// variables that are already set (e.g. in CI), so the file is only a fallback.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
const env = process.env;

// Integration tests wipe tables, so they must never point at the dev database.
function integrationDatabaseUrl(): string {
  const url = env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Thiếu TEST_DATABASE_URL (xem .env.example).");
  }
  if (url === env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL không được trùng DATABASE_URL.");
  }
  return url;
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // All files share one test database; running them in parallel would
          // let one file's TRUNCATE wipe another file's data mid-test.
          fileParallelism: false,
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          env: { DATABASE_URL: integrationDatabaseUrl() },
        },
      },
    ],
  },
});
