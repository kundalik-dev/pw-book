import { getAuthState } from '../../state/auth';
import type {
  AdminUser,
  ApiClient,
  AppUser,
  Author,
  AuthResult,
  Book,
  BookInput,
  Category,
  CreateReviewInput,
  ListBooksParams,
  ListLoansParams,
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

/** Mock user ids are `u-N` strings; the real API's Users.Id is numeric, so admin/customer lookups mirror that. */
function numericUserId(record: MockUserRecord): number {
  return Number(record.id.replace(/^u-/, '')) || 0;
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
  private nextBookId = Math.max(0, ...mockBooks.map((b) => b.id)) + 1;

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

  async createBook(input: BookInput): Promise<Book> {
    const book: Book = {
      id: this.nextBookId++,
      title: input.title,
      isbn: input.isbn,
      authorId: input.authorId,
      categoryIds: input.categoryIds,
      description: input.description ?? null,
      publishedYear: input.publishedYear ?? null,
      coverImageUrl: null,
      totalCopies: input.totalCopies,
      availableCopies: input.totalCopies,
      createdAt: new Date().toISOString(),
    };
    this.books.push(book);
    return delay(book);
  }

  async updateBook(id: number, input: BookInput): Promise<Book> {
    const index = this.books.findIndex((b) => b.id === id);
    if (index === -1) throw new ApiError('Book not found', 'BOOK_NOT_FOUND');
    const existing = this.books[index];
    const updated: Book = {
      ...existing,
      title: input.title,
      isbn: input.isbn,
      authorId: input.authorId,
      categoryIds: input.categoryIds,
      description: input.description ?? null,
      publishedYear: input.publishedYear ?? null,
      totalCopies: input.totalCopies,
      availableCopies: Math.min(existing.availableCopies, input.totalCopies),
    };
    this.books[index] = updated;
    return delay(updated);
  }

  async deleteBook(id: number): Promise<void> {
    const hasActiveLoans = this.loans.some((l) => l.bookId === id && l.status !== 'returned');
    if (hasActiveLoans) {
      throw new ApiError(
        'This book cannot be deleted until all outstanding copies are returned',
        'BOOK_HAS_ACTIVE_LOANS',
      );
    }
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

  async createLoan(bookId: number, dueAt?: string): Promise<Loan> {
    const userId = this.requireUserId();
    const loan: Loan = {
      id: this.nextLoanId++,
      bookId,
      userId,
      borrowedAt: new Date().toISOString(),
      dueAt: dueAt
        ? new Date(dueAt).toISOString()
        : new Date(Date.now() + MOCK_LOAN_PERIOD_DAYS * 86_400_000).toISOString(),
      returnedAt: null,
      returnedToAdminId: null,
      status: 'active',
    };
    this.loans.push(loan);
    return delay(loan);
  }

  async listMyLoans(): Promise<Loan[]> {
    const userId = this.requireUserId();
    return delay(this.loans.filter((l) => l.userId === userId));
  }

  async returnLoan(id: number, receivedByAdminId: number): Promise<Loan> {
    const auth = getAuthState();
    const userId = this.requireUserId();
    const isAdmin = auth?.user.role === 'admin';
    const index = this.loans.findIndex((l) => l.id === id && (isAdmin || l.userId === userId));
    if (index === -1) throw new ApiError('Loan not found', 'LOAN_NOT_FOUND');
    if (this.loans[index].status === 'returned') {
      throw new ApiError('This loan has already been returned', 'LOAN_ALREADY_RETURNED');
    }
    const admin = this.users.find(
      (u) => u.role === 'admin' && numericUserId(u) === receivedByAdminId,
    );
    if (!admin) throw new ApiError('Selected admin not found', 'ADMIN_NOT_FOUND');
    const updated: Loan = {
      ...this.loans[index],
      status: 'returned',
      returnedAt: new Date().toISOString(),
      returnedToAdminId: receivedByAdminId,
    };
    this.loans[index] = updated;
    return delay(updated);
  }

  async listAdmins(): Promise<AdminUser[]> {
    return delay(
      this.users
        .filter((u) => u.role === 'admin')
        .map((u) => ({ id: numericUserId(u), name: u.name, email: u.email })),
    );
  }

  async listAllLoans(params: ListLoansParams = {}): Promise<Loan[]> {
    const filtered = this.loans.filter((l) => {
      if (params.userId !== undefined && l.userId !== params.userId) return false;
      if (params.bookId !== undefined && l.bookId !== params.bookId) return false;
      return true;
    });
    return delay([...filtered].sort((a, b) => b.borrowedAt.localeCompare(a.borrowedAt)));
  }

  async listUsers(): Promise<AppUser[]> {
    return delay(
      [...this.users]
        .map((u) => ({ id: numericUserId(u), name: u.name, email: u.email, role: u.role }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
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
