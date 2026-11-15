// Date helpers. Month keys look like "2026-11"; day keys like "2026-11-14".
// All keys use the local time zone of the browser.

const pad = (n) => String(n).padStart(2, "0");

export function dayKey(date) {
  const d = new Date(date);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function monthKey(date) {
  const d = new Date(date);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}

export function currentMonthKey() {
  return monthKey(new Date());
}

export function addMonths(key, delta) {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year, month - 1 + delta, 1));
}

export function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function monthName(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long" });
}

/** "Nov 14" */
export function formatDay(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Nov 14, 2026" */
export function formatDayYear(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Saturday, November 14, 2026" */
export function formatLongDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Start of a local day from a "YYYY-MM-DD" string. */
export function startOfDay(dayText) {
  const [y, m, d] = dayText.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** End of a local day from a "YYYY-MM-DD" string. */
export function endOfDay(dayText) {
  const [y, m, d] = dayText.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
