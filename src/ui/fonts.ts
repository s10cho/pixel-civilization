import galmuri11BoldUrl from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import galmuri11Url from 'galmuri/dist/Galmuri11.woff2?url';

/** Pixel font with Hangul coverage (Galmuri by Lee Minseo, SIL OFL 1.1). */
export const UI_FONT_FAMILY = 'Galmuri11';

/**
 * Loads the UI font before the game starts so the DOM UI and Phaser canvas text both use it from
 * the first frame. On failure the CSS fallback stack is used instead.
 */
export async function loadUiFonts(): Promise<void> {
  const faces = [
    new FontFace(UI_FONT_FAMILY, `url(${galmuri11Url})`, { weight: '400' }),
    new FontFace(UI_FONT_FAMILY, `url(${galmuri11BoldUrl})`, { weight: '700' }),
  ];
  try {
    for (const face of await Promise.all(faces.map((f) => f.load()))) document.fonts.add(face);
  } catch (error) {
    console.warn('UI font failed to load; falling back to the default font.', error);
  }
}
