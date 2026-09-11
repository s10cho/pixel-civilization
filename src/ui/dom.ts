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

export function button(label: string, onClick: () => void, className?: string): HTMLButtonElement {
  const node = el('button', className ? `ui-button ${className}` : 'ui-button', label);
  node.type = 'button';
  node.addEventListener('click', onClick);
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
