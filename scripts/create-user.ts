// Creates a login, or resets the name/password of an existing one.
//
//   NEW_USER_PASSWORD='…' npm run user:create -- <username> "<Tên hiển thị>"
//
// The password comes from an environment variable rather than an argument so
// it does not show up in `ps` output.
import { ZodError } from "zod";
import { upsertUser } from "../lib/auth/users";
import { prisma } from "../lib/db";

async function main() {
  const [username, name] = process.argv.slice(2);
  const password = process.env.NEW_USER_PASSWORD;
  if (!username || !name || !password) {
    console.error('Cách dùng: NEW_USER_PASSWORD=… npm run user:create -- <username> "<Tên hiển thị>"');
    process.exitCode = 1;
    return;
  }
  try {
    const user = await upsertUser({ username, name, password });
    console.log(`Đã tạo/cập nhật người dùng "${user.username}" (${user.name}).`);
  } catch (error) {
    if (error instanceof ZodError) {
      for (const issue of error.issues) console.error(`- ${issue.path.join(".")}: ${issue.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
