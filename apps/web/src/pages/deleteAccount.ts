import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { clearAuthState, getAuthState } from '../state/auth';
import '../styles/phase9.css';

// The one deliberate native `confirm()` dialog in the app (see docs/features.md),
// kept isolated on this page so Playwright's dialog-handling can be practiced
// without a stray confirm() blocking an unrelated test elsewhere.
// There's no `DELETE /api/users/:id` endpoint (see docs/features.md's
// "Out of scope" — no production auth hardening) — this only clears local
// session state, it doesn't touch the backend.
export function renderDeleteAccountPage(container: HTMLElement): void {
  const auth = getAuthState();
  if (!auth) {
    navigate('/login');
    return;
  }

  const page = document.createElement('div');
  page.className = 'delete-account-page';
  page.setAttribute('data-testid', 'delete-account-page');
  container.appendChild(page);

  const heading = document.createElement('h1');
  heading.textContent = 'Delete account';
  page.appendChild(heading);

  const warning = document.createElement('p');
  warning.textContent = `This will sign out ${auth.user.name} and clear the local session. This action cannot be undone.`;
  page.appendChild(warning);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn--primary';
  deleteBtn.textContent = 'Delete my account';
  deleteBtn.setAttribute('data-testid', 'delete-account-button');
  deleteBtn.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This cannot be undone.',
    );
    if (!confirmed) return;
    clearAuthState();
    showToast('Account deleted.', 'success');
    navigate('/login');
  });
  page.appendChild(deleteBtn);
}
