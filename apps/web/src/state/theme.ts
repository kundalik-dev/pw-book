export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'pw_books_theme';

type Listener = (theme: Theme) => void;

const listeners = new Set<Listener>();

function read(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

export function getTheme(): Theme {
  return read();
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  for (const listener of listeners) listener(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = read() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function onThemeChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Applies the persisted theme before first paint; call once at startup. */
export function initTheme(): void {
  document.documentElement.setAttribute('data-theme', read());
}
