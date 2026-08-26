import type { Book, User } from '../types';

export interface MockUserRecord extends User {
  password: string;
}

export const mockUsers: MockUserRecord[] = [
  {
    id: 'u-1',
    name: 'Admin User',
    email: 'admin@pw-books.dev',
    role: 'admin',
    password: 'admin123',
  },
  {
    id: 'u-2',
    name: 'Member User',
    email: 'member@pw-books.dev',
    role: 'member',
    password: 'member123',
  },
];

const authors = [
  'Ursula K. Le Guin',
  'Isaac Asimov',
  'Octavia E. Butler',
  'Neal Stephenson',
  'Toni Morrison',
  'Haruki Murakami',
  'Agatha Christie',
  'Frank Herbert',
];

const categories = ['Fiction', 'Non-fiction', 'Sci-Fi', 'Mystery', 'Fantasy', 'Biography'];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export const mockBooks: Book[] = Array.from({ length: 24 }, (_, i) => {
  const id = `b-${i + 1}`;
  const totalCopies = (i % 5) + 1;
  const availableCopies = i % 7 === 0 ? 0 : Math.max(0, totalCopies - (i % 3));
  return {
    id,
    title: `Book Title ${i + 1}`,
    isbn: `978-0-${(100000 + i).toString().padStart(6, '0')}-0`,
    author: pick(authors, i),
    categories: [pick(categories, i), pick(categories, i + 2)].filter(
      (c, idx, self) => self.indexOf(c) === idx,
    ),
    description:
      'A placeholder description used for Playwright practice — this is mock data, not a real catalogue entry.',
    publishedYear: 1980 + ((i * 3) % 45),
    coverImageUrl: null,
    totalCopies,
    availableCopies,
  };
});
