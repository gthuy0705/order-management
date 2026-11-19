import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createOrderViaUi, fillOrderForm } from "./helpers";

// Run with `npm run screenshots`. Seeds the test database so the pictures show
// realistic data, then captures each screen into docs/screenshots/.
const DIR = "docs/screenshots";

test.beforeAll(() => {
  execSync("npx tsx prisma/seed.ts", {
    env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL },
    stdio: "inherit",
  });
});

test("chụp ảnh màn hình", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.screenshot({ path: `${DIR}/01-danh-sach.png`, fullPage: true });

  await page.goto("/orders/new");
  await fillOrderForm(page, {
    customerName: "Công ty TNHH Minh Phát",
    productName: "Giấy A4 Double A",
    quantity: "12",
    unitPrice: "95000",
  });
  await expect(page.getByText("1.140.000 ₫")).toBeVisible();
  await page.screenshot({ path: `${DIR}/02-tao-don.png`, fullPage: true });

  await page.getByLabel("Số lượng").fill("0");
  await page.getByLabel("Đơn giá (₫)").fill("-5000");
  await page.getByRole("button", { name: "Tạo đơn" }).click();
  await expect(page.getByText("Số lượng phải là số nguyên lớn hơn 0.")).toBeVisible();
  await page.screenshot({ path: `${DIR}/03-loi-validate.png`, fullPage: true });

  await createOrderViaUi(page, {
    customerName: "Công ty TNHH Minh Phát",
    productName: "Giấy A4 Double A",
    quantity: "12",
    unitPrice: "95000",
  });
  await expect(page.getByRole("button", { name: "Đánh dấu đã giao" })).toBeVisible();
  await page.screenshot({ path: `${DIR}/04-doi-trang-thai.png`, fullPage: true });

  await page.getByRole("button", { name: "Đánh dấu đã giao" }).click();
  await expect(page.getByText("Đơn đã chốt, không thể chỉnh sửa.")).toBeVisible();
  await page.screenshot({ path: `${DIR}/05-don-da-chot.png`, fullPage: true });

  await page.goto("/reports/revenue");
  await expect(page.getByTestId("total-orders")).toBeVisible();
  await page.screenshot({ path: `${DIR}/06-bao-cao.png`, fullPage: true });
});
