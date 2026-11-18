import { expect, test, type Page } from "@playwright/test";
import { createOrderViaUi, fillOrderForm } from "./helpers";

// "1.234.567,50 ₫" → 1234567.5 (test-only; the app itself never parses money).
function parseMoney(text: string): number {
  return Number(text.replace(/[^\d,]/g, "").replace(",", "."));
}

async function readRevenueTotals(page: Page) {
  await page.goto("/reports/revenue");
  const orders = page.getByTestId("total-orders");
  // No delivered orders yet → the page shows a message instead of a table.
  if ((await orders.count()) === 0) return { orders: 0, revenue: 0 };
  return {
    orders: Number(await orders.textContent()),
    revenue: parseMoney((await page.getByTestId("total-revenue").textContent()) ?? ""),
  };
}

test("tạo đơn → đánh dấu đã giao → báo cáo tăng số đơn và doanh thu", async ({ page }) => {
  const before = await readRevenueTotals(page);

  await createOrderViaUi(page, {
    customerName: "Khách E2E",
    productName: "Hàng E2E",
    quantity: "3",
    unitPrice: "125000.50",
  });
  // A NEW order opens as an edit form pre-filled with the saved values.
  await expect(page.locator(".badge")).toHaveText("Mới");
  await expect(page.getByLabel("Số lượng")).toHaveValue("3");
  await expect(page.getByLabel("Đơn giá (₫)")).toHaveValue("125000.50");

  await page.getByRole("button", { name: "Đánh dấu đã giao" }).click();
  await expect(page.locator(".badge")).toHaveText("Đã giao");
  await expect(page.getByText("Đơn đã chốt, không thể chỉnh sửa.")).toBeVisible();
  await expect(page.getByText("375.001,50 ₫")).toBeVisible();
  // A locked order offers no way to edit it.
  await expect(page.getByRole("button", { name: "Lưu thay đổi" })).toHaveCount(0);

  const after = await readRevenueTotals(page);
  expect(after.orders).toBe(before.orders + 1);
  expect(after.revenue).toBeCloseTo(before.revenue + 375001.5, 2);
});

test("form tạo đơn báo lỗi theo field và giữ nguyên dữ liệu đã nhập", async ({ page }) => {
  await page.goto("/orders/new");
  await fillOrderForm(page, {
    customerName: "Khách lỗi",
    productName: "Hàng lỗi",
    quantity: "0",
    unitPrice: "1000",
  });
  await page.getByRole("button", { name: "Tạo đơn" }).click();

  await expect(page.getByText("Số lượng phải là số nguyên lớn hơn 0.")).toBeVisible();
  await expect(page).toHaveURL(/\/orders\/new$/);
  await expect(page.getByLabel("Khách hàng")).toHaveValue("Khách lỗi");
  await expect(page.getByLabel("Số lượng")).toHaveValue("0");
});

test("hủy đơn cần xác nhận", async ({ page }) => {
  await createOrderViaUi(page, {
    customerName: "Khách hủy",
    productName: "Hàng hủy",
    quantity: "1",
    unitPrice: "1000",
  });

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Hủy đơn" }).click();
  await expect(page.locator(".badge")).toHaveText("Mới");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hủy đơn" }).click();
  await expect(page.locator(".badge")).toHaveText("Đã hủy");
});
