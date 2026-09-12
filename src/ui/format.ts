import { t } from '../i18n';

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

/** Duration in the player's language, e.g. "2h 14m" / "2시간 14분". `coarse` drops the minutes. */
export function formatDuration(seconds: number, options: { coarse?: boolean } = {}): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return t('time.seconds', { n: total });
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return t('time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0 || options.coarse) return t('time.hours', { n: hours });
  return t('time.hoursMinutes', { h: hours, m: rest });
}

/** How long ago an epoch-milliseconds time was, e.g. "5m ago" / "5분 전". */
export function formatAgo(epochMs: number, now: number = Date.now()): string {
  const seconds = Math.max(0, (now - epochMs) / 1000);
  if (seconds < 60) return t('time.justNow');
  const duration =
    seconds < 86_400 ? formatDuration(seconds, { coarse: true }) : t('time.days', { n: Math.floor(seconds / 86_400) });
  return t('time.ago', { duration });
}
