import { apiClient } from '../api/client';
import type { Book } from '../api/types';
import { ApiError } from '../api/types';
import { showToast } from '../components/toast';

const PAGE_SIZE = 8;

export function renderBooksPage(container: HTMLElement): void {
  let authorNames = new Map<number, string>();
  let categoryNames = new Map<number, string>();
  const page = document.createElement('div');
  page.className = 'books-page';

  const heading = document.createElement('h1');
  heading.textContent = 'Books';
  page.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'books-grid';
  grid.setAttribute('data-testid', 'books-grid');
  page.appendChild(grid);

  const loadMoreWrapper = document.createElement('div');
  loadMoreWrapper.className = 'books-page__load-more';
  page.appendChild(loadMoreWrapper);

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.type = 'button';
  loadMoreBtn.className = 'btn btn--secondary';
  loadMoreBtn.textContent = 'Load more';
  loadMoreBtn.setAttribute('data-testid', 'load-more-button');
  loadMoreWrapper.appendChild(loadMoreBtn);

  container.appendChild(page);

  let currentPage = 1;

  function renderSkeletons(count: number): void {
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'book-card book-card--skeleton';
      grid.appendChild(skeleton);
    }
  }

  function clearSkeletons(): void {
    for (const el of grid.querySelectorAll('.book-card--skeleton')) el.remove();
  }

  function renderBookCard(book: Book): void {
    const card = document.createElement('article');
    card.className = 'book-card';
    card.setAttribute('data-testid', 'book-card');

    const title = document.createElement('h2');
    title.className = 'book-card__title';
    title.textContent = book.title;
    card.appendChild(title);

    const author = document.createElement('p');
    author.className = 'book-card__author';
    author.textContent = authorNames.get(book.authorId) ?? 'Unknown author';
    card.appendChild(author);

    const categoryLabels = book.categoryIds.map((id) => categoryNames.get(id) ?? 'Uncategorized');
    const meta = document.createElement('p');
    meta.className = 'book-card__meta';
    meta.textContent = `${book.publishedYear ?? 'n/a'} · ${categoryLabels.join(', ')}`;
    card.appendChild(meta);

    const badge = document.createElement('span');
    badge.className =
      book.availableCopies > 0 ? 'badge badge--available' : 'badge badge--unavailable';
    badge.textContent =
      book.availableCopies > 0 ? `${book.availableCopies} available` : 'Unavailable';
    card.appendChild(badge);

    grid.appendChild(card);
  }

  async function loadPage(pageNum: number): Promise<void> {
    loadMoreBtn.disabled = true;
    renderSkeletons(PAGE_SIZE);
    try {
      const result = await apiClient.listBooks({ page: pageNum, limit: PAGE_SIZE });
      clearSkeletons();
      for (const book of result.books) renderBookCard(book);
      loadMoreWrapper.hidden = result.pagination.page >= result.pagination.totalPages;
    } catch (err) {
      clearSkeletons();
      const message = err instanceof ApiError ? err.message : 'Could not load books.';
      showToast(message, 'error');
    } finally {
      loadMoreBtn.disabled = false;
    }
  }

  loadMoreBtn.addEventListener('click', () => {
    currentPage += 1;
    loadPage(currentPage);
  });

  async function init(): Promise<void> {
    try {
      const [authors, categories] = await Promise.all([
        apiClient.listAuthors(),
        apiClient.listCategories(),
      ]);
      authorNames = new Map(authors.map((a) => [a.id, a.name]));
      categoryNames = new Map(categories.map((c) => [c.id, c.name]));
    } catch {
      // Book cards fall back to "Unknown author" / "Uncategorized" labels.
    }
    await loadPage(currentPage);
  }

  init();
}
