import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

// Every test starts from an empty table so tests cannot depend on each other.
beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE orders`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
