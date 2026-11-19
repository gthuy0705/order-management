import { expect, type Page } from "@playwright/test";

export type OrderFields = {
  customerName: string;
  productName: string;
  quantity: string;
  unitPrice: string;
};

export async function fillOrderForm(page: Page, fields: OrderFields) {
  await page.getByLabel("Khách hàng").fill(fields.customerName);
  await page.getByLabel("Mặt hàng").fill(fields.productName);
  await page.getByLabel("Số lượng").fill(fields.quantity);
  await page.getByLabel("Đơn giá (₫)").fill(fields.unitPrice);
}

// Creates an order through the UI and waits for the detail page.
export async function createOrderViaUi(page: Page, fields: OrderFields) {
  await page.goto("/orders/new");
  await fillOrderForm(page, fields);
  await page.getByRole("button", { name: "Tạo đơn" }).click();
  await expect(page).toHaveURL(/\/orders\/(?!new)[^/]+$/);
}
