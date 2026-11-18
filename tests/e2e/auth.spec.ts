import { expect, test } from "@playwright/test";
import { E2E_USER, login } from "./helpers";

// These tests start logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test("chưa đăng nhập → chuyển sang /login, đăng nhập xong quay lại đúng trang", async ({ page }) => {
  await page.goto("/reports/revenue");
  await expect(page).toHaveURL(/\/login\?next=%2Freports%2Frevenue$/);

  await login(page, E2E_USER.username, E2E_USER.password);
  await expect(page).toHaveURL(/\/reports\/revenue$/);
  await expect(page.getByText(E2E_USER.name)).toBeVisible();
});

test("sai mật khẩu → báo lỗi, giữ tên đăng nhập", async ({ page }) => {
  await page.goto("/login");
  await login(page, E2E_USER.username, "sai-mat-khau");

  // p.alert: Next.js also renders an empty role="alert" route announcer.
  await expect(page.locator("p.alert")).toHaveText("Sai tên đăng nhập hoặc mật khẩu.");
  await expect(page.getByLabel("Tên đăng nhập")).toHaveValue(E2E_USER.username);
  await expect(page).toHaveURL(/\/login/);
});

test("đăng xuất → phiên bị thu hồi, không vào lại được", async ({ page }) => {
  await page.goto("/login");
  await login(page, E2E_USER.username, E2E_USER.password);
  await expect(page).toHaveURL(/\/orders$/);

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login/);
});

test("API không có phiên → 401", async ({ request }) => {
  const res = await request.get("/api/orders");
  expect(res.status()).toBe(401);
  expect((await request.get("/api/health")).status()).toBe(200);
});
