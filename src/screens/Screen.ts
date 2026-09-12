/** A top-level view (menu, city) that owns its DOM and WebGL resources while shown. */
export interface Screen {
  mount(): void;
  unmount(): void;
  /** Rebuilds the screen's DOM UI, e.g. after the language changed. */
  rebuildUI?(): void;
}
