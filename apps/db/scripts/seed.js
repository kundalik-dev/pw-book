import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { getDbConfig } from './env.js';

const authors = [
  { name: 'Jane Austen', bio: 'English novelist known for her social commentary and wit.' },
  { name: 'George Orwell', bio: 'English novelist and essayist, known for dystopian fiction.' },
  { name: 'Isaac Asimov', bio: 'American writer and professor, prolific in science fiction.' },
  { name: 'Agatha Christie', bio: 'English writer best known for her detective novels.' },
  { name: 'Toni Morrison', bio: 'American novelist and Nobel laureate in Literature.' },
  { name: 'Haruki Murakami', bio: 'Japanese writer known for surreal, genre-blending novels.' },
];

const categories = ['Fiction', 'Non-Fiction', 'Science Fiction', 'Mystery', 'Classic'];

// availableCopies < totalCopies models active loans; 0 available is used
// deliberately by a couple of entries so the "unavailable book" UI/API case
// is reachable without manual setup (see docs/tasks phase 10).
const books = [
  { title: 'Pride and Prejudice', isbn: '9780000000001', authorName: 'Jane Austen', categoryNames: ['Classic', 'Fiction'], description: 'Elizabeth Bennet navigates love and reputation in Regency England.', publishedYear: 1813, totalCopies: 3, availableCopies: 1 },
  { title: 'Emma', isbn: '9780000000002', authorName: 'Jane Austen', categoryNames: ['Classic', 'Fiction'], description: 'A well-meaning matchmaker learns to see herself clearly.', publishedYear: 1815, totalCopies: 2, availableCopies: 2 },
  { title: 'Sense and Sensibility', isbn: '9780000000003', authorName: 'Jane Austen', categoryNames: ['Classic'], description: 'Two sisters navigate romance with very different temperaments.', publishedYear: 1811, totalCopies: 2, availableCopies: 0 },
  { title: 'Nineteen Eighty-Four', isbn: '9780000000004', authorName: 'George Orwell', categoryNames: ['Fiction', 'Science Fiction'], description: 'A dystopian vision of totalitarian surveillance.', publishedYear: 1949, totalCopies: 4, availableCopies: 2 },
  { title: 'Animal Farm', isbn: '9780000000005', authorName: 'George Orwell', categoryNames: ['Fiction', 'Classic'], description: 'A farmyard allegory of revolution and power.', publishedYear: 1945, totalCopies: 3, availableCopies: 3 },
  { title: 'Homage to Catalonia', isbn: '9780000000006', authorName: 'George Orwell', categoryNames: ['Non-Fiction'], description: "A firsthand account of the Spanish Civil War.", publishedYear: 1938, totalCopies: 1, availableCopies: 1 },
  { title: 'Foundation', isbn: '9780000000007', authorName: 'Isaac Asimov', categoryNames: ['Science Fiction'], description: 'The fall and rebirth of a galactic empire.', publishedYear: 1951, totalCopies: 3, availableCopies: 1 },
  { title: 'I, Robot', isbn: '9780000000008', authorName: 'Isaac Asimov', categoryNames: ['Science Fiction'], description: 'Short stories exploring the Three Laws of Robotics.', publishedYear: 1950, totalCopies: 2, availableCopies: 2 },
  { title: 'The Caves of Steel', isbn: '9780000000009', authorName: 'Isaac Asimov', categoryNames: ['Science Fiction', 'Mystery'], description: 'A detective and a robot partner investigate a murder.', publishedYear: 1954, totalCopies: 2, availableCopies: 1 },
  { title: 'Murder on the Orient Express', isbn: '9780000000010', authorName: 'Agatha Christie', categoryNames: ['Mystery'], description: 'Hercule Poirot solves a murder aboard a snowbound train.', publishedYear: 1934, totalCopies: 3, availableCopies: 2 },
  { title: 'And Then There Were None', isbn: '9780000000011', authorName: 'Agatha Christie', categoryNames: ['Mystery', 'Classic'], description: 'Ten strangers, an island, and a nursery rhyme.', publishedYear: 1939, totalCopies: 4, availableCopies: 2 },
  { title: 'The Murder of Roger Ackroyd', isbn: '9780000000012', authorName: 'Agatha Christie', categoryNames: ['Mystery'], description: 'Poirot investigates a murder with a legendary twist.', publishedYear: 1926, totalCopies: 2, availableCopies: 1 },
  { title: 'Beloved', isbn: '9780000000013', authorName: 'Toni Morrison', categoryNames: ['Fiction', 'Classic'], description: 'A mother haunted by the trauma of slavery.', publishedYear: 1987, totalCopies: 2, availableCopies: 1 },
  { title: 'Song of Solomon', isbn: '9780000000014', authorName: 'Toni Morrison', categoryNames: ['Fiction'], description: "A man's journey to uncover his family's history.", publishedYear: 1977, totalCopies: 2, availableCopies: 2 },
  { title: 'The Bluest Eye', isbn: '9780000000015', authorName: 'Toni Morrison', categoryNames: ['Fiction'], description: 'A young girl longs for blue eyes in 1940s Ohio.', publishedYear: 1970, totalCopies: 1, availableCopies: 0 },
  { title: 'Norwegian Wood', isbn: '9780000000016', authorName: 'Haruki Murakami', categoryNames: ['Fiction'], description: 'A nostalgic story of loss and burgeoning sexuality.', publishedYear: 1987, totalCopies: 3, availableCopies: 2 },
  { title: 'Kafka on the Shore', isbn: '9780000000017', authorName: 'Haruki Murakami', categoryNames: ['Fiction'], description: 'Two intertwined, dreamlike journeys converge.', publishedYear: 2002, totalCopies: 3, availableCopies: 1 },
  { title: '1Q84', isbn: '9780000000018', authorName: 'Haruki Murakami', categoryNames: ['Fiction', 'Science Fiction'], description: 'A woman discovers she has slipped into an alternate 1984.', publishedYear: 2009, totalCopies: 2, availableCopies: 0 },
  { title: 'The Wind-Up Bird Chronicle', isbn: '9780000000019', authorName: 'Haruki Murakami', categoryNames: ['Fiction'], description: "A man's quiet life unravels into a surreal search.", publishedYear: 1994, totalCopies: 2, availableCopies: 2 },
  { title: 'Colorless Tsukuru Tazaki', isbn: '9780000000020', authorName: 'Haruki Murakami', categoryNames: ['Fiction'], description: 'A man confronts the friends who once cut him off.', publishedYear: 2013, totalCopies: 2, availableCopies: 2 },
];

