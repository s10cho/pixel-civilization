import { icon, type IconName } from './icons';

/** Tiny helpers for building the DOM overlay UI without a framework. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export type ButtonVariant = 'primary' | 'success' | 'warning';

export interface ButtonOptions {
  label?: string;
  icon?: IconName;
  variant?: ButtonVariant;
  className?: string;
  /** Accessible name for icon-only buttons. */
  ariaLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
}

/** Rounded button with an optional icon. The label text lives in `.btn-label`. */
export function button(options: ButtonOptions): HTMLButtonElement {
  const classes = ['btn'];
  if (options.variant) classes.push(`btn-${options.variant}`);
  if (options.className) classes.push(options.className);

  const node = el('button', classes.join(' '));
  node.type = 'button';
  if (options.icon) node.append(icon(options.icon));
  if (options.label !== undefined) node.append(el('span', 'btn-label', options.label));
  if (options.ariaLabel) node.setAttribute('aria-label', options.ariaLabel);
  if (options.onClick) node.addEventListener('click', options.onClick);
  node.disabled = options.disabled ?? false;
  return node;
}

/** Updates text only when it changed, so per-tick UI refreshes don't touch the DOM needlessly. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Returns the overlay root declared in index.html. */
export function getUiRoot(): HTMLElement {
  const root = document.getElementById('ui');
  if (!root) throw new Error('Missing #ui overlay root in index.html');
  return root;
}
