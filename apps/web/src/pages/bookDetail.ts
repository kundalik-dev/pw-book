import { apiClient } from '../api/client';
import type { Book, Review } from '../api/types';
import { ApiError } from '../api/types';
import { createCarousel } from '../components/carousel';
import { openModal } from '../components/modal';
import { createStarRating } from '../components/starRating';
import { createTabs } from '../components/tabs';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import { addToWishlist, isWishlisted } from '../state/wishlist';
import '../styles/phase9.css';

export function renderBookDetailPage(container: HTMLElement, params: Record<string, string>): void {
  const bookId = Number(params.id);
  const page = document.createElement('div');
  page.className = 'book-detail';
  page.setAttribute('data-testid', 'book-detail-page');
  container.appendChild(page);

  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'breadcrumbs';
  breadcrumb.setAttribute('aria-label', 'Breadcrumb');
  breadcrumb.setAttribute('data-testid', 'breadcrumbs');
  page.appendChild(breadcrumb);

  const loading = document.createElement('p');
  loading.textContent = 'Loading book…';
  page.appendChild(loading);

  async function init(): Promise<void> {
    try {
      const [book, authors, categories] = await Promise.all([
        apiClient.getBook(bookId),
        apiClient.listAuthors(),
        apiClient.listCategories(),
      ]);
      loading.remove();
      const authorName = authors.find((a) => a.id === book.authorId)?.name ?? 'Unknown author';
      const categoryLabels = book.categoryIds.map(
        (id) => categories.find((c) => c.id === id)?.name ?? 'Uncategorized',
      );
      renderBreadcrumb(book);
      renderBody(book, authorName, categoryLabels);
    } catch (err) {
      loading.textContent = err instanceof ApiError ? err.message : 'Could not load this book.';
    }
  }

  function renderBreadcrumb(book: Book): void {
    breadcrumb.innerHTML = '';
    const home = document.createElement('a');
    home.href = '/books';
    home.dataset.link = '';
    home.textContent = 'Books';
    breadcrumb.appendChild(home);

    const sep = document.createElement('span');
    sep.className = 'breadcrumbs__separator';
    sep.textContent = '/';
    breadcrumb.appendChild(sep);

    const current = document.createElement('span');
    current.className = 'breadcrumbs__current';
    current.setAttribute('aria-current', 'page');
    current.textContent = book.title;
    breadcrumb.appendChild(current);
  }

  function renderBody(book: Book, authorName: string, categoryLabels: string[]): void {
    const layout = document.createElement('div');
    layout.className = 'book-detail__layout';
    page.appendChild(layout);

    const slides: HTMLElement[] = [];
    if (book.coverImageUrl) {
      const img = document.createElement('img');
      img.src = book.coverImageUrl;
      img.alt = `${book.title} cover`;
      slides.push(img);
    }
    // No real image-gallery data model exists yet — these placeholder slides
    // keep the carousel exercisable (>1 slide) even for books with no cover.
    for (const label of ['Back cover', 'Inside pages']) {
      const placeholder = document.createElement('div');
      placeholder.className = 'book-detail__placeholder-slide';
      placeholder.textContent = label;
      slides.push(placeholder);
    }
    const carousel = createCarousel({ slides, testId: 'cover-carousel' });
    layout.appendChild(carousel.element);

    const main = document.createElement('div');
    main.className = 'book-detail__main';
    layout.appendChild(main);

    const heading = document.createElement('h1');
    heading.textContent = book.title;
    main.appendChild(heading);

    const actions = document.createElement('div');
    actions.className = 'book-detail__actions';
    main.appendChild(actions);

    const borrowBtn = document.createElement('button');
    borrowBtn.type = 'button';
    borrowBtn.className = 'btn btn--primary';
    borrowBtn.textContent = 'Borrow this book';
    borrowBtn.disabled = book.availableCopies <= 0;
    borrowBtn.setAttribute('data-testid', 'borrow-button');
    borrowBtn.addEventListener('click', () => navigate(`/borrow/${book.id}`));
    actions.appendChild(borrowBtn);

    const wishlistBtn = document.createElement('button');
    wishlistBtn.type = 'button';
    wishlistBtn.className = 'btn btn--secondary';
    wishlistBtn.setAttribute('data-testid', 'add-to-wishlist-button');
    wishlistBtn.title = 'Add to wishlist';
    wishlistBtn.setAttribute('aria-label', 'Add to wishlist');
    wishlistBtn.textContent = isWishlisted(book.id) ? 'On your wishlist' : 'Add to wishlist';
    wishlistBtn.disabled = isWishlisted(book.id);
    wishlistBtn.addEventListener('click', () => {
      if (!getAuthState()) {
        showToast('Log in to use your wishlist.', 'error');
        navigate('/login');
        return;
      }
      openAddToWishlistModal(book, wishlistBtn);
    });
    actions.appendChild(wishlistBtn);

    const tabs = createTabs({
      testId: 'book-detail-tabs',
      tabs: [
        {
          id: 'details',
          label: 'Details',
          render: (panel) => renderDetailsTab(panel, book, authorName, categoryLabels),
        },
        {
          id: 'reviews',
          label: 'Reviews',
          render: (panel) => renderReviewsTab(panel, book),
        },
      ],
    });
    main.appendChild(tabs.element);

    renderLocationPanel(page);
  }

  function openAddToWishlistModal(book: Book, triggerBtn: HTMLButtonElement): void {
    const body = document.createElement('p');
    body.textContent = `Add "${book.title}" to your wishlist?`;
    const modal = openModal({
      title: 'Add to wishlist',
      testId: 'add-to-wishlist-modal',
      content: body,
      actions: [
        { label: 'Cancel', variant: 'secondary', onClick: () => modal.close() },
        {
          label: 'Add',
          variant: 'primary',
          testId: 'add-to-wishlist-confirm',
          onClick: () => {
            addToWishlist(book.id);
            showToast(`Added "${book.title}" to your wishlist.`, 'success');
            triggerBtn.textContent = 'On your wishlist';
            triggerBtn.disabled = true;
            modal.close();
          },
        },
      ],
    });
  }

  function renderDetailsTab(
    panel: HTMLElement,
    book: Book,
    authorName: string,
    categoryLabels: string[],
  ): void {
    const dl = document.createElement('dl');
    dl.className = 'book-detail__facts';

    const facts: Array<[string, string]> = [
      ['Author', authorName],
      ['Categories', categoryLabels.join(', ') || 'Uncategorized'],
      ['ISBN', book.isbn],
      ['Published', book.publishedYear ? String(book.publishedYear) : 'Unknown'],
      [
        'Availability',
        book.availableCopies > 0
          ? `${book.availableCopies} of ${book.totalCopies} available`
          : 'Unavailable',
      ],
    ];
    for (const [term, value] of facts) {
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = value;
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    panel.appendChild(dl);

    const description = document.createElement('p');
    description.className = 'book-detail__description';
    description.textContent = book.description ?? 'No description available.';
    panel.appendChild(description);
  }

  function renderReviewsTab(panel: HTMLElement, book: Book): void {
    const list = document.createElement('ul');
    list.className = 'review-list';
    list.setAttribute('data-testid', 'review-list');
    panel.appendChild(list);

    const status = document.createElement('p');
    status.textContent = 'Loading reviews…';
    panel.appendChild(status);

    async function loadReviews(): Promise<void> {
      try {
        const reviews = await apiClient.listBookReviews(book.id);
        status.remove();
        list.innerHTML = '';
        if (reviews.length === 0) {
          const empty = document.createElement('li');
          empty.className = 'review-list__empty';
          empty.textContent = 'No reviews yet.';
          list.appendChild(empty);
        }
        for (const review of reviews) renderReviewItem(review);
      } catch {
        status.textContent = 'Could not load reviews.';
      }
    }

    function renderReviewItem(review: Review): void {
      const item = document.createElement('li');
      item.className = 'review-list__item';
      item.setAttribute('data-testid', 'review-item');

      const stars = createStarRating({ value: review.rating, readonly: true });
      item.appendChild(stars.element);

      if (review.comment) {
        const comment = document.createElement('p');
        comment.className = 'review-list__comment';
        comment.textContent = review.comment;
        item.appendChild(comment);
      }

      const date = document.createElement('p');
      date.className = 'review-list__date';
      date.textContent = new Date(review.createdAt).toLocaleDateString();
      item.appendChild(date);

      list.appendChild(item);
    }

    if (getAuthState()) {
      const form = document.createElement('form');
      form.className = 'review-form';
      form.setAttribute('data-testid', 'review-form');
      panel.appendChild(form);

      const label = document.createElement('p');
      label.textContent = 'Leave a review';
      form.appendChild(label);

      const stars = createStarRating({ testId: 'review-form-rating' });
      form.appendChild(stars.element);

      const comment = document.createElement('textarea');
      comment.placeholder = 'Optional comment';
      comment.setAttribute('data-testid', 'review-form-comment');
      form.appendChild(comment);

      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'btn btn--primary';
      submit.textContent = 'Submit review';
      submit.setAttribute('data-testid', 'review-form-submit');
      form.appendChild(submit);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const rating = stars.getValue();
        if (rating === 0) {
          showToast('Pick a star rating first.', 'error');
          return;
        }
        submit.disabled = true;
        try {
          await apiClient.createReview(book.id, {
            rating,
            comment: comment.value.trim() || undefined,
          });
          showToast('Review submitted.', 'success');
          form.reset();
          stars.setValue(0);
          await loadReviews();
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Could not submit review.';
          showToast(message, 'error');
        } finally {
          submit.disabled = false;
        }
      });
    }

    loadReviews();
  }

  function renderLocationPanel(host: HTMLElement): void {
    const section = document.createElement('section');
    section.className = 'library-location';
    host.appendChild(section);

    const heading = document.createElement('h2');
    heading.textContent = 'Library location';
    section.appendChild(heading);

    const iframe = document.createElement('iframe');
    iframe.src = '/library-location.html';
    iframe.title = 'Library location placeholder';
    iframe.className = 'library-location__frame';
    iframe.setAttribute('data-testid', 'library-location-iframe');
    section.appendChild(iframe);
  }

  init();
}
