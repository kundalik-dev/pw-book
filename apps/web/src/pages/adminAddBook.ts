import { apiClient } from '../api/client';
import type { Author, Category } from '../api/types';
import { createBookForm } from '../components/bookForm';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import '../styles/phase9.css';

export function renderAdminAddBookPage(container: HTMLElement): void {
  const auth = getAuthState();
  if (auth?.user.role !== 'admin') {
    showToast('Admin access required.', 'error');
    navigate('/books');
    return;
  }

  const page = document.createElement('div');
  page.className = 'admin-form-page';
  page.setAttribute('data-testid', 'admin-add-book-page');
  container.appendChild(page);

  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'breadcrumbs';
  breadcrumb.setAttribute('aria-label', 'Breadcrumb');
  breadcrumb.setAttribute('data-testid', 'breadcrumbs');
  page.appendChild(breadcrumb);

  const home = document.createElement('a');
  home.href = '/admin';
  home.dataset.link = '';
  home.textContent = 'Admin';
  breadcrumb.appendChild(home);

  const sep = document.createElement('span');
  sep.className = 'breadcrumbs__separator';
  sep.textContent = '/';
  breadcrumb.appendChild(sep);

  const current = document.createElement('span');
  current.className = 'breadcrumbs__current';
  current.setAttribute('aria-current', 'page');
  current.textContent = 'Add book';
  breadcrumb.appendChild(current);

  const card = document.createElement('div');
  card.className = 'admin-form-page__card';
  page.appendChild(card);

  const heading = document.createElement('h1');
  heading.textContent = 'Add book';
  card.appendChild(heading);

  const loading = document.createElement('p');
  loading.textContent = 'Loading form…';
  card.appendChild(loading);

  async function init(): Promise<void> {
    let authors: Author[];
    let categories: Category[];
    try {
      [authors, categories] = await Promise.all([
        apiClient.listAuthors(),
        apiClient.listCategories(),
      ]);
    } catch {
      loading.textContent = 'Could not load authors/categories.';
      return;
    }
    loading.remove();

    const bookForm = createBookForm(null, authors, categories);
    card.appendChild(bookForm.element);

    const actions = document.createElement('div');
    actions.className = 'admin-form-page__actions';
    bookForm.element.appendChild(actions);

    const cancelBtn = document.createElement('a');
    cancelBtn.href = '/admin';
    cancelBtn.dataset.link = '';
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('data-testid', 'book-form-cancel');
    actions.appendChild(cancelBtn);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn--primary';
    submitBtn.textContent = 'Create book';
    submitBtn.setAttribute('data-testid', 'book-form-submit');
    actions.appendChild(submitBtn);

    bookForm.element.addEventListener('submit', (event) => {
      event.preventDefault();
      void (async () => {
        submitBtn.disabled = true;
        const saved = await bookForm.save();
        submitBtn.disabled = false;
        if (saved) {
          showToast('Book created.', 'success');
          navigate('/admin');
        }
      })();
    });

    bookForm.focusFirst();
  }

  void init();
}
