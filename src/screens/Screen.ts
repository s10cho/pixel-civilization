/** A top-level view (menu, city) that owns its DOM and WebGL resources while shown. */
export interface Screen {
  mount(): void;
  unmount(): void;
}
