"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, { attempt: 0 });
  // Where proxy.ts was sending the user before it redirected here.
  const next = useSearchParams().get("next") ?? "";

  return (
    <form action={formAction} className="form" key={state.attempt} noValidate>
      {state.error && (
        <p className="alert" role="alert">
          {state.error}
        </p>
      )}
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="username">Tên đăng nhập</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          defaultValue={state.username}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Mật khẩu</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </div>
    </form>
  );
}
