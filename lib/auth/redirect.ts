// Where to go after login. Only same-site paths are allowed: "//evil.com" or
// "/\evil.com" are treated by browsers as other hosts (open redirect).
export function safeNextPath(value: string | null | undefined, fallback = "/orders"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (value === "/login" || value.startsWith("/login?")) return fallback;
  return value;
}
