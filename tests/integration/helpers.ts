import { createSession } from "@/lib/auth/sessions";
import { upsertUser, type SessionUser } from "@/lib/auth/users";

export const TEST_PASSWORD = "mat-khau-test";

// Tables are truncated before each test, so call this inside the test (or a
// beforeEach declared in the test file, which runs after setup.ts).
export async function createTestUser(username = "tester"): Promise<SessionUser> {
  return upsertUser({ username, name: `Người dùng ${username}`, password: TEST_PASSWORD });
}

export async function createTestToken(username = "tester"): Promise<{ user: SessionUser; token: string }> {
  const user = await createTestUser(username);
  const { token } = await createSession(user.id);
  return { user, token };
}
