import { describe, expect, it } from "vitest";
import { validateEnv } from "@/lib/env";
import { isSafeRequestId } from "@/lib/log";
import { assertSafeToSeed, databaseName } from "@/prisma/seed-guard";

describe("validateEnv", () => {
  it("chấp nhận DATABASE_URL PostgreSQL", () => {
    expect(validateEnv({ DATABASE_URL: "postgresql://u:p@localhost:5432/db" })).toMatchObject({
      NODE_ENV: "development",
    });
  });

  it.each([{}, { DATABASE_URL: "" }, { DATABASE_URL: "mysql://localhost/db" }])(
    "báo lỗi rõ ràng với %j",
    (env) => {
      expect(() => validateEnv(env)).toThrow(/DATABASE_URL/);
    },
  );
});

describe("isSafeRequestId", () => {
  it.each(["abc", "3f2c6a40-6f0e-4b1a-9a53-2a1f0e4b8c11", "lb:1.2"])("chấp nhận %j", (id) => {
    expect(isSafeRequestId(id)).toBe(true);
  });

  it.each([null, "", "a b", 'x"}\n{"level":"info', "x".repeat(101)])("từ chối %j", (id) => {
    expect(isSafeRequestId(id)).toBe(false);
  });
});

describe("seed guard", () => {
  const url = (name: string) => `postgresql://postgres:postgres@localhost:5432/${name}`;

  it("đọc được tên database từ URL", () => {
    expect(databaseName(url("orders_dev"))).toBe("orders_dev");
    expect(databaseName("không phải url")).toBeNull();
  });

  it.each(["orders_dev", "orders_test", "orders_e2e"])("cho phép seed %s", (name) => {
    expect(() => assertSafeToSeed({ DATABASE_URL: url(name) })).not.toThrow();
  });

  it.each(["orders", "orders_prod", "orders_dev_backup"])("từ chối seed %s", (name) => {
    expect(() => assertSafeToSeed({ DATABASE_URL: url(name) })).toThrow(/ALLOW_SEED/);
  });

  it("ALLOW_SEED=1 là lối thoát có chủ đích", () => {
    expect(() => assertSafeToSeed({ DATABASE_URL: url("orders"), ALLOW_SEED: "1" })).not.toThrow();
  });

  it("thiếu DATABASE_URL → từ chối", () => {
    expect(() => assertSafeToSeed({})).toThrow();
  });
});
