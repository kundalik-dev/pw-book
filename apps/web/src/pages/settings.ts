import { apiClient } from '../api/client';
import { openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { clearAuthState, getAuthState } from '../state/auth';
import { clearWishlist } from '../state/wishlist';
import '../styles/phase9.css';

const CONFIRM_TEXT = 'DELETE';

// Deliberately a custom modal + typed-confirmation input rather than a
// native confirm() — the app's one deliberate native dialog is isolated to
// /account/delete (see deleteAccount.ts) so it doesn't interfere with
// Playwright dialog-handling practice elsewhere.
export function renderSettingsPage(container: HTMLElement): void {
  const auth = getAuthState();
  if (auth?.user.role !== 'admin') {
    showToast('Admin access required.', 'error');
    navigate('/books');
    return;
  }

  const page = document.createElement('div');
  page.className = 'settings-page';
  page.setAttribute('data-testid', 'settings-page');
  container.appendChild(page);

  const heading = document.createElement('h1');
  heading.textContent = 'Settings';
  page.appendChild(heading);

  const dangerZone = document.createElement('section');
  dangerZone.className = 'danger-zone';
  dangerZone.setAttribute('data-testid', 'danger-zone');
  page.appendChild(dangerZone);

  const dangerHeading = document.createElement('h2');
  dangerHeading.textContent = 'Danger zone';
  dangerZone.appendChild(dangerHeading);

  const dangerDescription = document.createElement('p');
  dangerDescription.textContent =
    'Reset the entire application back to its default seed state: all books, ' +
    'authors, categories, users, loans, and reviews are wiped and replaced ' +
    'with the original seed data, and any uploaded cover images are removed.';
  dangerZone.appendChild(dangerDescription);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn btn--danger';
  resetBtn.textContent = 'Reset application';
  resetBtn.setAttribute('data-testid', 'reset-app-button');
  resetBtn.addEventListener('click', openResetModal);
  dangerZone.appendChild(resetBtn);

  function openResetModal(): void {
    const content = document.createElement('div');
    content.className = 'reset-modal-content';

    const warning = document.createElement('p');
    warning.className = 'modal__message';
    warning.textContent =
      'This cannot be undone. All data will be replaced with the default seed ' +
      `data and you'll be signed out. Type ${CONFIRM_TEXT} to confirm.`;
    content.appendChild(warning);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'reset-modal-content__input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = CONFIRM_TEXT;
    input.setAttribute('data-testid', 'reset-confirm-input');
    input.setAttribute('aria-label', `Type ${CONFIRM_TEXT} to confirm`);
    content.appendChild(input);

    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    content.appendChild(footer);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('data-testid', 'reset-app-modal-cancel');
    footer.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn--danger';
    confirmBtn.textContent = 'Reset everything';
    confirmBtn.disabled = true;
    confirmBtn.setAttribute('data-testid', 'reset-app-modal-confirm');
    footer.appendChild(confirmBtn);

    const modal = openModal({
      title: 'Reset application?',
      testId: 'reset-app-modal',
      content,
      closeOnBackdrop: false,
    });

    cancelBtn.addEventListener('click', () => modal.close());
    confirmBtn.addEventListener('click', () => {
      if (input.value !== CONFIRM_TEXT) return;
      modal.close();
      void performReset();
    });
    input.addEventListener('input', () => {
      confirmBtn.disabled = input.value !== CONFIRM_TEXT;
    });
    input.focus();
  }

  async function performReset(): Promise<void> {
    resetBtn.disabled = true;
    try {
      await apiClient.resetSystem();
      clearWishlist();
      clearAuthState();
      showToast('Application reset to default state. Please log in again.', 'success');
      navigate('/login');
    } catch {
      showToast('Could not reset the application.', 'error');
      resetBtn.disabled = false;
    }
  }
}
