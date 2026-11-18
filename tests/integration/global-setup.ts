import { execSync } from "node:child_process";

// Runs once, in the main Vitest process, before any integration test file.
// `migrate deploy` brings the test database up to the current schema (including
// the hand-written CHECK constraints). It is idempotent and non-destructive;
// data isolation comes from the TRUNCATE before each test in setup.ts.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL phải được đặt và khác DATABASE_URL.");
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
