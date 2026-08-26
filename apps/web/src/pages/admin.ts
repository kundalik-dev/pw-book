import { apiClient } from '../api/client';
import { ApiError, type Author, type Book, type BooksSort, type Category } from '../api/types';
import { createBookForm } from '../components/bookForm';
import { type OpenModal, openConfirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import '../styles/phase9.css';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

type SortKey = 'title' | 'publishedYear' | 'createdAt';

interface ColumnDef {
  key: string;
  label: string;
  sortKey?: SortKey;
}

const COLUMNS: ColumnDef[] = [
  { key: 'title', label: 'Title', sortKey: 'title' },
  { key: 'author', label: 'Author' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'publishedYear', label: 'Published', sortKey: 'publishedYear' },
  { key: 'copies', label: 'Copies' },
  { key: 'createdAt', label: 'Added', sortKey: 'createdAt' },
];

export function renderAdminPage(container: HTMLElement): () => void {
  const auth = getAuthState();
  if (auth?.user.role !== 'admin') {
    showToast('Admin access required.', 'error');
    navigate('/books');
    return () => {};
  }

  container.classList.add('page-container--wide');

  let sortKey: SortKey = 'title';
  let sortDir: 1 | -1 = 1;
  let page = 1;
  let limit = PAGE_SIZE_OPTIONS[0];
  let totalPages = 1;
  let total = 0;
  let currentBooks: Book[] = [];
  const selected = new Set<number>();
  let authors: Author[] = [];
  let categories: Category[] = [];
  let authorNames = new Map<number, string>();

  const root = document.createElement('div');
  root.className = 'admin-page';
  root.setAttribute('data-testid', 'admin-page');
  container.appendChild(root);

  const heading = document.createElement('h1');
  heading.textContent = 'Manage books';
  root.appendChild(heading);

  const toolbar = document.createElement('div');
  toolbar.className = 'admin-toolbar';
  root.appendChild(toolbar);

  const bulkBar = document.createElement('div');
  bulkBar.className = 'bulk-bar';
  bulkBar.hidden = true;
  bulkBar.setAttribute('data-testid', 'bulk-delete-bar');
  toolbar.appendChild(bulkBar);

  const bulkCount = document.createElement('span');
  bulkCount.className = 'bulk-bar__count';
  bulkBar.appendChild(bulkCount);

  const bulkDeleteBtn = document.createElement('button');
  bulkDeleteBtn.type = 'button';
  bulkDeleteBtn.className = 'btn btn--primary';
  bulkDeleteBtn.textContent = 'Delete selected';
  bulkDeleteBtn.setAttribute('data-testid', 'bulk-delete-button');
  bulkBar.appendChild(bulkDeleteBtn);

  const addBookBtn = document.createElement('a');
  addBookBtn.href = '/admin/add-book';
  addBookBtn.dataset.link = '';
  addBookBtn.className = 'btn btn--primary admin-toolbar__add';
  addBookBtn.textContent = 'Add book';
  addBookBtn.setAttribute('data-testid', 'add-book-button');
  toolbar.appendChild(addBookBtn);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'admin-table-wrapper';
  root.appendChild(tableWrapper);

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.setAttribute('data-testid', 'admin-books-table');
  tableWrapper.appendChild(table);

  const thead = document.createElement('thead');
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  const paginationBar = document.createElement('div');
  paginationBar.className = 'pagination-bar';
  paginationBar.setAttribute('data-testid', 'pagination-bar');
  root.appendChild(paginationBar);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'btn btn--secondary';
  prevBtn.textContent = 'Previous';
  prevBtn.setAttribute('data-testid', 'pagination-prev');
  prevBtn.addEventListener('click', () => {
    if (page > 1) {
      page -= 1;
      void load();
    }
  });
  paginationBar.appendChild(prevBtn);

  const pageInfo = document.createElement('span');
  pageInfo.setAttribute('data-testid', 'pagination-info');
  paginationBar.appendChild(pageInfo);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'btn btn--secondary';
  nextBtn.textContent = 'Next';
  nextBtn.setAttribute('data-testid', 'pagination-next');
  nextBtn.addEventListener('click', () => {
    if (page < totalPages) {
      page += 1;
      void load();
    }
  });
  paginationBar.appendChild(nextBtn);

  const limitLabel = document.createElement('label');
  limitLabel.className = 'pagination-bar__limit';
  limitLabel.append('Rows per page ');
  const limitSelect = document.createElement('select');
  limitSelect.setAttribute('data-testid', 'pagination-limit');
  for (const size of PAGE_SIZE_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = String(size);
    opt.textContent = String(size);
    if (size === limit) opt.selected = true;
    limitSelect.appendChild(opt);
  }
  limitSelect.addEventListener('change', () => {
    limit = Number(limitSelect.value);
    page = 1;
    void load();
  });
  limitLabel.appendChild(limitSelect);
  paginationBar.appendChild(limitLabel);

  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.setAttribute('aria-label', 'Select all books on this page');
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
      if (col.sortKey) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-table__sort-btn';
        btn.setAttribute('data-testid', `sort-${col.sortKey}`);
        const arrow = sortKey === col.sortKey ? (sortDir === 1 ? ' ▲' : ' ▼') : '';
        btn.textContent = col.label + arrow;
        btn.addEventListener('click', () => {
          if (sortKey === col.sortKey) {
            sortDir = sortDir === 1 ? -1 : 1;
          } else {
            sortKey = col.sortKey as SortKey;
            sortDir = 1;
          }
          page = 1;
          void load();
        });
        th.appendChild(btn);
      } else {
        th.textContent = col.label;
      }
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
      checkbox.setAttribute('aria-label', `Select ${book.title}`);
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

      const authorTd = document.createElement('td');
      authorTd.textContent = authorNames.get(book.authorId) ?? 'Unknown';
      row.appendChild(authorTd);

      const isbnTd = document.createElement('td');
      isbnTd.textContent = book.isbn;
      row.appendChild(isbnTd);

      const yearTd = document.createElement('td');
      yearTd.textContent = book.publishedYear ? String(book.publishedYear) : '—';
      row.appendChild(yearTd);

      const copiesTd = document.createElement('td');
      const copiesBadge = document.createElement('span');
      copiesBadge.className = `badge ${book.availableCopies > 0 ? 'badge--available' : 'badge--unavailable'}`;
      copiesBadge.textContent = `${book.availableCopies} / ${book.totalCopies}`;
      copiesTd.appendChild(copiesBadge);
      row.appendChild(copiesTd);

      const addedTd = document.createElement('td');
      addedTd.textContent = new Date(book.createdAt).toLocaleDateString();
      row.appendChild(addedTd);

      const actionsTd = document.createElement('td');
      actionsTd.className = 'admin-table__actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn--secondary';
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('data-testid', `edit-book-${book.id}`);
      editBtn.addEventListener('click', () => {
        openEditBookForm(book, () => void load());
      });
      actionsTd.appendChild(editBtn);

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

  function updatePaginationBar(): void {
    pageInfo.textContent =
      total === 0 ? 'No books' : `Page ${page} of ${totalPages} (${total} books)`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
  }

  function confirmDelete(ids: number[], label: string): void {
    openConfirmModal({
      title: 'Delete book',
      testId: 'confirm-delete-modal',
      message:
        ids.length === 1 && label
          ? `Delete "${label}"? This can't be undone.`
          : `Delete ${ids.length} book${ids.length === 1 ? '' : 's'}? This can't be undone.`,
      onConfirm: async () => {
        const failures: string[] = [];
        for (const id of ids) {
          try {
            await apiClient.deleteBook(id);
            selected.delete(id);
          } catch (err) {
            failures.push(
              err instanceof ApiError ? err.message : `Book #${id} could not be deleted.`,
            );
          }
        }
        const deletedCount = ids.length - failures.length;
        if (deletedCount > 0) {
          showToast(
            deletedCount === 1 ? 'Book deleted.' : `${deletedCount} books deleted.`,
            'success',
          );
        }
        if (failures.length > 0) {
          showToast(failures[0], 'error');
        }
        await load();
      },
    });
  }

  bulkDeleteBtn.addEventListener('click', () => {
    confirmDelete([...selected], '');
  });

  function openEditBookForm(book: Book, onSaved: () => void): void {
    const bookForm = createBookForm(book, authors, categories);

    let modal: OpenModal;
    modal = openModal({
      title: 'Edit book',
      testId: 'book-form-modal',
      content: bookForm.element,
      actions: [
        {
          label: 'Cancel',
          variant: 'secondary',
          testId: 'book-form-cancel',
          onClick: () => modal.close(),
        },
        {
          label: 'Save changes',
          variant: 'primary',
          testId: 'book-form-submit',
          onClick: () => {
            void (async () => {
              const saved = await bookForm.save();
              if (saved) {
                showToast('Book updated.', 'success');
                modal.close();
                onSaved();
              }
            })();
          },
        },
      ],
    });
    bookForm.focusFirst();
  }

  async function loadLookups(): Promise<void> {
    try {
      [authors, categories] = await Promise.all([
        apiClient.listAuthors(),
        apiClient.listCategories(),
      ]);
      authorNames = new Map(authors.map((a) => [a.id, a.name]));
    } catch {
      showToast('Could not load authors/categories.', 'error');
    }
  }

  async function load(): Promise<void> {
    const sort = (sortDir === -1 ? `-${sortKey}` : sortKey) as BooksSort;
    try {
      const result = await apiClient.listBooks({ page, limit, sort });
      currentBooks = result.books;
      page = result.pagination.page;
      limit = result.pagination.limit;
      total = result.pagination.total;
      totalPages = result.pagination.totalPages;
      selected.clear();
      renderHeader();
      renderRows();
      updateBulkBar();
      updatePaginationBar();
    } catch {
      showToast('Could not load books.', 'error');
    }
  }

  void loadLookups();
  void load();

  return () => {
    container.classList.remove('page-container--wide');
  };
}