const users = [
  { name: 'Library Admin', email: 'admin@pwbooks.test', role: 'admin' },
  { name: 'Jamie Reader', email: 'member@pwbooks.test', role: 'member' },
  { name: 'Alex Borrower', email: 'alex@pwbooks.test', role: 'member' },
];
const SEED_USER_PASSWORD = 'Password123!';

async function insertAndGetId(pool, query, inputs) {
  const request = pool.request();
  for (const [name, value] of Object.entries(inputs)) {
    request.input(name, value);
  }
  const result = await request.query(query);
  return result.recordset[0].Id;
}

async function insertRow(pool, query, inputs) {
  const request = pool.request();
  for (const [name, value] of Object.entries(inputs)) {
    request.input(name, value);
  }
  await request.query(query);
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 86_400_000);
}

async function main() {
  const pool = await sql.connect(getDbConfig());
  try {
    const existing = await pool.request().query('SELECT COUNT(*) AS count FROM dbo.Authors;');
    if (existing.recordset[0].count > 0) {
      console.log('Seed data already present (Authors table is non-empty) — skipping.');
      return;
    }

    console.log('Seeding authors...');
    const authorIds = {};
    for (const author of authors) {
      authorIds[author.name] = await insertAndGetId(
        pool,
        'INSERT INTO dbo.Authors (Name, Bio) OUTPUT INSERTED.Id VALUES (@name, @bio);',
        { name: author.name, bio: author.bio },
      );
    }

    console.log('Seeding categories...');
    const categoryIds = {};
    for (const name of categories) {
      categoryIds[name] = await insertAndGetId(
        pool,
        'INSERT INTO dbo.Categories (Name) OUTPUT INSERTED.Id VALUES (@name);',
        { name },
      );
    }

    console.log('Seeding books...');
    const bookIds = {};
    for (const book of books) {
      const id = await insertAndGetId(
        pool,
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
        await insertRow(
          pool,
          'INSERT INTO dbo.BookCategories (BookId, CategoryId) VALUES (@bookId, @categoryId);',
          { bookId: id, categoryId: categoryIds[categoryName] },
        );
      }
    }

    console.log('Seeding users...');
    const passwordHash = await bcrypt.hash(SEED_USER_PASSWORD, 10);
    const userIds = {};
    for (const user of users) {
      userIds[user.email] = await insertAndGetId(
        pool,
        `INSERT INTO dbo.Users (Name, Email, PasswordHash, Role)
         OUTPUT INSERTED.Id
         VALUES (@name, @email, @passwordHash, @role);`,
        { name: user.name, email: user.email, passwordHash, role: user.role },
      );
    }

    console.log('Seeding loans...');
    // Active loan (Jamie currently has Pride and Prejudice out).
    await insertRow(
      pool,
      `INSERT INTO dbo.Loans (BookId, UserId, BorrowedAt, DueAt, Status)
       VALUES (@bookId, @userId, DATEADD(day, -3, SYSUTCDATETIME()), @dueAt, 'active');`,
      { bookId: bookIds['Pride and Prejudice'], userId: userIds['member@pwbooks.test'], dueAt: daysFromNow(11) },
    );
    // Overdue loan (Alex never returned Foundation).
    await insertRow(
      pool,
      `INSERT INTO dbo.Loans (BookId, UserId, BorrowedAt, DueAt, Status)
       VALUES (@bookId, @userId, DATEADD(day, -30, SYSUTCDATETIME()), DATEADD(day, -16, SYSUTCDATETIME()), 'overdue');`,
      { bookId: bookIds.Foundation, userId: userIds['alex@pwbooks.test'] },
    );
    // Returned loan (history for Jamie).
    await insertRow(
      pool,
      `INSERT INTO dbo.Loans (BookId, UserId, BorrowedAt, DueAt, ReturnedAt, Status)
       VALUES (@bookId, @userId, DATEADD(day, -40, SYSUTCDATETIME()), DATEADD(day, -26, SYSUTCDATETIME()), DATEADD(day, -25, SYSUTCDATETIME()), 'returned');`,
      { bookId: bookIds['Murder on the Orient Express'], userId: userIds['member@pwbooks.test'] },
    );

    console.log('Seeding reviews...');
    // "Pride and Prejudice" gets several reviews; "Norwegian Wood" gets none — both deliberate (phase 10).
    const reviews = [
      { bookTitle: 'Pride and Prejudice', userEmail: 'admin@pwbooks.test', rating: 5, comment: 'A timeless classic.' },
      { bookTitle: 'Pride and Prejudice', userEmail: 'member@pwbooks.test', rating: 4, comment: 'Witty and sharp.' },
      { bookTitle: 'Pride and Prejudice', userEmail: 'alex@pwbooks.test', rating: 5, comment: 'Loved every page.' },
      { bookTitle: 'Nineteen Eighty-Four', userEmail: 'member@pwbooks.test', rating: 5, comment: 'Chillingly relevant.' },
    ];
    for (const review of reviews) {
      await insertRow(
        pool,
        `INSERT INTO dbo.Reviews (BookId, UserId, Rating, Comment)
         VALUES (@bookId, @userId, @rating, @comment);`,
        { bookId: bookIds[review.bookTitle], userId: userIds[review.userEmail], rating: review.rating, comment: review.comment },
      );
    }

    console.log(
      `Seed complete: ${authors.length} authors, ${categories.length} categories, ${books.length} books, ` +
        `${users.length} users, 3 loans, ${reviews.length} reviews.`,
    );
    console.log(`All seeded users share the password: ${SEED_USER_PASSWORD}`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
});
