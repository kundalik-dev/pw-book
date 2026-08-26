import { apiClient } from '../api/client';
import type { Author, Book, BooksSort, Category, ListBooksParams } from '../api/types';
import { ApiError } from '../api/types';
import { showToast } from '../components/toast';

const PAGE_SIZE = 8;
const SUGGESTION_LIMIT = 5;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_MIN_YEAR = 1900;
const DEFAULT_MAX_YEAR = new Date().getFullYear();

type Availability = 'all' | 'available' | 'unavailable';

interface FilterState {
  q: string;
  sort: BooksSort;
  categoryIds: Set<number>;
  authorIds: Set<number>;
  availability: Availability;
  yearMin: number;
  yearMax: number;
}

const SORT_OPTIONS: { value: BooksSort; label: string }[] = [
  { value: 'title', label: 'Title (A–Z)' },
  { value: '-title', label: 'Title (Z–A)' },
  { value: '-publishedYear', label: 'Year (newest first)' },
  { value: 'publishedYear', label: 'Year (oldest first)' },
];

export function renderBooksPage(container: HTMLElement): () => void {
  container.classList.add('page-container--wide');

  let authorNames = new Map<number, string>();
  let categoryNames = new Map<number, string>();

  const state: FilterState = {
    q: '',
    sort: 'title',
    categoryIds: new Set(),
    authorIds: new Set(),
    availability: 'all',
    yearMin: DEFAULT_MIN_YEAR,
    yearMax: DEFAULT_MAX_YEAR,
  };

  let currentPage = 1;
  let requestSeq = 0;
  let searchDebounceTimer: number | undefined;

  const page = document.createElement('div');
  page.className = 'books-page';

  // Breadcrumbs
  const breadcrumbs = document.createElement('nav');
  breadcrumbs.className = 'breadcrumbs';
  breadcrumbs.setAttribute('aria-label', 'breadcrumb');
  breadcrumbs.setAttribute('data-testid', 'breadcrumbs');
  const breadcrumbHome = document.createElement('a');
  breadcrumbHome.href = '/books';
  breadcrumbHome.setAttribute('data-link', '');
  breadcrumbHome.textContent = 'Home';
  const breadcrumbSep = document.createElement('span');
  breadcrumbSep.className = 'breadcrumbs__separator';
  breadcrumbSep.setAttribute('aria-hidden', 'true');
  breadcrumbSep.textContent = '/';
  const breadcrumbCurrent = document.createElement('span');
  breadcrumbCurrent.className = 'breadcrumbs__current';
  breadcrumbCurrent.setAttribute('aria-current', 'page');
  breadcrumbCurrent.textContent = 'Books';
  breadcrumbs.append(breadcrumbHome, breadcrumbSep, breadcrumbCurrent);
  page.appendChild(breadcrumbs);

  const heading = document.createElement('h1');
  heading.textContent = 'Books';
  page.appendChild(heading);

  // Toolbar: search + sort
  const toolbar = document.createElement('div');
  toolbar.className = 'books-toolbar';
  page.appendChild(toolbar);

  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'search-bar';
  toolbar.appendChild(searchWrapper);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'books-search';
  searchInput.placeholder = 'Search by title, author, or ISBN…';
  searchInput.autocomplete = 'off';
  searchInput.setAttribute('data-testid', 'search-input');
  searchInput.setAttribute('aria-label', 'Search books');
  searchWrapper.appendChild(searchInput);

  const suggestionsList = document.createElement('ul');
  suggestionsList.className = 'search-bar__suggestions';
  suggestionsList.setAttribute('data-testid', 'search-suggestions');
  suggestionsList.hidden = true;
  searchWrapper.appendChild(suggestionsList);

  const sortWrapper = document.createElement('div');
  sortWrapper.className = 'sort-control';
  toolbar.appendChild(sortWrapper);

  const sortLabel = document.createElement('label');
  sortLabel.htmlFor = 'books-sort';
  sortLabel.textContent = 'Sort by';
  sortWrapper.appendChild(sortLabel);

  const sortSelect = document.createElement('select');
  sortSelect.id = 'books-sort';
  sortSelect.setAttribute('data-testid', 'sort-select');
  for (const opt of SORT_OPTIONS) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    sortSelect.appendChild(option);
  }
  sortWrapper.appendChild(sortSelect);

  // Layout: filter sidebar + content
  const layout = document.createElement('div');
  layout.className = 'books-layout';
  page.appendChild(layout);

  const sidebar = document.createElement('aside');
  sidebar.className = 'filters-sidebar';
  sidebar.setAttribute('data-testid', 'filters-sidebar');
  layout.appendChild(sidebar);

  const sidebarHeading = document.createElement('h2');
  sidebarHeading.className = 'filters-sidebar__heading';
  sidebarHeading.textContent = 'Filters';
  sidebar.appendChild(sidebarHeading);

  const clearFiltersBtn = document.createElement('button');
  clearFiltersBtn.type = 'button';
  clearFiltersBtn.className = 'btn btn--secondary filters-sidebar__clear';
  clearFiltersBtn.textContent = 'Clear filters';
  clearFiltersBtn.setAttribute('data-testid', 'clear-filters-button');
  sidebar.appendChild(clearFiltersBtn);

  // Category checkboxes
  const categoryGroup = document.createElement('fieldset');
  categoryGroup.className = 'filter-group';
  categoryGroup.setAttribute('data-testid', 'category-filters');
  const categoryLegend = document.createElement('legend');
  categoryLegend.textContent = 'Category';
  categoryGroup.appendChild(categoryLegend);
  sidebar.appendChild(categoryGroup);

  // Availability radios
  const availabilityGroup = document.createElement('fieldset');
  availabilityGroup.className = 'filter-group';
  availabilityGroup.setAttribute('data-testid', 'availability-filters');
  const availabilityLegend = document.createElement('legend');
  availabilityLegend.textContent = 'Availability';
  availabilityGroup.appendChild(availabilityLegend);
  sidebar.appendChild(availabilityGroup);

  const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'available', label: 'Available' },
    { value: 'unavailable', label: 'Unavailable' },
  ];
  for (const opt of AVAILABILITY_OPTIONS) {
    const optWrapper = document.createElement('div');
    optWrapper.className = 'filter-group__option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'availability';
    radio.id = `availability-${opt.value}`;
    radio.value = opt.value;
    radio.checked = opt.value === 'all';
    radio.setAttribute('data-testid', `availability-${opt.value}`);
    optWrapper.appendChild(radio);

    const label = document.createElement('label');
    label.htmlFor = radio.id;
    label.textContent = opt.label;
    optWrapper.appendChild(label);

    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.availability = opt.value;
        resetAndLoad();
      }
    });

    availabilityGroup.appendChild(optWrapper);
  }

  // Published year range slider
  const yearGroup = document.createElement('fieldset');
  yearGroup.className = 'filter-group';
  yearGroup.setAttribute('data-testid', 'year-filter');
  const yearLegend = document.createElement('legend');
  yearLegend.textContent = 'Published year';
  yearGroup.appendChild(yearLegend);
  sidebar.appendChild(yearGroup);

  function createYearSlider(
    idSuffix: string,
    labelText: string,
  ): { wrapper: HTMLDivElement; input: HTMLInputElement; output: HTMLOutputElement } {
    const wrapper = document.createElement('div');
    wrapper.className = 'year-slider';

    const id = `year-${idSuffix}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    wrapper.appendChild(label);

    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(DEFAULT_MIN_YEAR);
    input.max = String(DEFAULT_MAX_YEAR);
    input.step = '1';
    input.setAttribute('data-testid', `year-${idSuffix}-slider`);
    wrapper.appendChild(input);

    const output = document.createElement('output');
    output.htmlFor = id;
    output.setAttribute('data-testid', `year-${idSuffix}-value`);
    wrapper.appendChild(output);

    return { wrapper, input, output };
  }

  const yearMinSlider = createYearSlider('min', 'From');
  const yearMaxSlider = createYearSlider('max', 'To');
  yearMinSlider.input.value = String(DEFAULT_MIN_YEAR);
  yearMaxSlider.input.value = String(DEFAULT_MAX_YEAR);
  yearMinSlider.output.textContent = String(DEFAULT_MIN_YEAR);
  yearMaxSlider.output.textContent = String(DEFAULT_MAX_YEAR);
  yearGroup.append(yearMinSlider.wrapper, yearMaxSlider.wrapper);

  yearMinSlider.input.addEventListener('input', () => {
    yearMinSlider.output.textContent = yearMinSlider.input.value;
  });
  yearMaxSlider.input.addEventListener('input', () => {
    yearMaxSlider.output.textContent = yearMaxSlider.input.value;
  });
  yearMinSlider.input.addEventListener('change', () => {
    let min = Number(yearMinSlider.input.value);
    const max = Number(yearMaxSlider.input.value);
    if (min > max) {
      min = max;
      yearMinSlider.input.value = String(min);
      yearMinSlider.output.textContent = String(min);
    }
    state.yearMin = min;
    resetAndLoad();
  });
  yearMaxSlider.input.addEventListener('change', () => {
    const min = Number(yearMinSlider.input.value);
    let max = Number(yearMaxSlider.input.value);
    if (max < min) {
      max = min;
      yearMaxSlider.input.value = String(max);
      yearMaxSlider.output.textContent = String(max);
    }
    state.yearMax = max;
    resetAndLoad();
  });

  // Author multi-select dropdown
  const authorGroup = document.createElement('div');
  authorGroup.className = 'filter-group';
  sidebar.appendChild(authorGroup);

  const authorLabel = document.createElement('label');
  authorLabel.htmlFor = 'author-filter';
  authorLabel.textContent = 'Authors';
  authorGroup.appendChild(authorLabel);

  const authorSelect = document.createElement('select');
  authorSelect.id = 'author-filter';
  authorSelect.multiple = true;
  authorSelect.size = 6;
  authorSelect.setAttribute('data-testid', 'author-filter-select');
  authorGroup.appendChild(authorSelect);

  authorSelect.addEventListener('change', () => {
    state.authorIds = new Set(Array.from(authorSelect.selectedOptions, (opt) => Number(opt.value)));
    resetAndLoad();
  });

  // Content: grid + load more
  const content = document.createElement('div');
  content.className = 'books-content';
  layout.appendChild(content);

  const emptyState = document.createElement('p');
  emptyState.className = 'books-empty-state';
  emptyState.setAttribute('data-testid', 'books-empty-state');
  emptyState.textContent = 'No books match your filters.';
  emptyState.hidden = true;
  content.appendChild(emptyState);

  const grid = document.createElement('div');
  grid.className = 'books-grid';
  grid.setAttribute('data-testid', 'books-grid');
  content.appendChild(grid);

  const loadMoreWrapper = document.createElement('div');
  loadMoreWrapper.className = 'books-page__load-more';
  content.appendChild(loadMoreWrapper);

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.type = 'button';
  loadMoreBtn.className = 'btn btn--secondary';
  loadMoreBtn.textContent = 'Load more';
  loadMoreBtn.setAttribute('data-testid', 'load-more-button');
  loadMoreWrapper.appendChild(loadMoreBtn);

  container.appendChild(page);

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

    const titleRow = document.createElement('div');
    titleRow.className = 'book-card__title-row';
    card.appendChild(titleRow);

    const title = document.createElement('h2');
    title.className = 'book-card__title';
    titleRow.appendChild(title);

    const titleLink = document.createElement('a');
    titleLink.href = `/books/${book.id}`;
    titleLink.dataset.link = '';
    titleLink.setAttribute('data-testid', 'book-card-link');
    titleLink.textContent = book.title;
    title.appendChild(titleLink);

    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'icon-btn tooltip-trigger';
    infoBtn.setAttribute('aria-label', 'Book details');
    infoBtn.setAttribute('data-testid', 'book-info-button');
    infoBtn.textContent = 'ⓘ';
    titleRow.appendChild(infoBtn);

    const tooltip = document.createElement('span');
    tooltip.className = 'tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('data-testid', 'book-info-tooltip');
    tooltip.textContent = `ISBN: ${book.isbn}`;
    infoBtn.appendChild(tooltip);

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

  function buildParams(pageNum: number): ListBooksParams {
    return {
      page: pageNum,
      limit: PAGE_SIZE,
      q: state.q || undefined,
      sort: state.sort,
      category: state.categoryIds.size ? [...state.categoryIds] : undefined,
      author: state.authorIds.size ? [...state.authorIds] : undefined,
      available: state.availability === 'all' ? undefined : state.availability === 'available',
      yearMin: state.yearMin !== DEFAULT_MIN_YEAR ? state.yearMin : undefined,
      yearMax: state.yearMax !== DEFAULT_MAX_YEAR ? state.yearMax : undefined,
    };
  }

  async function loadPage(pageNum: number, opts: { reset?: boolean } = {}): Promise<void> {
    const seq = ++requestSeq;
    loadMoreBtn.disabled = true;
    if (opts.reset) grid.innerHTML = '';
    emptyState.hidden = true;
    renderSkeletons(PAGE_SIZE);
    try {
      const result = await apiClient.listBooks(buildParams(pageNum));
      if (seq !== requestSeq) return;
      clearSkeletons();
      for (const book of result.books) renderBookCard(book);
      currentPage = result.pagination.page;
      loadMoreWrapper.hidden = result.pagination.page >= result.pagination.totalPages;
      emptyState.hidden = result.pagination.total > 0;
    } catch (err) {
      if (seq !== requestSeq) return;
      clearSkeletons();
      const message = err instanceof ApiError ? err.message : 'Could not load books.';
      showToast(message, 'error');
    } finally {
      if (seq === requestSeq) loadMoreBtn.disabled = false;
    }
  }

  function resetAndLoad(): void {
    void loadPage(1, { reset: true });
  }

  loadMoreBtn.addEventListener('click', () => {
    void loadPage(currentPage + 1);
  });

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value as BooksSort;
    resetAndLoad();
  });

  async function fetchSuggestions(q: string): Promise<void> {
    if (!q) {
      suggestionsList.hidden = true;
      suggestionsList.innerHTML = '';
      return;
    }
    try {
      const result = await apiClient.listBooks({ q, page: 1, limit: SUGGESTION_LIMIT });
      renderSuggestions(result.books);
    } catch {
      suggestionsList.hidden = true;
    }
  }

  function renderSuggestions(books: Book[]): void {
    suggestionsList.innerHTML = '';
    if (books.length === 0) {
      suggestionsList.hidden = true;
      return;
    }
    for (const book of books) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-bar__suggestion';
      button.setAttribute('data-testid', 'search-suggestion');
      button.textContent = `${book.title} — ${authorNames.get(book.authorId) ?? 'Unknown author'}`;
      button.addEventListener('click', () => {
        searchInput.value = book.title;
        state.q = book.title;
        suggestionsList.hidden = true;
        resetAndLoad();
      });
      item.appendChild(button);
      suggestionsList.appendChild(item);
    }
    suggestionsList.hidden = false;
  }

  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      state.q = searchInput.value.trim();
      void fetchSuggestions(state.q);
      resetAndLoad();
    }, SEARCH_DEBOUNCE_MS);
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      suggestionsList.hidden = true;
    } else if (event.key === 'Enter') {
      window.clearTimeout(searchDebounceTimer);
      state.q = searchInput.value.trim();
      suggestionsList.hidden = true;
      resetAndLoad();
    }
  });

  function handleOutsideClick(event: MouseEvent): void {
    if (!searchWrapper.contains(event.target as Node)) {
      suggestionsList.hidden = true;
    }
  }
  document.addEventListener('click', handleOutsideClick);

  clearFiltersBtn.addEventListener('click', () => {
    state.q = '';
    state.sort = 'title';
    state.categoryIds.clear();
    state.authorIds.clear();
    state.availability = 'all';
    state.yearMin = DEFAULT_MIN_YEAR;
    state.yearMax = DEFAULT_MAX_YEAR;

    searchInput.value = '';
    suggestionsList.hidden = true;
    sortSelect.value = 'title';
    for (const checkbox of categoryGroup.querySelectorAll('input[type="checkbox"]')) {
      (checkbox as HTMLInputElement).checked = false;
    }
    for (const radio of availabilityGroup.querySelectorAll('input[type="radio"]')) {
      (radio as HTMLInputElement).checked = (radio as HTMLInputElement).value === 'all';
    }
    yearMinSlider.input.value = String(DEFAULT_MIN_YEAR);
    yearMaxSlider.input.value = String(DEFAULT_MAX_YEAR);
    yearMinSlider.output.textContent = String(DEFAULT_MIN_YEAR);
    yearMaxSlider.output.textContent = String(DEFAULT_MAX_YEAR);
    authorSelect.selectedIndex = -1;

    resetAndLoad();
  });

  function renderCategoryCheckboxes(categories: Category[]): void {
    for (const category of categories) {
      const optWrapper = document.createElement('div');
      optWrapper.className = 'filter-group__option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `category-${category.id}`;
      checkbox.value = String(category.id);
      checkbox.setAttribute('data-testid', `category-filter-${category.id}`);
      optWrapper.appendChild(checkbox);

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = category.name;
      optWrapper.appendChild(label);

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.categoryIds.add(category.id);
        else state.categoryIds.delete(category.id);
        resetAndLoad();
      });

      categoryGroup.appendChild(optWrapper);
    }
  }

  function renderAuthorOptions(authors: Author[]): void {
    for (const author of authors) {
      const option = document.createElement('option');
      option.value = String(author.id);
      option.textContent = author.name;
      authorSelect.appendChild(option);
    }
  }

  async function init(): Promise<void> {
    try {
      const [authors, categories] = await Promise.all([
        apiClient.listAuthors(),
        apiClient.listCategories(),
      ]);
      authorNames = new Map(authors.map((a) => [a.id, a.name]));
      categoryNames = new Map(categories.map((c) => [c.id, c.name]));
      renderCategoryCheckboxes(categories);
      renderAuthorOptions(authors);
    } catch {
      // Book cards fall back to "Unknown author" / "Uncategorized" labels,
      // and the category/author filter controls are simply left empty.
    }
    await loadPage(currentPage);
  }

  init();

  return () => {
    document.removeEventListener('click', handleOutsideClick);
    window.clearTimeout(searchDebounceTimer);
    container.classList.remove('page-container--wide');
  };
}
