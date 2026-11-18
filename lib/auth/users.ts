import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";

export type SessionUser = { id: string; username: string; name: string };

export const credentialsSchema = z.object({
  username: z.string({ error: "Tên đăng nhập là bắt buộc." }).trim().min(1, "Tên đăng nhập là bắt buộc."),
  password: z.string({ error: "Mật khẩu là bắt buộc." }).min(1, "Mật khẩu là bắt buộc."),
});

const newUserSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-z0-9._-]{3,50}$/, "Tên đăng nhập 3–50 ký tự: chữ thường, số, . _ -"),
  name: z.string().trim().min(1, "Tên hiển thị là bắt buộc.").max(100),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự."),
});

// Creates the user, or resets the name and password of an existing one, so
// the seed and the create-user script can be re-run safely.
export async function upsertUser(input: unknown): Promise<SessionUser> {
  const { username, name, password } = newUserSchema.parse(input);
  const passwordHash = await hashPassword(password);
  return prisma.user.upsert({
    where: { username },
    create: { username, name, passwordHash },
    update: { name, passwordHash },
    select: { id: true, username: true, name: true },
  });
}

// Hashed once at startup; used when the username does not exist so a failed
// login takes the same time either way (no username enumeration by timing).
const dummyHash = hashPassword("timing-equaliser");

// Returns null for any wrong username/password combination, without saying
// which part was wrong.
export async function authenticate(input: unknown): Promise<SessionUser | null> {
  const { username, password } = credentialsSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { username } });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) return null;
  return { id: user.id, username: user.username, name: user.name };
}
