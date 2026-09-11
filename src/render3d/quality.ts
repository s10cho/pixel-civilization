import { AUTO_QUALITY, QUALITY, type QualityLevel } from '../config/gameConfig';
import { loadPreferences } from '../storage/preferences';

const ORDER: readonly QualityLevel[] = ['high', 'medium', 'low'];

function isQualityLevel(value: string | null): value is QualityLevel {
  return value !== null && value in QUALITY;
}

/**
 * The quality to start a city with: `?quality=` (for testing), then the player's setting.
 * "Auto" starts at medium on touch devices and high elsewhere, then adapts (see
 * FrameRateMonitor).
 */
export function resolveQualityLevel(): { level: QualityLevel; auto: boolean } {
  const requested = new URLSearchParams(window.location.search).get('quality');
  if (isQualityLevel(requested)) return { level: requested, auto: false };
  const preference = loadPreferences().quality;
  if (preference !== 'auto') return { level: preference, auto: false };
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return { level: touch ? 'medium' : 'high', auto: true };
}

/** The next preset down, or null at the lowest. */
export function lowerQuality(level: QualityLevel): QualityLevel | null {
  return ORDER[ORDER.indexOf(level) + 1] ?? null;
}

/** Measures the frame rate over fixed windows of steady, visible frames. */
export class FrameRateMonitor {
  private frames = 0;
  private elapsed = 0;
  private windows = 0;

  /** Feed each frame's duration; returns the average FPS when a window completes, else null. */
  sample(frameSeconds: number): number | null {
    if (frameSeconds <= 0 || frameSeconds > AUTO_QUALITY.maxFrameGapSeconds || document.hidden) return null;
    this.frames++;
    this.elapsed += frameSeconds;
    if (this.elapsed < AUTO_QUALITY.sampleSeconds) return null;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    return ++this.windows > AUTO_QUALITY.warmupSamples ? fps : null;
  }
}
