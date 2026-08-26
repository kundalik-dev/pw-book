import { apiClient } from '../api/client';
import type { AdminUser, Loan } from '../api/types';
import { ApiError } from '../api/types';
import { type OpenModal, openModal } from './modal';
import { showToast } from './toast';

/**
 * Shared "confirm return" modal — used by both the member Orders page (return
 * your own loan) and the admin Orders pages (return any customer's loan; the
 * backend's `PUT /loans/:id/return` already allows an admin to return loans
 * it doesn't own).
 */
export function openReturnLoanModal(loan: Loan, admins: AdminUser[], onReturned: () => void): void {
  const content = document.createElement('div');
  content.className = 'return-modal-content';

  const dateLabel = document.createElement('p');
  dateLabel.className = 'return-modal-content__date';
  dateLabel.setAttribute('data-testid', 'return-modal-date');
  dateLabel.textContent = `Return date: ${new Date().toLocaleDateString()}`;
  content.appendChild(dateLabel);

  const adminLabel = document.createElement('label');
  adminLabel.textContent = 'Hand over to admin';
  const adminSelect = document.createElement('select');
  adminSelect.required = true;
  adminSelect.setAttribute('data-testid', 'return-modal-admin');
  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = admins.length ? 'Select an admin…' : 'No admins available';
  adminSelect.appendChild(placeholderOpt);
  for (const admin of admins) {
    const opt = document.createElement('option');
    opt.value = String(admin.id);
    opt.textContent = `${admin.name} (${admin.email})`;
    adminSelect.appendChild(opt);
  }
  adminLabel.appendChild(adminSelect);
  content.appendChild(adminLabel);

  const errorText = document.createElement('p');
  errorText.className = 'return-modal-content__error';
  errorText.hidden = true;
  errorText.setAttribute('data-testid', 'return-modal-error');
  content.appendChild(errorText);

  let modal: OpenModal;
  modal = openModal({
    title: 'Confirm return',
    testId: 'return-modal',
    content,
    actions: [
      {
        label: 'Cancel',
        variant: 'secondary',
        testId: 'return-modal-cancel',
        onClick: () => modal.close(),
      },
      {
        label: 'Confirm return',
        variant: 'primary',
        testId: 'return-modal-confirm',
        onClick: () => {
          void (async () => {
            errorText.hidden = true;
            const adminId = Number(adminSelect.value);
            if (!adminId) {
              errorText.textContent = 'Select which admin received the book.';
              errorText.hidden = false;
              return;
            }
            try {
              await apiClient.returnLoan(loan.id, adminId);
              modal.close();
              showToast('Book returned.', 'success');
              onReturned();
            } catch (err) {
              errorText.textContent =
                err instanceof ApiError ? err.message : 'Could not return this book.';
              errorText.hidden = false;
            }
          })();
        },
      },
    ],
  });
}
