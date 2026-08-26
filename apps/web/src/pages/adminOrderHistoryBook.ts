import { apiClient } from '../api/client';
import type { AdminUser, AppUser, Loan } from '../api/types';
import { openReturnLoanModal } from '../components/returnLoanModal';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import '../styles/phase9.css';

type SortKey = 'customer' | 'borrowedAt';
type SortDir = 1 | -1;

/** Admin-only: one book's full order history — who ordered it, and their return status/date. */
export function renderAdminOrderHistoryBookPage(
  container: HTMLElement,
  params: Record<string, string>,
): () => void {
  const auth = getAuthState();
  if (auth?.user.role !== 'admin') {
    showToast('Admin access required.', 'error');
    navigate('/books');
    return () => {};
  }

  container.classList.add('page-container--wide');

  const bookId = Number(params.id);
  let loans: Loan[] = [];
  let customerNames = new Map<number, string>();
  let admins: AdminUser[] = [];
  let adminNames = new Map<number, string>();
  let sortKey: SortKey = 'borrowedAt';
  let sortDir: SortDir = -1;

  const page = document.createElement('div');
  page.className = 'admin-orders-page';
  page.setAttribute('data-testid', 'admin-order-history-book-page');
  container.appendChild(page);

  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'breadcrumbs';
  breadcrumb.setAttribute('aria-label', 'Breadcrumb');
  breadcrumb.setAttribute('data-testid', 'breadcrumbs');
  page.appendChild(breadcrumb);

  const ordersLink = document.createElement('a');
  ordersLink.href = '/admin/orders';
  ordersLink.dataset.link = '';
  ordersLink.textContent = 'All orders';
  breadcrumb.appendChild(ordersLink);

  const sep = document.createElement('span');
  sep.className = 'breadcrumbs__separator';
  sep.textContent = '/';
  breadcrumb.appendChild(sep);

  const current = document.createElement('span');
  current.className = 'breadcrumbs__current';
  current.setAttribute('aria-current', 'page');
  current.setAttribute('data-testid', 'admin-order-history-book-title');
  current.textContent = `Book #${bookId}`;
  breadcrumb.appendChild(current);

  const heading = document.createElement('h1');
  heading.textContent = 'Order history';
  page.appendChild(heading);

  const subheading = document.createElement('p');
  subheading.className = 'admin-orders-page__subheading';
  subheading.setAttribute('data-testid', 'admin-order-history-book-count');
  page.appendChild(subheading);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'admin-table-wrapper';
  page.appendChild(tableWrapper);

  const table = document.createElement('table');
  table.className = 'admin-table orders-table';
  table.setAttribute('data-testid', 'admin-order-history-book-table');
  tableWrapper.appendChild(table);

  const thead = document.createElement('thead');
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  function sortHeaderCell(key: SortKey, label: string, testId: string): HTMLTableCellElement {
    const th = document.createElement('th');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-table__sort-btn';
    btn.setAttribute('data-testid', testId);
    btn.textContent = label + (sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
    btn.addEventListener('click', () => {
      sortDir = sortKey === key ? (sortDir === 1 ? -1 : 1) : 1;
      sortKey = key;
      renderHeader();
      renderRows();
    });
    th.appendChild(btn);
    return th;
  }

  function renderHeader(): void {
    thead.innerHTML = '';
    const row = document.createElement('tr');
    row.appendChild(sortHeaderCell('customer', 'Customer', 'sort-customer'));
    row.appendChild(sortHeaderCell('borrowedAt', 'Ordered on', 'sort-borrowedAt'));
    for (const label of ['Return by', 'Returned on', 'Returned to', 'Status', 'Actions']) {
      const th = document.createElement('th');
      th.textContent = label;
      row.appendChild(th);
    }
    thead.appendChild(row);
  }

  function sortedLoans(): Loan[] {
    return [...loans].sort((a, b) => {
      if (sortKey === 'customer') {
        return (
          sortDir *
          (customerNames.get(a.userId) ?? '').localeCompare(customerNames.get(b.userId) ?? '')
        );
      }
      return sortDir * (new Date(a.borrowedAt).getTime() - new Date(b.borrowedAt).getTime());
    });
  }

  function renderRows(): void {
    const rows = sortedLoans();
    tbody.innerHTML = '';

    if (rows.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 7;
      emptyCell.className = 'orders-table__empty';
      emptyCell.textContent = 'No one has ordered this book yet.';
      emptyCell.setAttribute('data-testid', 'admin-order-history-book-empty');
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    for (const loan of rows) {
      const row = document.createElement('tr');
      row.setAttribute('data-testid', 'admin-order-history-row');

      const customerTd = document.createElement('td');
      const customerLink = document.createElement('a');
      customerLink.href = `/admin/orders/user/${loan.userId}/history`;
      customerLink.dataset.link = '';
      customerLink.textContent = customerNames.get(loan.userId) ?? `User #${loan.userId}`;
      customerTd.appendChild(customerLink);
      row.appendChild(customerTd);

      const orderedTd = document.createElement('td');
      orderedTd.textContent = new Date(loan.borrowedAt).toLocaleDateString();
      row.appendChild(orderedTd);

      const dueTd = document.createElement('td');
      dueTd.textContent = new Date(loan.dueAt).toLocaleDateString();
      row.appendChild(dueTd);

      const returnedTd = document.createElement('td');
      returnedTd.textContent = loan.returnedAt
        ? new Date(loan.returnedAt).toLocaleDateString()
        : '—';
      row.appendChild(returnedTd);

      const returnedToTd = document.createElement('td');
      returnedToTd.textContent = loan.returnedToAdminId
        ? (adminNames.get(loan.returnedToAdminId) ?? `Admin #${loan.returnedToAdminId}`)
        : '—';
      row.appendChild(returnedToTd);

      const statusTd = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = `order-status order-status--${loan.status}`;
      statusBadge.textContent = loan.status;
      statusTd.appendChild(statusBadge);
      row.appendChild(statusTd);

      const actionsTd = document.createElement('td');
      if (loan.status !== 'returned') {
        const returnBtn = document.createElement('button');
        returnBtn.type = 'button';
        returnBtn.className = 'btn btn--secondary';
        returnBtn.textContent = 'Return';
        returnBtn.setAttribute('data-testid', `admin-return-order-${loan.id}`);
        returnBtn.addEventListener('click', () =>
          openReturnLoanModal(loan, admins, () => void loadLoans()),
        );
        actionsTd.appendChild(returnBtn);
      } else {
        actionsTd.textContent = '—';
      }
      row.appendChild(actionsTd);

      tbody.appendChild(row);
    }
  }

  async function loadBook(): Promise<void> {
    try {
      const book = await apiClient.getBook(bookId);
      current.textContent = book.title;
    } catch {
      current.textContent = `Book #${bookId}`;
      showToast('Could not load book details.', 'error');
    }
  }

  async function loadLoans(): Promise<void> {
    try {
      loans = await apiClient.listAllLoans({ bookId });
      subheading.textContent = `Ordered ${loans.length} time${loans.length === 1 ? '' : 's'} in total.`;
      renderRows();
    } catch {
      showToast('Could not load this book’s order history.', 'error');
    }
  }

  async function loadUsers(): Promise<void> {
    try {
      const users = await apiClient.listUsers();
      customerNames = new Map(users.map((u: AppUser) => [u.id, u.name]));
      renderRows();
    } catch {
      showToast('Could not load customers.', 'error');
    }
  }

  async function loadAdmins(): Promise<void> {
    try {
      admins = await apiClient.listAdmins();
      adminNames = new Map(admins.map((a) => [a.id, a.name]));
      renderRows();
    } catch {
      showToast('Could not load admins for return handover.', 'error');
    }
  }

  renderHeader();
  renderRows();
  void loadBook();
  void loadUsers();
  void loadAdmins();
  void loadLoans();

  return () => {
    container.classList.remove('page-container--wide');
  };
}
