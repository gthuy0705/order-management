import { expect, test as setup } from "@playwright/test";
import { E2E_USER, login, STORAGE_STATE } from "./helpers";

// Runs before the e2e and screenshot projects; they reuse the saved cookie
// instead of logging in at the start of every test.
setup("đăng nhập", async ({ page }) => {
  await page.goto("/login");
  await login(page, E2E_USER.username, E2E_USER.password);
  await expect(page).toHaveURL(/\/orders$/);
  await page.context().storageState({ path: STORAGE_STATE });
});
