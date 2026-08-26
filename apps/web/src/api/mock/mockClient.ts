import { getAuthState } from '../../state/auth';
import type {
  ApiClient,
  AuthResult,
  ListBooksParams,
  LoginInput,
  PaginatedBooks,
  RegisterInput,
  User,
} from '../types';
import { ApiError } from '../types';
import { type MockUserRecord, mockBooks, mockUsers } from './mockData';

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
 * Stands in for the real backend (Phases 1-5 of docs/tasks/01-mvp-build-plan.md
 * aren't built yet). Mutates in-memory copies so register/login feel real across
 * a session, but nothing persists past a page reload.
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
      ? mockBooks.filter(
          (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q),
        )
      : mockBooks;

    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return delay({
      items,
      page,
      limit,
      total: filtered.length,
      hasMore: start + items.length < filtered.length,
    });
  }

  private toAuthResult(record: MockUserRecord): AuthResult {
    return {
      user: toPublicUser(record),
      accessToken: makeToken(record.id),
      refreshToken: makeToken(record.id),
    };
  }
}
