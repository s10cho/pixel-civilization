/** The two visual directions being compared in the 3D spike. */
export type SpikeStyle = 'lowpoly' | 'pixel';

export interface StyleConfig {
  antialias: boolean;
  /** Render at 1/pixelScale resolution and upscale with nearest-neighbour (1 = native). */
  pixelScale: number;
  /** Banded toon shading instead of smooth flat-shaded PBR. */
  toon: boolean;
  shadowMapSize: number;
  background: number;
}

export const STYLES: Record<SpikeStyle, StyleConfig> = {
  lowpoly: { antialias: true, pixelScale: 1, toon: false, shadowMapSize: 2048, background: 0xa8d8ea },
  pixel: { antialias: false, pixelScale: 3, toon: true, shadowMapSize: 512, background: 0x8fc6dc },
};
