// The seed wipes the orders table. It must only ever run against a throwaway
// database: one whose name ends in _dev, _test or _e2e — or when the operator
// explicitly sets ALLOW_SEED=1 (and then it is on them).
const SAFE_SUFFIXES = ["_dev", "_test", "_e2e"];

export function databaseName(url: string): string | null {
  try {
    const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
    return name || null;
  } catch {
    return null;
  }
}

export function assertSafeToSeed(env: Record<string, string | undefined>): void {
  if (env.ALLOW_SEED === "1") return;
  const name = env.DATABASE_URL ? databaseName(env.DATABASE_URL) : null;
  if (!name || !SAFE_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    throw new Error(
      `Từ chối seed: database "${name ?? "?"}" không có đuôi ${SAFE_SUFFIXES.join("/")}. ` +
        "Seed XÓA toàn bộ đơn hàng; nếu chắc chắn, chạy lại với ALLOW_SEED=1.",
    );
  }
}
