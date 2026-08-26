export type Role = 'member' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Book {
  id: number;
  title: string;
  isbn: string;
  authorId: number;
  categoryIds: number[];
  description: string | null;
  publishedYear: number | null;
  coverImageUrl: string | null;
  totalCopies: number;
  availableCopies: number;
  createdAt: string;
}

export interface Author {
  id: number;
  name: string;
  bio: string | null;
}

export interface Category {
  id: number;
  name: string;
}

export interface BooksPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedBooks {
  books: Book[];
  pagination: BooksPagination;
}

export type BooksSort =
  | 'title'
  | '-title'
  | 'publishedYear'
  | '-publishedYear'
  | 'createdAt'
  | '-createdAt';

export interface ListBooksParams {
  page?: number;
  limit?: number;
  q?: string;
  sort?: BooksSort;
  category?: number[];
  author?: number[];
  yearMin?: number;
  yearMax?: number;
  available?: boolean;
}

export interface BookInput {
  title: string;
  isbn: string;
  authorId: number;
  categoryIds: number[];
  description?: string;
  publishedYear?: number;
  totalCopies: number;
}

export interface Review {
  id: number;
  bookId: number;
  userId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface CreateReviewInput {
  rating: number;
  comment?: string;
}

export interface Loan {
  id: number;
  bookId: number;
  userId: number;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  returnedToAdminId: number | null;
  status: 'active' | 'returned' | 'overdue';
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
}

export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface ListLoansParams {
  userId?: number;
  bookId?: number;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Matches the API's `{ error: { message, code } }` response shape (see CLAUDE.md). */
export class ApiError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export interface ResetSummary {
  authors: number;
  categories: number;
  books: number;
  users: number;
  loans: number;
  reviews: number;
}

export interface ApiClient {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  me(): Promise<User>;
  listBooks(params: ListBooksParams): Promise<PaginatedBooks>;
  listAuthors(): Promise<Author[]>;
  listCategories(): Promise<Category[]>;
  getBook(id: number): Promise<Book>;
  createBook(input: BookInput): Promise<Book>;
  updateBook(id: number, input: BookInput): Promise<Book>;
  deleteBook(id: number): Promise<void>;
  listBookReviews(bookId: number): Promise<Review[]>;
  createReview(bookId: number, input: CreateReviewInput): Promise<Review>;
  deleteReview(id: number): Promise<void>;
  createLoan(bookId: number, dueAt?: string): Promise<Loan>;
  listMyLoans(): Promise<Loan[]>;
  returnLoan(id: number, receivedByAdminId: number): Promise<Loan>;
  listAdmins(): Promise<AdminUser[]>;
  /** Admin-only: all orders across every customer, optionally narrowed to one user or one book. */
  listAllLoans(params?: ListLoansParams): Promise<Loan[]>;
  /** Admin-only: every user, for the admin Orders page's customer lookups. */
  listUsers(): Promise<AppUser[]>;
  /** CSV export of the current user's own orders — the "My orders" page's export button. */
  exportMyLoansCsv(): Promise<Blob>;
  /** Admin-only: CSV export of every order across every customer. */
  exportAllLoansCsv(): Promise<Blob>;
  resetSystem(): Promise<ResetSummary>;
}
