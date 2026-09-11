import { QUALITY, type QualityLevel, type QualityPreset } from '../config/gameConfig';

function isQualityLevel(value: string | null): value is QualityLevel {
  return value !== null && value in QUALITY;
}

/**
 * The quality preset for this session. For now it is chosen with `?quality=high|medium|low`
 * (default high); automatic selection by device performance comes with Slice 16.
 */
export function getQualityPreset(): QualityPreset {
  const requested = new URLSearchParams(window.location.search).get('quality');
  return QUALITY[isQualityLevel(requested) ? requested : 'high'];
}
