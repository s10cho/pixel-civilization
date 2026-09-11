import { button, el, type ButtonVariant } from './dom';
import { icon, type IconName } from './icons';

export interface ModalAction {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  onClick?(): void;
  /** Keep the dialog open after the action runs. */
  keepOpen?: boolean;
}

export interface ModalOptions {
  title: string;
  icon?: IconName;
  body: HTMLElement | string;
  actions?: readonly ModalAction[];
  /** Whether Escape, the backdrop and the close button dismiss it (default true). */
  dismissible?: boolean;
  onClose?(): void;
}

let openCount = 0;

/** A centred card dialog over a dimmed backdrop. */
export class Modal {
  readonly element = el('div', 'modal-backdrop');
  private closed = false;

  constructor(
    root: HTMLElement,
    private readonly options: ModalOptions,
  ) {
    const dismissible = options.dismissible ?? true;
    const dialog = el('div', 'modal panel');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const titleId = `modal-title-${++openCount}`;
    dialog.setAttribute('aria-labelledby', titleId);

    const header = el('div', 'modal-header');
    if (options.icon) header.append(icon(options.icon, 'modal-icon'));
    const title = el('h2', 'modal-title', options.title);
    title.id = titleId;
    header.append(title);
    if (dismissible) {
      header.append(button({ icon: 'close', ariaLabel: 'Close', className: 'btn-icon', onClick: () => this.close() }));
    }

    const body = el('div', 'modal-body');
    if (typeof options.body === 'string') body.textContent = options.body;
    else body.append(options.body);
    dialog.append(header, body);

    if (options.actions?.length) {
      const actions = el('div', 'modal-actions');
      for (const action of options.actions) {
        actions.append(
          button({
            label: action.label,
            icon: action.icon,
            variant: action.variant,
            onClick: () => {
              action.onClick?.();
              if (!action.keepOpen) this.close();
            },
          }),
        );
      }
      dialog.append(actions);
    }

    this.element.append(dialog);
    if (dismissible) {
      this.element.addEventListener('pointerdown', (event) => {
        if (event.target === this.element) this.close();
      });
      window.addEventListener('keydown', this.onKeyDown);
    }
    root.append(this.element);
    // Focus the primary action (or the first button) for keyboard players.
    (dialog.querySelector<HTMLButtonElement>('.modal-actions .btn-primary') ?? dialog.querySelector('button'))?.focus();
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.element.remove();
    this.options.onClose?.();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this.close();
  };
}
