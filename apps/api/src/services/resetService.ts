import fs from 'node:fs/promises';
import sql from 'mssql';
import { requirePool } from '../db/requirePool';
import { UPLOAD_DIR } from '../middleware/upload';
import { hashPassword } from '../utils/password';

// Mirrors apps/db/scripts/seed.js's dataset. Duplicated rather than shared
// across the two workspaces (see CLAUDE.md: distinct, learnable surface over
// DRY) — this lets the API reset+reseed over its own pool/transaction
// instead of shelling out to a sibling workspace's script.
const AUTHORS = [
  { name: 'Jane Austen', bio: 'English novelist known for her social commentary and wit.' },
  { name: 'George Orwell', bio: 'English novelist and essayist, known for dystopian fiction.' },
  { name: 'Isaac Asimov', bio: 'American writer and professor, prolific in science fiction.' },
  { name: 'Agatha Christie', bio: 'English writer best known for her detective novels.' },
  { name: 'Toni Morrison', bio: 'American novelist and Nobel laureate in Literature.' },
  { name: 'Haruki Murakami', bio: 'Japanese writer known for surreal, genre-blending novels.' },
];

const CATEGORIES = ['Fiction', 'Non-Fiction', 'Science Fiction', 'Mystery', 'Classic'];

const BOOKS = [
  {
    title: 'Pride and Prejudice',
    isbn: '9780000000001',
    authorName: 'Jane Austen',
    categoryNames: ['Classic', 'Fiction'],
    description: 'Elizabeth Bennet navigates love and reputation in Regency England.',
    publishedYear: 1813,
    totalCopies: 3,
    availableCopies: 1,
  },
  {
    title: 'Emma',
    isbn: '9780000000002',
    authorName: 'Jane Austen',
    categoryNames: ['Classic', 'Fiction'],
    description: 'A well-meaning matchmaker learns to see herself clearly.',
    publishedYear: 1815,
    totalCopies: 2,
    availableCopies: 2,
  },
  {
    title: 'Sense and Sensibility',
    isbn: '9780000000003',
    authorName: 'Jane Austen',
    categoryNames: ['Classic'],
    description: 'Two sisters navigate romance with very different temperaments.',
    publishedYear: 1811,
    totalCopies: 2,
    availableCopies: 0,
  },
  {
    title: 'Nineteen Eighty-Four',
    isbn: '9780000000004',
    authorName: 'George Orwell',
    categoryNames: ['Fiction', 'Science Fiction'],
    description: 'A dystopian vision of totalitarian surveillance.',
    publishedYear: 1949,
    totalCopies: 4,
    availableCopies: 2,
  },
  {
    title: 'Animal Farm',
    isbn: '9780000000005',
    authorName: 'George Orwell',
    categoryNames: ['Fiction', 'Classic'],
    description: 'A farmyard allegory of revolution and power.',
    publishedYear: 1945,
    totalCopies: 3,
    availableCopies: 3,
  },
  {
    title: 'Homage to Catalonia',
    isbn: '9780000000006',
    authorName: 'George Orwell',
    categoryNames: ['Non-Fiction'],
    description: 'A firsthand account of the Spanish Civil War.',
    publishedYear: 1938,
    totalCopies: 1,
    availableCopies: 1,
  },
  {
    title: 'Foundation',
    isbn: '9780000000007',
    authorName: 'Isaac Asimov',
    categoryNames: ['Science Fiction'],
    description: 'The fall and rebirth of a galactic empire.',
    publishedYear: 1951,
    totalCopies: 3,
    availableCopies: 1,
  },
  {
    title: 'I, Robot',
    isbn: '9780000000008',
    authorName: 'Isaac Asimov',
    categoryNames: ['Science Fiction'],
    description: 'Short stories exploring the Three Laws of Robotics.',
    publishedYear: 1950,
    totalCopies: 2,
    availableCopies: 2,
  },
  {
    title: 'The Caves of Steel',
    isbn: '9780000000009',
    authorName: 'Isaac Asimov',
    categoryNames: ['Science Fiction', 'Mystery'],
    description: 'A detective and a robot partner investigate a murder.',
    publishedYear: 1954,
    totalCopies: 2,
    availableCopies: 1,
  },
  {
    title: 'Murder on the Orient Express',
    isbn: '9780000000010',
    authorName: 'Agatha Christie',
    categoryNames: ['Mystery'],
    description: 'Hercule Poirot solves a murder aboard a snowbound train.',
    publishedYear: 1934,
    totalCopies: 3,
    availableCopies: 2,
  },
  {
    title: 'And Then There Were None',
    isbn: '9780000000011',
    authorName: 'Agatha Christie',
    categoryNames: ['Mystery', 'Classic'],
    description: 'Ten strangers, an island, and a nursery rhyme.',
    publishedYear: 1939,
    totalCopies: 4,
    availableCopies: 2,
  },
  {
    title: 'The Murder of Roger Ackroyd',
    isbn: '9780000000012',
    authorName: 'Agatha Christie',
    categoryNames: ['Mystery'],
    description: 'Poirot investigates a murder with a legendary twist.',
    publishedYear: 1926,
    totalCopies: 2,
    availableCopies: 1,
  },
  {
    title: 'Beloved',
    isbn: '9780000000013',
    authorName: 'Toni Morrison',
    categoryNames: ['Fiction', 'Classic'],
    description: 'A mother haunted by the trauma of slavery.',
    publishedYear: 1987,
    totalCopies: 2,
    availableCopies: 1,
  },
  {
    title: 'Song of Solomon',
    isbn: '9780000000014',
    authorName: 'Toni Morrison',
    categoryNames: ['Fiction'],
    description: "A man's journey to uncover his family's history.",
    publishedYear: 1977,
    totalCopies: 2,
    availableCopies: 2,
  },
  {
    title: 'The Bluest Eye',
    isbn: '9780000000015',
    authorName: 'Toni Morrison',
    categoryNames: ['Fiction'],
    description: 'A young girl longs for blue eyes in 1940s Ohio.',
    publishedYear: 1970,
    totalCopies: 1,
    availableCopies: 0,
  },
  {
    title: 'Norwegian Wood',
    isbn: '9780000000016',
    authorName: 'Haruki Murakami',
    categoryNames: ['Fiction'],
    description: 'A nostalgic story of loss and burgeoning sexuality.',
    publishedYear: 1987,
    totalCopies: 3,
    availableCopies: 2,
  },
  {
    title: 'Kafka on the Shore',
    isbn: '9780000000017',
    authorName: 'Haruki Murakami',
    categoryNames: ['Fiction'],
    description: 'Two intertwined, dreamlike journeys converge.',
    publishedYear: 2002,
    totalCopies: 3,
    availableCopies: 1,
  },
  {
    title: '1Q84',
    isbn: '9780000000018',
    authorName: 'Haruki Murakami',
    categoryNames: ['Fiction', 'Science Fiction'],
    description: 'A woman discovers she has slipped into an alternate 1984.',
    publishedYear: 2009,
    totalCopies: 2,
    availableCopies: 0,
  },
  {
    title: 'The Wind-Up Bird Chronicle',
    isbn: '9780000000019',
    authorName: 'Haruki Murakami',
    categoryNames: ['Fiction'],
    description: "A man's quiet life unravels into a surreal search.",
    publishedYear: 1994,
    totalCopies: 2,
    availableCopies: 2,
  },
  {
    title: 'Colorless Tsukuru Tazaki',
    isbn: '9780000000020',
    authorName: 'Haruki Murakami',
    categoryNames: ['Fiction'],
    description: 'A man confronts the friends who once cut him off.',
    publishedYear: 2013,
    totalCopies: 2,
    availableCopies: 2,
  },
];

