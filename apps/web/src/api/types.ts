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
  status: 'active' | 'returned' | 'overdue';
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
  deleteBook(id: number): Promise<void>;
  listBookReviews(bookId: number): Promise<Review[]>;
  createReview(bookId: number, input: CreateReviewInput): Promise<Review>;
  deleteReview(id: number): Promise<void>;
  createLoan(bookId: number): Promise<Loan>;
  listMyLoans(): Promise<Loan[]>;
  resetSystem(): Promise<ResetSummary>;
}
