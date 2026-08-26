export interface ModalAction {
  label: string;
  variant?: 'primary' | 'secondary';
  testId?: string;
  onClick: () => void;
}

export interface ModalOptions {
  title: string;
  testId: string;
  content: HTMLElement;
  actions?: ModalAction[];
  closeOnBackdrop?: boolean;
}

export interface OpenModal {
  close(): void;
}

/** A generic modal dialog: backdrop + dialog box, closable via Escape, backdrop click, or an action. */
export function openModal(options: ModalOptions): OpenModal {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-testid', `${options.testId}-backdrop`);

  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${options.testId}-title`);
  dialog.setAttribute('data-testid', options.testId);
  backdrop.appendChild(dialog);

  const header = document.createElement('div');
  header.className = 'modal__header';
  dialog.appendChild(header);

  const title = document.createElement('h2');
  title.id = `${options.testId}-title`;
  title.className = 'modal__title';
  title.textContent = options.title;
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal__close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.setAttribute('data-testid', `${options.testId}-close`);
  closeBtn.textContent = '×';
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal__body';
  body.appendChild(options.content);
  dialog.appendChild(body);

  if (options.actions?.length) {
    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    for (const action of options.actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn btn--${action.variant ?? 'secondary'}`;
      btn.textContent = action.label;
      if (action.testId) btn.setAttribute('data-testid', action.testId);
      btn.addEventListener('click', action.onClick);
      footer.appendChild(btn);
    }
    dialog.appendChild(footer);
  }

  document.body.appendChild(backdrop);

  function close(): void {
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') close();
  }

  document.addEventListener('keydown', onKeydown);
  closeBtn.addEventListener('click', close);
  if (options.closeOnBackdrop !== false) {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
  }

  const firstFocusable = dialog.querySelector<HTMLElement>('button, input, textarea, select');
  firstFocusable?.focus();

  return { close };
}

export interface ConfirmModalOptions {
  title: string;
  message: string;
  testId: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

/** Convenience wrapper around `openModal` for the confirm-delete pattern. */
export function openConfirmModal(options: ConfirmModalOptions): OpenModal {
  const message = document.createElement('p');
  message.className = 'modal__message';
  message.textContent = options.message;

  let modal: OpenModal;
  modal = openModal({
    title: options.title,
    testId: options.testId,
    content: message,
    actions: [
      {
        label: 'Cancel',
        variant: 'secondary',
        testId: `${options.testId}-cancel`,
        onClick: () => modal.close(),
      },
      {
        label: options.confirmLabel ?? 'Delete',
        variant: 'primary',
        testId: `${options.testId}-confirm`,
        onClick: () => {
          modal.close();
          options.onConfirm();
        },
      },
    ],
  });
  return modal;
}
