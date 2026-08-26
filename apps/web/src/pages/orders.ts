import { apiClient } from '../api/client';
import type { AdminUser, Book, Loan } from '../api/types';
import { ApiError } from '../api/types';
import { openReturnLoanModal } from '../components/returnLoanModal';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import '../styles/phase9.css';

// Mirrors ORDER_RETURN_WINDOW_DAYS in apps/api's schemas/loan.ts
const ORDER_RETURN_WINDOW_DAYS = 10;

type SortKey = 'borrowedAt' | 'book';
type SortDir = 1 | -1;

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function renderOrdersPage(container: HTMLElement): void {
  const auth = getAuthState();
  if (!auth) {
    showToast('Log in to view your orders.', 'error');
    navigate('/login');
    return;
  }

  let books: Book[] = [];
  let bookTitles = new Map<number, string>();
  let admins: AdminUser[] = [];
  let adminNames = new Map<number, string>();
  let loans: Loan[] = [];
  let sortKey: SortKey = 'borrowedAt';
  let sortDir: SortDir = -1;
  let bookFilter = '';
  let dateFrom = '';
  let dateTo = '';

  const root = document.createElement('div');
  root.className = 'orders-page';
  root.setAttribute('data-testid', 'orders-page');
  container.appendChild(root);

  const heading = document.createElement('h1');
  heading.textContent = 'My orders';
  root.appendChild(heading);

  const form = document.createElement('form');
  form.className = 'order-form';
  form.setAttribute('data-testid', 'order-form');
  root.appendChild(form);

  const formHeading = document.createElement('h2');
  formHeading.textContent = 'Order a book';
  form.appendChild(formHeading);

  const bookLabel = document.createElement('label');
  bookLabel.textContent = 'Book';
  const bookSelect = document.createElement('select');
  bookSelect.required = true;
  bookSelect.setAttribute('data-testid', 'order-form-book');
  bookLabel.appendChild(bookSelect);
  form.appendChild(bookLabel);

  const todayUTC = startOfTodayUTC();
  const maxDate = new Date(todayUTC.getTime() + ORDER_RETURN_WINDOW_DAYS * 86_400_000);

  const dateLabel = document.createElement('label');
  dateLabel.textContent = `Return date (within ${ORDER_RETURN_WINDOW_DAYS} days of today)`;
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.required = true;
  dateInput.min = toDateInputValue(todayUTC);
  dateInput.max = toDateInputValue(maxDate);
  dateInput.value = toDateInputValue(maxDate);
  dateInput.setAttribute('data-testid', 'order-form-return-date');
  dateLabel.appendChild(dateInput);
  form.appendChild(dateLabel);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn--primary';
  submitBtn.textContent = 'Place order';
  submitBtn.disabled = true;
  submitBtn.setAttribute('data-testid', 'order-form-submit');
  form.appendChild(submitBtn);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void placeOrder();
  });

  async function placeOrder(): Promise<void> {
    const bookId = Number(bookSelect.value);
    if (!bookId || !dateInput.value) return;
    submitBtn.disabled = true;
    try {
      await apiClient.createLoan(bookId, dateInput.value);
      showToast('Book ordered.', 'success');
      await loadLoans();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not place this order.';
      showToast(message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  const filterBar = document.createElement('div');
  filterBar.className = 'orders-filter-bar';
  filterBar.setAttribute('data-testid', 'orders-filter-bar');
  root.appendChild(filterBar);

  const bookFilterLabel = document.createElement('label');
  bookFilterLabel.textContent = 'Filter by book';
  const bookFilterInput = document.createElement('input');
  bookFilterInput.type = 'text';
  bookFilterInput.placeholder = 'Book title…';
  bookFilterInput.setAttribute('data-testid', 'orders-filter-book');
  bookFilterInput.addEventListener('input', () => {
    bookFilter = bookFilterInput.value;
    renderRows();
  });
  bookFilterLabel.appendChild(bookFilterInput);
  filterBar.appendChild(bookFilterLabel);

  const dateFromLabel = document.createElement('label');
  dateFromLabel.textContent = 'Ordered from';
  const dateFromInput = document.createElement('input');
  dateFromInput.type = 'date';
  dateFromInput.setAttribute('data-testid', 'orders-filter-date-from');
  dateFromInput.addEventListener('change', () => {
    dateFrom = dateFromInput.value;
    renderRows();
  });
  dateFromLabel.appendChild(dateFromInput);
  filterBar.appendChild(dateFromLabel);

  const dateToLabel = document.createElement('label');
  dateToLabel.textContent = 'Ordered to';
  const dateToInput = document.createElement('input');
  dateToInput.type = 'date';
  dateToInput.setAttribute('data-testid', 'orders-filter-date-to');
  dateToInput.addEventListener('change', () => {
    dateTo = dateToInput.value;
    renderRows();
  });
  dateToLabel.appendChild(dateToInput);
  filterBar.appendChild(dateToLabel);

  const clearFiltersBtn = document.createElement('button');
  clearFiltersBtn.type = 'button';
  clearFiltersBtn.className = 'btn btn--secondary';
  clearFiltersBtn.textContent = 'Clear filters';
  clearFiltersBtn.setAttribute('data-testid', 'orders-filter-clear');
  clearFiltersBtn.addEventListener('click', () => {
    bookFilter = '';
    dateFrom = '';
    dateTo = '';
    bookFilterInput.value = '';
    dateFromInput.value = '';
    dateToInput.value = '';
    renderRows();
  });
  filterBar.appendChild(clearFiltersBtn);

  const table = document.createElement('table');
  table.className = 'admin-table orders-table';
  table.setAttribute('data-testid', 'orders-table');
  root.appendChild(table);

  const thead = document.createElement('thead');
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  function renderHeader(): void {
    thead.innerHTML = '';
    const row = document.createElement('tr');

    const bookTh = document.createElement('th');
    const bookSortBtn = document.createElement('button');
    bookSortBtn.type = 'button';
    bookSortBtn.className = 'admin-table__sort-btn';
    bookSortBtn.setAttribute('data-testid', 'sort-book');
    bookSortBtn.textContent = `Book${sortKey === 'book' ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}`;
    bookSortBtn.addEventListener('click', () => toggleSort('book'));
    bookTh.appendChild(bookSortBtn);
    row.appendChild(bookTh);

    const orderedTh = document.createElement('th');
    const orderedSortBtn = document.createElement('button');
    orderedSortBtn.type = 'button';
    orderedSortBtn.className = 'admin-table__sort-btn';
    orderedSortBtn.setAttribute('data-testid', 'sort-borrowedAt');
    orderedSortBtn.textContent = `Ordered on${sortKey === 'borrowedAt' ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}`;
    orderedSortBtn.addEventListener('click', () => toggleSort('borrowedAt'));
    orderedTh.appendChild(orderedSortBtn);
    row.appendChild(orderedTh);

    for (const label of ['Return by', 'Returned on', 'Returned to', 'Status', 'Actions']) {
      const th = document.createElement('th');
      th.textContent = label;
      row.appendChild(th);
    }

    thead.appendChild(row);
  }

  function toggleSort(key: SortKey): void {
    sortDir = sortKey === key ? (sortDir === 1 ? -1 : 1) : 1;
    sortKey = key;
    renderHeader();
    renderRows();
  }

  function filteredSortedLoans(): Loan[] {
    let list = loans;
    if (bookFilter.trim()) {
      const q = bookFilter.trim().toLowerCase();
      list = list.filter((l) => (bookTitles.get(l.bookId) ?? '').toLowerCase().includes(q));
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((l) => new Date(l.borrowedAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000 - 1;
      list = list.filter((l) => new Date(l.borrowedAt).getTime() <= to);
    }
    return [...list].sort((a, b) => {
      if (sortKey === 'book') {
        const titleA = bookTitles.get(a.bookId) ?? '';
        const titleB = bookTitles.get(b.bookId) ?? '';
        return sortDir * titleA.localeCompare(titleB);
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
      emptyCell.colSpan = 7;
      emptyCell.className = 'orders-table__empty';
      emptyCell.textContent =
        loans.length === 0 ? 'No orders yet.' : 'No orders match these filters.';
      emptyCell.setAttribute('data-testid', 'orders-empty');
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    for (const loan of rows) {
      const row = document.createElement('tr');
      row.setAttribute('data-testid', 'order-row');

      const bookTd = document.createElement('td');
      bookTd.textContent = bookTitles.get(loan.bookId) ?? `Book #${loan.bookId}`;
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
        returnBtn.setAttribute('data-testid', `return-order-${loan.id}`);
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
      loans = await apiClient.listMyLoans();
      renderRows();
    } catch {
      showToast('Could not load your orders.', 'error');
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

  async function loadBooks(): Promise<void> {
    try {
      const result = await apiClient.listBooks({ limit: 100, sort: 'title' });
      books = result.books;
      bookTitles = new Map(books.map((b) => [b.id, b.title]));
      bookSelect.innerHTML = '';
      for (const book of books) {
        const opt = document.createElement('option');
        opt.value = String(book.id);
        opt.textContent = book.availableCopies > 0 ? book.title : `${book.title} (unavailable)`;
        opt.disabled = book.availableCopies <= 0;
        bookSelect.appendChild(opt);
      }
      submitBtn.disabled = false;
    } catch {
      showToast('Could not load books.', 'error');
    }
  }

  renderHeader();
  renderRows();
  void loadBooks();
  void loadAdmins();
  void loadLoans();
}