const USERS = [
  { name: 'Library Admin', email: 'admin@pwbooks.test', role: 'admin' },
  { name: 'Jamie Reader', email: 'member@pwbooks.test', role: 'member' },
  { name: 'Alex Borrower', email: 'alex@pwbooks.test', role: 'member' },
];
const SEED_USER_PASSWORD = 'Password123!';

const REVIEWS = [
  {
    bookTitle: 'Pride and Prejudice',
    userEmail: 'admin@pwbooks.test',
    rating: 5,
    comment: 'A timeless classic.',
  },
  {
    bookTitle: 'Pride and Prejudice',
    userEmail: 'member@pwbooks.test',
    rating: 4,
    comment: 'Witty and sharp.',
  },
  {
    bookTitle: 'Pride and Prejudice',
    userEmail: 'alex@pwbooks.test',
    rating: 5,
    comment: 'Loved every page.',
  },
  {
    bookTitle: 'Nineteen Eighty-Four',
    userEmail: 'member@pwbooks.test',
    rating: 5,
    comment: 'Chillingly relevant.',
  },
];

async function insertAndGetId(
  transaction: sql.Transaction,
  query: string,
  inputs: Record<string, unknown>,
): Promise<number> {
  const request = new sql.Request(transaction);
  for (const [name, value] of Object.entries(inputs)) request.input(name, value);
  const result = await request.query(query);
  return (result.recordset[0] as { Id: number }).Id;
}

