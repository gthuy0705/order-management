import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: "DATABASE_URL chưa được đặt (xem .env.example)." })
    .regex(/^postgres(ql)?:\/\/.+/, "DATABASE_URL phải là URL PostgreSQL (postgresql://…)."),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

// Called from instrumentation.ts when the server boots: a missing or malformed
// variable stops the server immediately with a clear message, instead of
// failing on the first request that touches the database.
export function validateEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Biến môi trường không hợp lệ:\n${problems.join("\n")}`);
  }
  return result.data;
}
