import { getAuthState } from '../state/auth';
import type {
  ApiClient,
  Author,
  AuthResult,
  Category,
  ListBooksParams,
  LoginInput,
  PaginatedBooks,
  RegisterInput,
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

    return response.json() as Promise<T>;
  }
}