async function execRequest(
  transaction: sql.Transaction,
  query: string,
  inputs: Record<string, unknown> = {},
): Promise<void> {
  const request = new sql.Request(transaction);
  for (const [name, value] of Object.entries(inputs)) request.input(name, value);
  await request.query(query);
}

/** All child rows cascade off Users/Books deletion (see migrations 001/002 FKs). */
async function wipeAllData(transaction: sql.Transaction): Promise<void> {
  await execRequest(transaction, 'DELETE FROM dbo.Users;');
  await execRequest(transaction, 'DELETE FROM dbo.Books;');
  await execRequest(transaction, 'DELETE FROM dbo.Categories;');
  await execRequest(transaction, 'DELETE FROM dbo.Authors;');

  for (const table of [
    'Users',
    'Books',
    'Authors',
    'Categories',
    'Loans',
    'Reviews',
    'RefreshTokens',
  ]) {
    await execRequest(transaction, `DBCC CHECKIDENT ('dbo.${table}', RESEED, 0);`);
  }
}

async function reseedData(transaction: sql.Transaction): Promise<void> {
  const authorIds: Record<string, number> = {};
  for (const author of AUTHORS) {
    authorIds[author.name] = await insertAndGetId(
      transaction,
      'INSERT INTO dbo.Authors (Name, Bio) OUTPUT INSERTED.Id VALUES (@name, @bio);',
      { name: author.name, bio: author.bio },
    );
  }

  const categoryIds: Record<string, number> = {};
  for (const name of CATEGORIES) {
    categoryIds[name] = await insertAndGetId(
      transaction,
      'INSERT INTO dbo.Categories (Name) OUTPUT INSERTED.Id VALUES (@name);',
      { name },
    );
  }

  const bookIds: Record<string, number> = {};
  for (const book of BOOKS) {
    const id = await insertAndGetId(
      transaction,
      `INSERT INTO dbo.Books (Title, Isbn, AuthorId, Description, PublishedYear, TotalCopies, AvailableCopies)
       OUTPUT INSERTED.Id
       VALUES (@title, @isbn, @authorId, @description, @publishedYear, @totalCopies, @availableCopies);`,
      {
        title: book.title,
        isbn: book.isbn,
        authorId: authorIds[book.authorName],
        description: book.description,
        publishedYear: book.publishedYear,
        totalCopies: book.totalCopies,
        availableCopies: book.availableCopies,
      },
    );
    bookIds[book.title] = id;

    for (const categoryName of book.categoryNames) {
      await execRequest(
        transaction,
        'INSERT INTO dbo.BookCategories (BookId, CategoryId) VALUES (@bookId, @categoryId);',
        { bookId: id, categoryId: categoryIds[categoryName] },
      );
    }
  }

  const passwordHash = await hashPassword(SEED_USER_PASSWORD);
  const userIds: Record<string, number> = {};
  for (const user of USERS) {
    userIds[user.email] = await insertAndGetId(
      transaction,
      `INSERT INTO dbo.Users (Name, Email, PasswordHash, Role)
       OUTPUT INSERTED.Id
       VALUES (@name, @email, @passwordHash, @role);`,
      { name: user.name, email: user.email, passwordHash, role: user.role },
    );
  }

  // Active loan (Jamie currently has Pride and Prejudice out).
  await execRequest(
    transaction,
    `INSERT INTO dbo.Loans (BookId, UserId, BorrowedAt, DueAt, Status)
     VALUES (@bookId, @userId, DATEADD(day, -3, SYSUTCDATETIME()), DATEADD(day, 11, SYSUTCDATETIME()), 'active');`,
    { bookId: bookIds['Pride and Prejudice'], userId: userIds['member@pwbooks.test'] },
  );
  // Overdue loan (Alex never returned Foundation).
  await execRequest(
    transaction,
    `INSERT INTO dbo.Loans (BookId, UserId, BorrowedAt, DueAt, Status)
     VALUES (@bookId, @userId, DATEADD(day, -30, SYSUTCDATETIME()), DATEADD(day, -16, SYSUTCDATETIME()), 'overdue');`,
    { bookId: bookIds.Foundation, userId: userIds['alex@pwbooks.test'] },
  );
  // Returned loan (history for Jamie).
  await execRequest(
    transaction,
    `INSERT INTO dbo.Loans (BookId, UserId, BorrowedAt, DueAt, ReturnedAt, Status)
     VALUES (@bookId, @userId, DATEADD(day, -40, SYSUTCDATETIME()), DATEADD(day, -26, SYSUTCDATETIME()), DATEADD(day, -25, SYSUTCDATETIME()), 'returned');`,
    { bookId: bookIds['Murder on the Orient Express'], userId: userIds['member@pwbooks.test'] },
  );

  for (const review of REVIEWS) {
    await execRequest(
      transaction,
      `INSERT INTO dbo.Reviews (BookId, UserId, Rating, Comment)
       VALUES (@bookId, @userId, @rating, @comment);`,
      {
        bookId: bookIds[review.bookTitle],
        userId: userIds[review.userEmail],
        rating: review.rating,
        comment: review.comment,
      },
    );
  }
}

async function clearUploadedCovers(): Promise<void> {
  let files: string[];
  try {
    files = await fs.readdir(UPLOAD_DIR);
  } catch {
    return;
  }
  await Promise.all(files.map((file) => fs.unlink(`${UPLOAD_DIR}/${file}`).catch(() => undefined)));
}

export interface ResetSummary {
  authors: number;
  categories: number;
  books: number;
  users: number;
  loans: number;
  reviews: number;
}

/**
 * Wipes all app data (cascading via FKs — see migrations 001/002), resets
 * identity seeds, re-inserts the same dataset `db:seed` loads, and clears
 * uploaded cover images — bringing both the DB and the API's local upload
 * state back to a fresh-seed baseline.
 */
export async function resetSystem(): Promise<ResetSummary> {
  const pool = requirePool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await wipeAllData(transaction);
    await reseedData(transaction);
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  await clearUploadedCovers();

  return {
    authors: AUTHORS.length,
    categories: CATEGORIES.length,
    books: BOOKS.length,
    users: USERS.length,
    loans: 3,
    reviews: REVIEWS.length,
  };
}
