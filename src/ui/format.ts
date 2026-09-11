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

/** Compact duration, e.g. "45s", "12m", "2h 14m". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
}

/** How long ago an epoch-milliseconds time was, e.g. "just now", "5m ago", "2d ago". */
export function formatAgo(epochMs: number, now: number = Date.now()): string {
  const seconds = Math.max(0, (now - epochMs) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 86_400) return `${formatDuration(seconds).split(' ')[0]} ago`;
  const days = Math.floor(seconds / 86_400);
  return `${days}d ago`;
}
