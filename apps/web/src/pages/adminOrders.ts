import { apiClient } from '../api/client';
import type { AdminUser, AppUser, Book, Loan } from '../api/types';
import { openReturnLoanModal } from '../components/returnLoanModal';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import '../styles/phase9.css';

type SortKey = 'book' | 'customer' | 'borrowedAt';
type SortDir = 1 | -1;
type StatusFilter = 'all' | Loan['status'];

/** Admin-only "all orders" view — every customer's borrow/return history in one table. */
export function renderAdminOrdersPage(container: HTMLElement): () => void {
  const auth = getAuthState();
  if (auth?.user.role !== 'admin') {
    showToast('Admin access required.', 'error');
    navigate('/books');
    return () => {};
  }

  container.classList.add('page-container--wide');

  let loans: Loan[] = [];
  let bookTitles = new Map<number, string>();
  let customerNames = new Map<number, string>();
  let admins: AdminUser[] = [];
  let adminNames = new Map<number, string>();
  let sortKey: SortKey = 'borrowedAt';
  let sortDir: SortDir = -1;
  let bookFilter = '';
  let customerFilter = '';
  let statusFilter: StatusFilter = 'all';

  const root = document.createElement('div');
  root.className = 'admin-orders-page';
  root.setAttribute('data-testid', 'admin-orders-page');
  container.appendChild(root);

  const heading = document.createElement('h1');
  heading.textContent = 'All orders';
  root.appendChild(heading);

  const filterBar = document.createElement('div');
  filterBar.className = 'orders-filter-bar';
  filterBar.setAttribute('data-testid', 'admin-orders-filter-bar');
  root.appendChild(filterBar);

  const bookFilterLabel = document.createElement('label');
  bookFilterLabel.textContent = 'Filter by book';
  const bookFilterInput = document.createElement('input');
  bookFilterInput.type = 'text';
  bookFilterInput.placeholder = 'Book title…';
  bookFilterInput.setAttribute('data-testid', 'admin-orders-filter-book');
  bookFilterInput.addEventListener('input', () => {
    bookFilter = bookFilterInput.value;
    renderRows();
  });
  bookFilterLabel.appendChild(bookFilterInput);
  filterBar.appendChild(bookFilterLabel);

  const customerFilterLabel = document.createElement('label');
  customerFilterLabel.textContent = 'Filter by customer';
  const customerFilterInput = document.createElement('input');
  customerFilterInput.type = 'text';
  customerFilterInput.placeholder = 'Name or email…';
  customerFilterInput.setAttribute('data-testid', 'admin-orders-filter-customer');
  customerFilterInput.addEventListener('input', () => {
    customerFilter = customerFilterInput.value;
    renderRows();
  });
  customerFilterLabel.appendChild(customerFilterInput);
  filterBar.appendChild(customerFilterLabel);

  const statusFilterLabel = document.createElement('label');
  statusFilterLabel.textContent = 'Status';
  const statusFilterSelect = document.createElement('select');
  statusFilterSelect.setAttribute('data-testid', 'admin-orders-filter-status');
  for (const [value, label] of [
    ['all', 'All'],
    ['active', 'Active'],
    ['returned', 'Returned'],
    ['overdue', 'Overdue'],
  ] as const) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    statusFilterSelect.appendChild(opt);
  }
  statusFilterSelect.addEventListener('change', () => {
    statusFilter = statusFilterSelect.value as StatusFilter;
    renderRows();
  });
  statusFilterLabel.appendChild(statusFilterSelect);
  filterBar.appendChild(statusFilterLabel);

  const clearFiltersBtn = document.createElement('button');
  clearFiltersBtn.type = 'button';
  clearFiltersBtn.className = 'btn btn--secondary';
  clearFiltersBtn.textContent = 'Clear filters';
  clearFiltersBtn.setAttribute('data-testid', 'admin-orders-filter-clear');
  clearFiltersBtn.addEventListener('click', () => {
    bookFilter = '';
    customerFilter = '';
    statusFilter = 'all';
    bookFilterInput.value = '';
    customerFilterInput.value = '';
    statusFilterSelect.value = 'all';
    renderRows();
  });
  filterBar.appendChild(clearFiltersBtn);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'admin-table-wrapper';
  root.appendChild(tableWrapper);

  const table = document.createElement('table');
  table.className = 'admin-table orders-table';
  table.setAttribute('data-testid', 'admin-orders-table');
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
    row.appendChild(sortHeaderCell('customer', 'Customer', 'sort-customer'));
    row.appendChild(sortHeaderCell('borrowedAt', 'Ordered on', 'sort-borrowedAt'));
    for (const label of ['Return by', 'Returned on', 'Returned to', 'Status', 'Actions']) {
      const th = document.createElement('th');
      th.textContent = label;
      row.appendChild(th);
    }
    thead.appendChild(row);
  }

  function filteredSortedLoans(): Loan[] {
    let list = loans;
    if (bookFilter.trim()) {
      const q = bookFilter.trim().toLowerCase();
      list = list.filter((l) => (bookTitles.get(l.bookId) ?? '').toLowerCase().includes(q));
    }
    if (customerFilter.trim()) {
      const q = customerFilter.trim().toLowerCase();
      list = list.filter((l) => (customerNames.get(l.userId) ?? '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      list = list.filter((l) => l.status === statusFilter);
    }
    return [...list].sort((a, b) => {
      if (sortKey === 'book') {
        return (
          sortDir * (bookTitles.get(a.bookId) ?? '').localeCompare(bookTitles.get(b.bookId) ?? '')
        );
      }
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
    const rows = filteredSortedLoans();
    tbody.innerHTML = '';

    if (rows.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 8;
      emptyCell.className = 'orders-table__empty';
      emptyCell.textContent =
        loans.length === 0 ? 'No orders yet.' : 'No orders match these filters.';
      emptyCell.setAttribute('data-testid', 'admin-orders-empty');
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    for (const loan of rows) {
      const row = document.createElement('tr');
      row.setAttribute('data-testid', 'admin-order-row');

      const bookTd = document.createElement('td');
      const bookLink = document.createElement('a');
      bookLink.href = `/admin/orders/book/${loan.bookId}/history`;
      bookLink.dataset.link = '';
      bookLink.textContent = bookTitles.get(loan.bookId) ?? `Book #${loan.bookId}`;
      bookLink.setAttribute('data-testid', `admin-order-book-link-${loan.id}`);
      bookTd.appendChild(bookLink);
      row.appendChild(bookTd);

      const customerTd = document.createElement('td');
      const customerLink = document.createElement('a');
      customerLink.href = `/admin/orders/user/${loan.userId}/history`;
      customerLink.dataset.link = '';
      customerLink.textContent = customerNames.get(loan.userId) ?? `User #${loan.userId}`;
      customerLink.setAttribute('data-testid', `admin-order-customer-link-${loan.id}`);
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

  async function loadLoans(): Promise<void> {
    try {
      loans = await apiClient.listAllLoans();
      renderRows();
    } catch {
      showToast('Could not load orders.', 'error');
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
  void loadBooks();
  void loadUsers();
  void loadAdmins();
  void loadLoans();

  return () => {
    container.classList.remove('page-container--wide');
  };
}
