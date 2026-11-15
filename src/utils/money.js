// All money is stored as integer millimes (1 TND = 1000 millimes).
// This file is the only place where millimes are converted to or from text.

export const MILLIMES_PER_TND = 1000;

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Splits an amount into display parts: { negative, whole: "7,847", fraction: ".350" }. */
export function splitMillimes(millimes) {
  const abs = Math.abs(Math.trunc(millimes));
  const whole = Math.floor(abs / MILLIMES_PER_TND);
  const fraction = String(abs % MILLIMES_PER_TND).padStart(3, "0");
  return {
    negative: millimes < 0,
    whole: groupThousands(String(whole)),
    fraction: "." + fraction,
  };
}

/** 7847350 -> "7,847.350". With signed: true, adds "+" or "−" in front. */
export function formatMillimes(millimes, { signed = false } = {}) {
  const { negative, whole, fraction } = splitMillimes(millimes);
  const text = whole + fraction;
  if (negative) return "− " + text;
  if (signed && millimes > 0) return "+ " + text;
  return text;
}

/** 7847350 -> "7,847.350 TND" */
export function formatTnd(millimes, options) {
  return formatMillimes(millimes, options) + " TND";
}

/**
 * Converts text typed by a user (in dinars) to integer millimes.
 * Accepts "12", "12.5", "12,5", "1,250.500". Returns null if the text is not a
 * valid non-negative amount with at most 3 decimals.
 */
export function parseTndToMillimes(input) {
  if (typeof input !== "string") return null;
  let text = input.replace(/[\s  ]/g, "").replace(/TND$/i, "");
  if (text === "") return null;
  if (text.includes(".")) {
    text = text.replace(/,/g, "");
  } else {
    text = text.replace(",", ".");
  }
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
  const [whole, decimals = ""] = text.split(".");
  return Number(whole) * MILLIMES_PER_TND + Number(decimals.padEnd(3, "0"));
}
