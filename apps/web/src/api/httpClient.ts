import { getAuthState } from '../state/auth';
import type {
  ApiClient,
  Author,
  AuthResult,
  Book,
  Category,
  CreateReviewInput,
  ListBooksParams,
  Loan,
  LoginInput,
  PaginatedBooks,
  RegisterInput,
  ResetSummary,
  Review,
  User,
} from './types';
import { ApiError } from './types';

interface ErrorBody {
  error: { message: string; code: string };
}

export class HttpApiClient implements ApiClient {
  constructor(private readonly baseUrl: string) {}

  register(input: RegisterInput): Promise<AuthResult> {
    return this.request<AuthResult>('/auth/register', { method: 'POST', body: input });
  }

  login(input: LoginInput): Promise<AuthResult> {
    return this.request<AuthResult>('/auth/login', { method: 'POST', body: input });
  }

  me(): Promise<User> {
    return this.request<User>('/auth/me', { method: 'GET' });
  }

  listBooks(params: ListBooksParams): Promise<PaginatedBooks> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.q) query.set('q', params.q);
    if (params.sort) query.set('sort', params.sort);
    if (params.yearMin !== undefined) query.set('yearMin', String(params.yearMin));
    if (params.yearMax !== undefined) query.set('yearMax', String(params.yearMax));
    if (params.available !== undefined) query.set('available', String(params.available));
    for (const id of params.category ?? []) query.append('category', String(id));
    for (const id of params.author ?? []) query.append('author', String(id));
    const qs = query.toString();
    return this.request<PaginatedBooks>(`/books${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async listAuthors(): Promise<Author[]> {
    const { authors } = await this.request<{ authors: Author[] }>('/authors', { method: 'GET' });
    return authors;
  }

  async listCategories(): Promise<Category[]> {
    const { categories } = await this.request<{ categories: Category[] }>('/categories', {
      method: 'GET',
    });
    return categories;
  }

  async getBook(id: number): Promise<Book> {
    const { book } = await this.request<{ book: Book }>(`/books/${id}`, { method: 'GET' });
    return book;
  }

  async deleteBook(id: number): Promise<void> {
    await this.request<void>(`/books/${id}`, { method: 'DELETE' });
  }

  async listBookReviews(bookId: number): Promise<Review[]> {
    const { reviews } = await this.request<{ reviews: Review[] }>(`/books/${bookId}/reviews`, {
      method: 'GET',
    });
    return reviews;
  }

  async createReview(bookId: number, input: CreateReviewInput): Promise<Review> {
    const { review } = await this.request<{ review: Review }>(`/books/${bookId}/reviews`, {
      method: 'POST',
      body: input,
    });
    return review;
  }

  async deleteReview(id: number): Promise<void> {
    await this.request<void>(`/reviews/${id}`, { method: 'DELETE' });
  }

  async createLoan(bookId: number): Promise<Loan> {
    const { loan } = await this.request<{ loan: Loan }>('/loans', {
      method: 'POST',
      body: { bookId },
    });
    return loan;
  }

  async listMyLoans(): Promise<Loan[]> {
    const { loans } = await this.request<{ loans: Loan[] }>('/loans/me', { method: 'GET' });
    return loans;
  }

  async resetSystem(): Promise<ResetSummary> {
    const { summary } = await this.request<{ summary: ResetSummary }>('/system/reset', {
      method: 'POST',
    });
    return summary;
  }

  private async request<T>(path: string, options: { method: string; body?: unknown }): Promise<T> {
    const auth = getAuthState();
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = `Bearer ${auth.accessToken}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
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

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
