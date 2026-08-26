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

export interface ListBooksParams {
  page?: number;
  limit?: number;
  q?: string;
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

export interface ApiClient {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  me(): Promise<User>;
  listBooks(params: ListBooksParams): Promise<PaginatedBooks>;
  listAuthors(): Promise<Author[]>;
  listCategories(): Promise<Category[]>;
}
