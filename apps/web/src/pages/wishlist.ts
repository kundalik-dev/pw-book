import { getBook } from '../api/extraClient';
import type { Book } from '../api/types';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import { listWishlist, removeFromWishlist, reorderWishlist } from '../state/wishlist';
import '../styles/phase9.css';

export function renderWishlistPage(container: HTMLElement): void {
  if (!getAuthState()) {
    showToast('Log in to view your wishlist.', 'error');
    navigate('/login');
    return;
  }

  const page = document.createElement('div');
  page.className = 'wishlist-page';
  page.setAttribute('data-testid', 'wishlist-page');
  container.appendChild(page);

  const heading = document.createElement('h1');
  heading.textContent = 'Your wishlist';
  page.appendChild(heading);

  const hint = document.createElement('p');
  hint.className = 'wishlist-page__hint';
  hint.textContent = 'Drag items to reorder them.';
  page.appendChild(hint);

  const list = document.createElement('ul');
  list.className = 'wishlist-list';
  list.setAttribute('data-testid', 'wishlist-list');
  page.appendChild(list);

  let dragFromIndex: number | null = null;

  async function load(): Promise<void> {
    const items = listWishlist();
    list.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.setAttribute('data-testid', 'wishlist-empty');
      empty.textContent = 'Your wishlist is empty. Add books from their detail page.';
      list.appendChild(empty);
      return;
    }

    const books = await Promise.all(
      items.map((item) => getBook(item.bookId).catch((): Book | null => null)),
    );

    items.forEach((item, index) => {
      const book = books[index];
      const li = document.createElement('li');
      li.className = 'wishlist-list__item';
      li.draggable = true;
      li.setAttribute('data-testid', `wishlist-item-${item.bookId}`);
      li.dataset.index = String(index);

      const title = document.createElement('span');
      title.className = 'wishlist-list__title';
      title.textContent = book?.title ?? `Book #${item.bookId}`;
      li.appendChild(title);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn--secondary';
      removeBtn.textContent = 'Remove';
      removeBtn.setAttribute('data-testid', `wishlist-remove-${item.bookId}`);
      removeBtn.addEventListener('click', () => {
        removeFromWishlist(item.bookId);
        load();
      });
      li.appendChild(removeBtn);

      li.addEventListener('dragstart', (event) => {
        dragFromIndex = index;
        event.dataTransfer?.setData('text/plain', String(index));
        li.classList.add('wishlist-list__item--dragging');
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('wishlist-list__item--dragging');
        dragFromIndex = null;
      });
      li.addEventListener('dragover', (event) => {
        event.preventDefault();
        li.classList.add('wishlist-list__item--drop-target');
      });
      li.addEventListener('dragleave', () => {
        li.classList.remove('wishlist-list__item--drop-target');
      });
      li.addEventListener('drop', (event) => {
        event.preventDefault();
        li.classList.remove('wishlist-list__item--drop-target');
        if (dragFromIndex === null || dragFromIndex === index) return;
        reorderWishlist(dragFromIndex, index);
        load();
      });

      list.appendChild(li);
    });
  }

  load();
}
