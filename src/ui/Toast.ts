import { UI } from '../config/gameConfig';
import { el } from './dom';

/** Short-lived feedback message (e.g. why an action was rejected). */
export class Toast {
  readonly element = el('div', 'toast');
  private timer: number | undefined;

  constructor() {
    this.element.hidden = true;
    this.element.setAttribute('role', 'status');
  }

  show(text: string): void {
    this.element.textContent = text;
    this.element.hidden = false;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.element.hidden = true;
    }, UI.toastDurationMs);
  }

  dispose(): void {
    window.clearTimeout(this.timer);
  }
}
