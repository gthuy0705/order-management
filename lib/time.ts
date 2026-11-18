// Business days are Vietnam days (Asia/Ho_Chi_Minh). Vietnam has no daylight
// saving time, so a fixed offset is exact and no date library is needed.
export const VN_OFFSET_MINUTES = 7 * 60;
const VN_OFFSET_MS = VN_OFFSET_MINUTES * 60 * 1000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// A day is passed around as a "YYYY-MM-DD" string so it cannot be confused
// with an instant in time.
function parseDay(day: string): [year: number, month: number, date: number] | null {
  const match = DAY_PATTERN.exec(day);
  if (!match) return null;
  const [year, month, date] = match.slice(1).map(Number);
  // Date.UTC silently rolls over (Feb 30 → Mar 2); a round trip catches that.
  const roundTrip = new Date(Date.UTC(year, month - 1, date)).toISOString().slice(0, 10);
  return roundTrip === day ? [year, month, date] : null;
}

export function isValidDay(day: string): boolean {
  return parseDay(day) !== null;
}

function requireDay(day: string): [number, number, number] {
  const parts = parseDay(day);
  if (!parts) throw new Error(`Ngày không hợp lệ: "${day}" (định dạng YYYY-MM-DD).`);
  return parts;
}

// 00:00 Vietnam time on `day`, as a UTC instant.
export function vnDayStartUtc(day: string): Date {
  const [year, month, date] = requireDay(day);
  return new Date(Date.UTC(year, month - 1, date) - VN_OFFSET_MS);
}

export function vnToday(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const [year, month, date] = requireDay(day);
  return new Date(Date.UTC(year, month - 1, date + n)).toISOString().slice(0, 10);
}

// Inclusive count of days from `from` to `to`.
export function daysBetweenInclusive(from: string, to: string): number {
  const ms = vnDayStartUtc(to).getTime() - vnDayStartUtc(from).getTime();
  return ms / (24 * 60 * 60 * 1000) + 1;
}
