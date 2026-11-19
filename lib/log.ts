// Structured logs: one JSON object per line on stdout/stderr, which any log
// collector (Docker, journald, Loki, CloudWatch…) can parse without config.
type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function serialiseError(error: unknown): Fields {
  if (error instanceof Error) {
    const digest = "digest" in error ? (error as { digest?: unknown }).digest : undefined;
    return { name: error.name, message: error.message, stack: error.stack, digest };
  }
  return { value: String(error) };
}

function write(level: Level, msg: string, fields: Fields = {}): void {
  const { error, ...rest } = fields;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg,
    ...rest,
    ...(error !== undefined && { error: serialiseError(error) }),
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};

export const REQUEST_ID_HEADER = "x-request-id";

// Accept an upstream id (load balancer, client) only if it is short and plain,
// so it cannot inject fake lines or huge strings into the logs.
export function isSafeRequestId(value: string | null): value is string {
  return value !== null && /^[A-Za-z0-9._:-]{1,100}$/.test(value);
}
