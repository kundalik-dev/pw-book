import { getAuthState } from '../../state/auth';
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
const MOCK_LOAN_PERIOD_DAYS = 14;

export class MockApiClient implements ApiClient {
  private users: MockUserRecord[] = [...mockUsers];
  private books: Book[] = [...mockBooks];
  private reviews: Review[] = [];
  private loans: Loan[] = [];
  private nextReviewId = 1;
  private nextLoanId = 1;

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

    let filtered = this.books.filter((b) => {
      if (q) {
        const authorName = mockAuthors.find((a) => a.id === b.authorId)?.name ?? '';
        const matchesQ =
          b.title.toLowerCase().includes(q) ||
          authorName.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q);
        if (!matchesQ) return false;
      }
      if (params.category?.length && !params.category.some((id) => b.categoryIds.includes(id))) {
        return false;
      }
      if (params.author?.length && !params.author.includes(b.authorId)) return false;
      if (params.available !== undefined) {
        const isAvailable = b.availableCopies > 0;
        if (isAvailable !== params.available) return false;
      }
      if (params.yearMin !== undefined && (b.publishedYear ?? -Infinity) < params.yearMin) {
        return false;
      }
      if (params.yearMax !== undefined && (b.publishedYear ?? Infinity) > params.yearMax) {
        return false;
      }
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      switch (params.sort) {
        case '-title':
          return b.title.localeCompare(a.title);
        case 'publishedYear':
          return (a.publishedYear ?? 0) - (b.publishedYear ?? 0);
        case '-publishedYear':
          return (b.publishedYear ?? 0) - (a.publishedYear ?? 0);
        case 'createdAt':
          return a.createdAt.localeCompare(b.createdAt);
        case '-createdAt':
          return b.createdAt.localeCompare(a.createdAt);
        default:
          return a.title.localeCompare(b.title);
      }
    });

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

  async getBook(id: number): Promise<Book> {
    const book = this.books.find((b) => b.id === id);
    if (!book) throw new ApiError('Book not found', 'BOOK_NOT_FOUND');
    return delay(book);
  }

  async deleteBook(id: number): Promise<void> {
    this.books = this.books.filter((b) => b.id !== id);
    return delay(undefined);
  }

  async listBookReviews(bookId: number): Promise<Review[]> {
    return delay(this.reviews.filter((r) => r.bookId === bookId));
  }

  async createReview(bookId: number, input: CreateReviewInput): Promise<Review> {
    const userId = this.requireUserId();
    if (this.reviews.some((r) => r.bookId === bookId && r.userId === userId)) {
      throw new ApiError('You have already reviewed this book', 'REVIEW_ALREADY_EXISTS');
    }
    const review: Review = {
      id: this.nextReviewId++,
      bookId,
      userId,
      rating: input.rating,
      comment: input.comment ?? null,
      createdAt: new Date().toISOString(),
    };
    this.reviews.unshift(review);
    return delay(review);
  }

  async deleteReview(id: number): Promise<void> {
    this.reviews = this.reviews.filter((r) => r.id !== id);
    return delay(undefined);
  }

  async createLoan(bookId: number): Promise<Loan> {
    const userId = this.requireUserId();
    const loan: Loan = {
      id: this.nextLoanId++,
      bookId,
      userId,
      borrowedAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + MOCK_LOAN_PERIOD_DAYS * 86_400_000).toISOString(),
      returnedAt: null,
      status: 'active',
    };
    this.loans.push(loan);
    return delay(loan);
  }

  async listMyLoans(): Promise<Loan[]> {
    const userId = this.requireUserId();
    return delay(this.loans.filter((l) => l.userId === userId));
  }

  async resetSystem(): Promise<ResetSummary> {
    this.users = [...mockUsers];
    this.books = [...mockBooks];
    this.reviews = [];
    this.loans = [];
    this.nextReviewId = 1;
    this.nextLoanId = 1;
    return delay({
      authors: mockAuthors.length,
      categories: mockCategories.length,
      books: mockBooks.length,
      users: mockUsers.length,
      loans: 0,
      reviews: 0,
    });
  }

  private requireUserId(): number {
    const auth = getAuthState();
    if (!auth) throw new ApiError('Not authenticated.', 'UNAUTHENTICATED');
    const userId = userIdFromToken(auth.accessToken);
    return Number(userId) || 1;
  }

  private toAuthResult(record: MockUserRecord): AuthResult {
    return {
      user: toPublicUser(record),
      accessToken: makeToken(record.id),
      refreshToken: makeToken(record.id),
    };
  }
}
