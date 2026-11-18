// Display helpers. Kept free of Prisma so they can run in client components.

// Formats a decimal string like "3500.50" as "3.500,50 ₫" by string
// manipulation, so large amounts never lose precision in a JS number.
export function formatMoney(value: string): string {
  const [integer, fraction = ""] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = fraction.padEnd(2, "0").slice(0, 2);
  return cents === "00" ? `${grouped} ₫` : `${grouped},${cents} ₫`;
}

const vnDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "DD/MM/YYYY HH:mm" in Vietnam time. Built from parts so the output does not
// depend on the locale data shipped with the runtime.
export function formatVnDateTime(iso: string): string {
  const parts = Object.fromEntries(
    vnDateTime.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}
