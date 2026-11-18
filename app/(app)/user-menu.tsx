import { getCurrentUser } from "@/lib/auth/current-user";
import { logoutAction } from "@/app/login/actions";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <form action={logoutAction} className="user-menu">
      <span className="user-menu__name" title={user.username}>
        {user.name}
      </span>
      <button type="submit" className="btn btn--sm btn--secondary">
        Đăng xuất
      </button>
    </form>
  );
}
