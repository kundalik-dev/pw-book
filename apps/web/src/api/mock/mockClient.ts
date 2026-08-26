import { getAuthState } from '../../state/auth';
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
} from '../types';
import { ApiError } from '../types';
import { type MockUserRecord, mockAuthors, mockBooks, mockCategories, mockUsers } from './mockData';

const MOCK_LATENCY_MS = 300;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

function toPublicUser(record: MockUserRecord): User {
  const { password: _password, ...user } = record;
  return user;
}

function makeToken(userId: string): string {
  return `mock-token.${userId}.${Date.now()}`;
}

function userIdFromToken(token: string): string | null {
  const parts = token.split('.');
  return parts.length >= 2 ? parts[1] : null;
}

/**
 * Optional stand-in for the real backend, for offline work or when the local
 * SQL Server instance isn't running (opt in via VITE_USE_MOCK_API=true).
 * Mutates in-memory copies so register/login feel real across a session, but
 * nothing persists past a page reload.
 */
export class MockApiClient implements ApiClient {
  private users: MockUserRecord[] = [...mockUsers];

  async register(input: RegisterInput): Promise<AuthResult> {
    if (this.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new ApiError('An account with this email already exists.', 'EMAIL_TAKEN');
    }
    const record: MockUserRecord = {
      id: `u-${this.users.length + 1}`,
      name: input.name,
      email: input.email,
      role: 'member',
      password: input.password,
    };
    this.users.push(record);
    return delay(this.toAuthResult(record));
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const record = this.users.find((u) => u.email.toLowerCase() === input.email.toLowerCase());
    if (!record || record.password !== input.password) {
      throw new ApiError('Invalid email or password.', 'INVALID_CREDENTIALS');
    }
    return delay(this.toAuthResult(record));
  }

  async me(): Promise<User> {
    const auth = getAuthState();
    if (!auth) {
      throw new ApiError('Not authenticated.', 'UNAUTHENTICATED');
    }
    const userId = userIdFromToken(auth.accessToken);
    const record = this.users.find((u) => u.id === userId);
    if (!record) {
      throw new ApiError('Not authenticated.', 'UNAUTHENTICATED');
    }
    return delay(toPublicUser(record));
  }

  async listBooks(params: ListBooksParams): Promise<PaginatedBooks> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 8;
    const q = params.q?.trim().toLowerCase();

    const filtered = q
      ? mockBooks.filter((b) => {
          const authorName = mockAuthors.find((a) => a.id === b.authorId)?.name ?? '';
          return b.title.toLowerCase().includes(q) || authorName.toLowerCase().includes(q);
        })
      : mockBooks;

    const start = (page - 1) * limit;
    const books = filtered.slice(start, start + limit);

    return delay({
      books,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      },
    });
  }

  async listAuthors(): Promise<Author[]> {
    return delay([...mockAuthors]);
  }

  async listCategories(): Promise<Category[]> {
    return delay([...mockCategories]);
  }

  private toAuthResult(record: MockUserRecord): AuthResult {
    return {
      user: toPublicUser(record),
      accessToken: makeToken(record.id),
      refreshToken: makeToken(record.id),
    };
  }
}
