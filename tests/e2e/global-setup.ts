import { execSync } from "node:child_process";

// playwright.config.ts has already loaded .env and checked TEST_DATABASE_URL.
export default function globalSetup() {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
