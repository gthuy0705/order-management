import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

// Every test starts from empty tables so tests cannot depend on each other.
// TRUNCATE (not DELETE) because order_events rejects row deletes by trigger.
beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE order_events, orders`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
