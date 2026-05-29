export function addMonths(date: Date, count: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

export function monthKey(date: Date | string) {
  const value = typeof date === "string" ? new Date(`${date}T00:00:00.000Z`) : date;
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(start: string, count: number) {
  const startDate = new Date(`${start}-01T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) => monthKey(addMonths(startDate, index)));
}

export function isDateInMonth(date: string | undefined, month: string) {
  return Boolean(date && monthKey(date) === month);
}

export function monthBounds(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59));
  return { start, end };
}
