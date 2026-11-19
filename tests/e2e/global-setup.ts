import { execSync } from "node:child_process";

// playwright.config.ts has already loaded .env and checked E2E_DATABASE_URL.
// `migrate deploy` also creates the database if it does not exist yet.
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
}
