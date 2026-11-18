import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirect";
import { sessionTokenFrom } from "@/lib/auth/request";
import { SESSION_COOKIE } from "@/lib/auth/sessions";

describe("hashPassword / verifyPassword", () => {
  it("đúng mật khẩu → true, sai → false", async () => {
    const stored = await hashPassword("mật-khẩu-đúng");
    expect(await verifyPassword("mật-khẩu-đúng", stored)).toBe(true);
    expect(await verifyPassword("mật-khẩu-sai", stored)).toBe(false);
  });

  it("cùng mật khẩu cho ra hash khác nhau (có salt), không chứa mật khẩu gốc", async () => {
    const a = await hashPassword("secret123");
    const b = await hashPassword("secret123");
    expect(a).not.toBe(b);
    expect(a).not.toContain("secret123");
    expect(a.startsWith("scrypt$")).toBe(true);
  });

  it("chuẩn hóa Unicode: 'ệ' gõ dựng sẵn hay tổ hợp đều khớp", async () => {
    const stored = await hashPassword("Việt".normalize("NFC"));
    expect(await verifyPassword("Việt".normalize("NFD"), stored)).toBe(true);
  });

  it("hash hỏng hoặc sai định dạng → false, không ném lỗi", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each(["/orders", "/orders/abc?x=1", "/reports/revenue"])("giữ đường dẫn nội bộ %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([null, "", "https://evil.com", "//evil.com", "/\\evil.com", "orders", "/login", "/login?next=/x"])(
    "chặn %j → /orders",
    (value) => {
      expect(safeNextPath(value)).toBe("/orders");
    },
  );
});

describe("sessionTokenFrom", () => {
  it("ưu tiên Authorization: Bearer", () => {
    const req = new Request("http://x", {
      headers: { authorization: "Bearer abc", cookie: `${SESSION_COOKIE}=def` },
    });
    expect(sessionTokenFrom(req)).toBe("abc");
  });

  it("đọc từ cookie khi không có Bearer", () => {
    const req = new Request("http://x", { headers: { cookie: `a=1; ${SESSION_COOKIE}=def; b=2` } });
    expect(sessionTokenFrom(req)).toBe("def");
  });

  it("không có gì → null", () => {
    expect(sessionTokenFrom(new Request("http://x"))).toBeNull();
    expect(sessionTokenFrom(new Request("http://x", { headers: { authorization: "Bearer " } }))).toBeNull();
  });
});
