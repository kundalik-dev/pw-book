import type { AuthResult, User } from '../api/types';

const STORAGE_KEY = 'pw_books_auth';

interface StoredAuth {
  user: User;
  accessToken: string;
  refreshToken: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();

function read(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function getAuthState(): StoredAuth | null {
  return read();
}

export function isAuthenticated(): boolean {
  return read() !== null;
}

export function setAuthState(result: AuthResult): void {
  const stored: StoredAuth = {
    user: result.user,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  notify();
}

export function clearAuthState(): void {
  localStorage.removeItem(STORAGE_KEY);
  notify();
}

export function onAuthChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}
