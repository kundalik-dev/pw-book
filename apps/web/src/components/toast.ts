export type ToastType = 'success' | 'error';

const TOAST_DURATION_MS = 4000;

let host: HTMLElement | null = null;

export function mountToastHost(target: HTMLElement): void {
  host = document.createElement('div');
  host.className = 'toast-host';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  target.appendChild(host);
}

export function showToast(message: string, type: ToastType = 'success'): void {
  if (!host) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('data-testid', 'toast');

  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = type === 'success' ? '🎉' : '⚠️';
  toast.appendChild(icon);

  const text = document.createElement('span');
  text.className = 'toast__message';
  text.textContent = message;
  toast.appendChild(text);

  host.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('toast--leaving');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, TOAST_DURATION_MS);
}
