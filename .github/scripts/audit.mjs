// Fails when `npm audit` reports a high or critical advisory that is not in
// .github/audit-allowlist.txt. Plain `npm audit --audit-level=high` cannot
// accept a single known advisory without ignoring everything else.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowed = new Set(
  readFileSync(".github/audit-allowlist.txt", "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")),
);

let raw;
try {
  raw = execSync("npm audit --json", { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
} catch (error) {
  // npm audit exits non-zero whenever it finds anything; the JSON is still on stdout.
  raw = error.stdout;
}

const report = JSON.parse(raw);
const blocking = new Map();
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via === "string") continue; // points at another package's entry
    if (via.severity !== "high" && via.severity !== "critical") continue;
    const id = via.url.split("/").pop();
    if (!allowed.has(id)) blocking.set(id, `${via.severity} ${via.name}: ${via.title} (${via.url})`);
  }
}

if (blocking.size > 0) {
  console.error("Advisory high/critical chưa được chấp nhận:");
  for (const line of blocking.values()) console.error(`- ${line}`);
  process.exit(1);
}
console.log(`npm audit: không có advisory high/critical mới (đã chấp nhận: ${[...allowed].join(", ") || "không"}).`);
