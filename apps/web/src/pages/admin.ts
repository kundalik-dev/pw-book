import type { AdminBookSort } from '../api/extraClient';
import { deleteBookAdmin, listBooksSorted } from '../api/extraClient';
import type { Book } from '../api/types';
import { openConfirmModal } from '../components/modal';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import '../styles/phase9.css';

const PAGE_SIZE = 10;

interface SortableColumn {
  key: 'title' | 'publishedYear' | 'createdAt';
  label: string;
}
const COLUMNS: SortableColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'publishedYear', label: 'Published' },
  { key: 'createdAt', label: 'Added' },
];

export function renderAdminPage(container: HTMLElement): void {
  const auth = getAuthState();
  if (auth?.user.role !== 'admin') {
    showToast('Admin access required.', 'error');
    navigate('/books');
    return;
  }

  let sortKey: SortableColumn['key'] = 'title';
  let sortDir: 1 | -1 = 1;
  let currentBooks: Book[] = [];
  const selected = new Set<number>();

  const page = document.createElement('div');
  page.className = 'admin-page';
  page.setAttribute('data-testid', 'admin-page');
  container.appendChild(page);

  const heading = document.createElement('h1');
  heading.textContent = 'Manage books';
  page.appendChild(heading);

  const bulkBar = document.createElement('div');
  bulkBar.className = 'bulk-bar';
  bulkBar.hidden = true;
  bulkBar.setAttribute('data-testid', 'bulk-delete-bar');
  page.appendChild(bulkBar);

  const bulkCount = document.createElement('span');
  bulkBar.appendChild(bulkCount);

  const bulkDeleteBtn = document.createElement('button');
  bulkDeleteBtn.type = 'button';
  bulkDeleteBtn.className = 'btn btn--primary';
  bulkDeleteBtn.textContent = 'Delete selected';
  bulkDeleteBtn.setAttribute('data-testid', 'bulk-delete-button');
  bulkBar.appendChild(bulkDeleteBtn);

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.setAttribute('data-testid', 'admin-books-table');
  page.appendChild(table);

  const thead = document.createElement('thead');
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.setAttribute('data-testid', 'select-all-checkbox');
  selectAllCheckbox.addEventListener('change', () => {
    selected.clear();
    if (selectAllCheckbox.checked) {
      for (const book of currentBooks) selected.add(book.id);
    }
    renderRows();
    updateBulkBar();
  });

  function renderHeader(): void {
    thead.innerHTML = '';
    const row = document.createElement('tr');

    const selectTh = document.createElement('th');
    selectTh.appendChild(selectAllCheckbox);
    row.appendChild(selectTh);

    for (const col of COLUMNS) {
      const th = document.createElement('th');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'admin-table__sort-btn';
      btn.setAttribute('data-testid', `sort-${col.key}`);
      const arrow = sortKey === col.key ? (sortDir === 1 ? ' ▲' : ' ▼') : '';
      btn.textContent = col.label + arrow;
      btn.addEventListener('click', () => {
        if (sortKey === col.key) {
          sortDir = sortDir === 1 ? -1 : 1;
        } else {
          sortKey = col.key;
          sortDir = 1;
        }
        load();
      });
      th.appendChild(btn);
      row.appendChild(th);
    }

    const actionsTh = document.createElement('th');
    actionsTh.textContent = 'Actions';
    row.appendChild(actionsTh);

    thead.appendChild(row);
  }

  function renderRows(): void {
    tbody.innerHTML = '';
    for (const book of currentBooks) {
      const row = document.createElement('tr');
      row.setAttribute('data-testid', 'admin-book-row');

      const selectTd = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(book.id);
      checkbox.setAttribute('data-testid', `select-book-${book.id}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(book.id);
        else selected.delete(book.id);
        updateBulkBar();
      });
      selectTd.appendChild(checkbox);
      row.appendChild(selectTd);

      const titleTd = document.createElement('td');
      titleTd.textContent = book.title;
      row.appendChild(titleTd);

      const yearTd = document.createElement('td');
      yearTd.textContent = book.publishedYear ? String(book.publishedYear) : '—';
      row.appendChild(yearTd);

      const addedTd = document.createElement('td');
      addedTd.textContent = '—';
      row.appendChild(addedTd);

      const actionsTd = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn--secondary';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('data-testid', `delete-book-${book.id}`);
      deleteBtn.addEventListener('click', () => confirmDelete([book.id], book.title));
      actionsTd.appendChild(deleteBtn);
      row.appendChild(actionsTd);

      tbody.appendChild(row);
    }
  }

  function updateBulkBar(): void {
    bulkBar.hidden = selected.size === 0;
    bulkCount.textContent = `${selected.size} selected`;
    selectAllCheckbox.checked = currentBooks.length > 0 && selected.size === currentBooks.length;
  }

  function confirmDelete(ids: number[], label: string): void {
    openConfirmModal({
      title: 'Delete book',
      testId: 'confirm-delete-modal',
      message:
        ids.length === 1
          ? `Delete "${label}"? This can't be undone.`
          : `Delete ${ids.length} books? This can't be undone.`,
      onConfirm: async () => {
        try {
          for (const id of ids) await deleteBookAdmin(id);
          for (const id of ids) selected.delete(id);
          showToast(ids.length === 1 ? 'Book deleted.' : `${ids.length} books deleted.`, 'success');
          await load();
        } catch {
          showToast('Could not delete one or more books.', 'error');
        }
      },
    });
  }

  bulkDeleteBtn.addEventListener('click', () => {
    confirmDelete([...selected], '');
  });

  async function load(): Promise<void> {
    const sort = (sortDir === -1 ? `-${sortKey}` : sortKey) as AdminBookSort;
    try {
      const result = await listBooksSorted({ page: 1, limit: PAGE_SIZE, sort });
      currentBooks = result.books;
      renderHeader();
      renderRows();
      updateBulkBar();
    } catch {
      showToast('Could not load books.', 'error');
    }
  }

  load();
}
