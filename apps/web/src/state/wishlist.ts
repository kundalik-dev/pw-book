const STORAGE_KEY = 'pw_books_wishlist';

export interface WishlistItem {
  bookId: number;
  addedAt: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();

function read(): WishlistItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: WishlistItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  for (const listener of listeners) listener();
}

export function listWishlist(): WishlistItem[] {
  return read();
}

export function isWishlisted(bookId: number): boolean {
  return read().some((item) => item.bookId === bookId);
}

export function addToWishlist(bookId: number): void {
  const items = read();
  if (items.some((item) => item.bookId === bookId)) return;
  items.push({ bookId, addedAt: new Date().toISOString() });
  write(items);
}

export function removeFromWishlist(bookId: number): void {
  write(read().filter((item) => item.bookId !== bookId));
}

/** Moves the item at `fromIndex` to `toIndex`, used by drag-and-drop reordering. */
export function reorderWishlist(fromIndex: number, toIndex: number): void {
  const items = read();
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return;
  }
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  write(items);
}

export function onWishlistChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
