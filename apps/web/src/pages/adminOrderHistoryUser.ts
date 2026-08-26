import { apiClient } from '../api/client';
import type { AdminUser, AppUser, Book, Loan } from '../api/types';
import { openReturnLoanModal } from '../components/returnLoanModal';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import '../styles/phase9.css';

type SortKey = 'book' | 'borrowedAt';
type SortDir = 1 | -1;

/** Admin-only: one customer's full order history, reached by clicking their name on `/admin/orders`. */
export function renderAdminOrderHistoryUserPage(
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

  const userId = Number(params.id);
  let loans: Loan[] = [];
  let bookTitles = new Map<number, string>();
  let admins: AdminUser[] = [];
  let adminNames = new Map<number, string>();
  let sortKey: SortKey = 'borrowedAt';
  let sortDir: SortDir = -1;

  const page = document.createElement('div');
  page.className = 'admin-orders-page';
  page.setAttribute('data-testid', 'admin-order-history-user-page');
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
  current.setAttribute('data-testid', 'admin-order-history-user-name');
  current.textContent = `User #${userId}`;
  breadcrumb.appendChild(current);

  const heading = document.createElement('h1');
  heading.textContent = 'Order history';
  page.appendChild(heading);

  const subheading = document.createElement('p');
  subheading.className = 'admin-orders-page__subheading';
  subheading.setAttribute('data-testid', 'admin-order-history-user-email');
  page.appendChild(subheading);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'admin-table-wrapper';
  page.appendChild(tableWrapper);

  const table = document.createElement('table');
  table.className = 'admin-table orders-table';
  table.setAttribute('data-testid', 'admin-order-history-user-table');
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
    row.appendChild(sortHeaderCell('book', 'Book', 'sort-book'));
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
      if (sortKey === 'book') {
        return (
          sortDir * (bookTitles.get(a.bookId) ?? '').localeCompare(bookTitles.get(b.bookId) ?? '')
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
      emptyCell.textContent = 'This customer has no orders yet.';
      emptyCell.setAttribute('data-testid', 'admin-order-history-user-empty');
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    for (const loan of rows) {
      const row = document.createElement('tr');
      row.setAttribute('data-testid', 'admin-order-history-row');

      const bookTd = document.createElement('td');
      const bookLink = document.createElement('a');
      bookLink.href = `/admin/orders/book/${loan.bookId}/history`;
      bookLink.dataset.link = '';
      bookLink.textContent = bookTitles.get(loan.bookId) ?? `Book #${loan.bookId}`;
      bookTd.appendChild(bookLink);
      row.appendChild(bookTd);

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

  async function loadUser(): Promise<void> {
    try {
      const users = await apiClient.listUsers();
      const user = users.find((u: AppUser) => u.id === userId);
      if (user) {
        current.textContent = user.name;
        subheading.textContent = user.email;
      } else {
        current.textContent = `User #${userId}`;
        subheading.textContent = 'This user could not be found.';
      }
    } catch {
      showToast('Could not load customer details.', 'error');
    }
  }

  async function loadLoans(): Promise<void> {
    try {
      loans = await apiClient.listAllLoans({ userId });
      renderRows();
    } catch {
      showToast('Could not load this customer’s orders.', 'error');
    }
  }

  async function loadBooks(): Promise<void> {
    try {
      const result = await apiClient.listBooks({ limit: 100, sort: 'title' });
      bookTitles = new Map(result.books.map((b: Book) => [b.id, b.title]));
      renderRows();
    } catch {
      showToast('Could not load books.', 'error');
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
  void loadUser();
  void loadBooks();
  void loadAdmins();
  void loadLoans();

  return () => {
    container.classList.remove('page-container--wide');
  };
}
