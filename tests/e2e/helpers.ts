import { expect, type Page } from "@playwright/test";

// Session cookie saved by auth.setup.ts and reused by the other projects.
export const STORAGE_STATE = "playwright/.auth/user.json";

// Created (or reset) by global-setup.ts in the e2e database only.
export const E2E_USER = { username: "e2e", name: "Người dùng E2E", password: "e2e-mat-khau" };

export type OrderFields = {
  customerName: string;
  productName: string;
  quantity: string;
  unitPrice: string;
};

export async function login(page: Page, username: string, password: string) {
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

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
