import { getAuthState } from '../state/auth';
import { mockBooks } from './mock/mockData';
import { ApiError, type Book, type PaginatedBooks } from './types';

// Phase 9 needs a few endpoints (book-by-id, reviews, loans) that predate
// Phase 9 in the API but weren't yet exposed on the shared `ApiClient`
// interface. Kept as a standalone module with its own small request() copy
// (matching HttpApiClient's pattern) instead of editing client.ts/types.ts,
// which Phase 8 work was concurrently modifying — fold these into the main
// ApiClient once that settles.

export interface Review {
  id: number;
  bookId: number;
  userId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface Loan {
  id: number;
  bookId: number;
  userId: number;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: 'active' | 'returned' | 'overdue';
}

interface ErrorBody {
  error: { message: string; code: string };
}

const baseUrl = import.meta.env.VITE_API_BASE_URL;
const useMock = import.meta.env.VITE_USE_MOCK_API === 'true';

async function request<T>(path: string, options: { method: string; body?: unknown }): Promise<T> {
  const auth = getAuthState();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${auth.accessToken}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    throw new ApiError(
      body?.error?.message ?? `Request failed with status ${response.status}`,
      body?.error?.code ?? 'UNKNOWN_ERROR',
    );
  }

  return response.json() as Promise<T>;
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 300));
}

// --- Mock fallback (VITE_USE_MOCK_API=true) --------------------------------
// Kept tiny and in-memory, mirroring MockApiClient's spirit: enough to click
// through Phase 9 screens offline, not a full backend simulation.

const mockReviews: Review[] = [];
const mockLoans: Loan[] = [];
let mockReviewId = 1;
let mockLoanId = 1;

function requireMockUserId(): number {
  const auth = getAuthState();
  if (!auth) throw new ApiError('Not authenticated.', 'UNAUTHENTICATED');
  const parts = auth.accessToken.split('.');
  return Number(parts[1]) || 1;
}

export async function getBook(id: number): Promise<Book> {
  if (useMock) {
    const book = mockBooks.find((b) => b.id === id);
    if (!book) throw new ApiError('Book not found', 'BOOK_NOT_FOUND');
    return delay(book);
  }
  const { book } = await request<{ book: Book }>(`/books/${id}`, { method: 'GET' });
  return book;
}

export async function listBookReviews(bookId: number): Promise<Review[]> {
  if (useMock) return delay(mockReviews.filter((r) => r.bookId === bookId));
  const { reviews } = await request<{ reviews: Review[] }>(`/books/${bookId}/reviews`, {
    method: 'GET',
  });
  return reviews;
}

export async function createReview(
  bookId: number,
  input: { rating: number; comment?: string },
): Promise<Review> {
  if (useMock) {
    const userId = requireMockUserId();
    if (mockReviews.some((r) => r.bookId === bookId && r.userId === userId)) {
      throw new ApiError('You have already reviewed this book', 'REVIEW_ALREADY_EXISTS');
    }
    const review: Review = {
      id: mockReviewId++,
      bookId,
      userId,
      rating: input.rating,
      comment: input.comment ?? null,
      createdAt: new Date().toISOString(),
    };
    mockReviews.unshift(review);
    return delay(review);
  }
  const { review } = await request<{ review: Review }>(`/books/${bookId}/reviews`, {
    method: 'POST',
    body: input,
  });
  return review;
}

export async function deleteReview(id: number): Promise<void> {
  if (useMock) {
    const idx = mockReviews.findIndex((r) => r.id === id);
    if (idx >= 0) mockReviews.splice(idx, 1);
    return delay(undefined);
  }
  await request<void>(`/reviews/${id}`, { method: 'DELETE' });
}

const MOCK_LOAN_PERIOD_DAYS = 14;

export async function createLoan(bookId: number): Promise<Loan> {
  if (useMock) {
    const userId = requireMockUserId();
    const loan: Loan = {
      id: mockLoanId++,
      bookId,
      userId,
      borrowedAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + MOCK_LOAN_PERIOD_DAYS * 86_400_000).toISOString(),
      returnedAt: null,
      status: 'active',
    };
    mockLoans.push(loan);
    return delay(loan);
  }
  const { loan } = await request<{ loan: Loan }>('/loans', { method: 'POST', body: { bookId } });
  return loan;
}

export type AdminBookSort =
  | 'title'
  | '-title'
  | 'publishedYear'
  | '-publishedYear'
  | 'createdAt'
  | '-createdAt';

/**
 * Sortable book listing for the admin data table. `apiClient.listBooks`
 * (Phase 6/8) doesn't expose a `sort` param, so this builds its own query
 * against the same `GET /api/books` endpoint rather than editing that
 * shared client while Phase 8 is mid-flight there.
 */
export async function listBooksSorted(params: {
  page: number;
  limit: number;
  sort: AdminBookSort;
}): Promise<PaginatedBooks> {
  if (useMock) {
    const sorted = [...mockBooks];
    const [key, dir]: [keyof Book, 1 | -1] = params.sort.startsWith('-')
      ? [params.sort.slice(1) as keyof Book, -1]
      : [params.sort as keyof Book, 1];
    sorted.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return av > bv ? dir : -dir;
    });
    const start = (params.page - 1) * params.limit;
    const books = sorted.slice(start, start + params.limit);
    return delay({
      books,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: sorted.length,
        totalPages: Math.max(1, Math.ceil(sorted.length / params.limit)),
      },
    });
  }
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
    sort: params.sort,
  });
  return request<PaginatedBooks>(`/books?${query.toString()}`, { method: 'GET' });
}

export async function deleteBookAdmin(id: number): Promise<void> {
  if (useMock) {
    const idx = mockBooks.findIndex((b) => b.id === id);
    if (idx >= 0) mockBooks.splice(idx, 1);
    return delay(undefined);
  }
  await request<void>(`/books/${id}`, { method: 'DELETE' });
}

export async function listMyLoans(): Promise<Loan[]> {
  if (useMock) {
    const userId = requireMockUserId();
    return delay(mockLoans.filter((l) => l.userId === userId));
  }
  const { loans } = await request<{ loans: Loan[] }>('/loans/me', { method: 'GET' });
  return loans;
}
