const SUFFIXES = ['', 'K', 'M', 'B', 'T'];

/** Whole-number display with K/M/B/T suffixes for large values (e.g. 1234 -> "1.2K"). */
export function formatAmount(value: number): string {
  let scaled = Math.floor(value);
  let tier = 0;
  while (Math.abs(scaled) >= 1000 && tier < SUFFIXES.length - 1) {
    scaled /= 1000;
    tier++;
  }
  if (tier === 0) return String(scaled);
  return `${(Math.floor(scaled * 10) / 10).toFixed(1)}${SUFFIXES[tier]}`;
}

/** Per-second rates keep one decimal while small (e.g. 1.5), then use formatAmount. */
export function formatRate(value: number): string {
  if (value >= 100) return formatAmount(value);
  return String(Math.round(value * 10) / 10);
}
