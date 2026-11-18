"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { safeNextPath } from "@/lib/auth/redirect";
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/sessions";
import { authenticate } from "@/lib/auth/users";

export type LoginState = { attempt: number; error?: string; username?: string };

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = readText(formData, "username");
  const attempt = prev.attempt + 1;
  let user;
  try {
    user = await authenticate({ username, password: readText(formData, "password") });
  } catch (error) {
    if (error instanceof ZodError) return { attempt, username, error: error.issues[0].message };
    throw error;
  }
  // One message for both cases: do not reveal whether the username exists.
  if (!user) return { attempt, username, error: "Sai tên đăng nhập hoặc mật khẩu." };

  const { token, expiresAt } = await createSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  redirect(safeNextPath(readText(formData, "next")));
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  await deleteSession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
