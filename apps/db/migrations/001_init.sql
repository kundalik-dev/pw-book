-- Initial schema for pw-books.
-- Idempotent: every CREATE is guarded so this file can be re-run safely.

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        Name          NVARCHAR(200)  NOT NULL,
        Email         NVARCHAR(320)  NOT NULL,
        PasswordHash  NVARCHAR(255)  NOT NULL,
        Role          NVARCHAR(20)   NOT NULL CONSTRAINT DF_Users_Role DEFAULT ('member'),
        CreatedAt     DATETIME2      NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_Users_Email UNIQUE (Email),
        CONSTRAINT CK_Users_Role CHECK (Role IN ('member', 'admin'))
    );
END;

IF OBJECT_ID('dbo.Authors', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Authors (
        Id   INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200)  NOT NULL,
        Bio  NVARCHAR(MAX)  NULL
    );
END;

IF OBJECT_ID('dbo.Categories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Categories (
        Id   INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        CONSTRAINT UQ_Categories_Name UNIQUE (Name)
    );
END;

IF OBJECT_ID('dbo.Books', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Books (
        Id               INT IDENTITY(1,1) PRIMARY KEY,
        Title            NVARCHAR(300)  NOT NULL,
        Isbn             NVARCHAR(20)   NOT NULL,
        AuthorId         INT            NOT NULL,
        Description      NVARCHAR(MAX)  NULL,
        PublishedYear    INT            NULL,
        CoverImageUrl    NVARCHAR(500)  NULL,
        TotalCopies      INT            NOT NULL CONSTRAINT DF_Books_TotalCopies DEFAULT (1),
        AvailableCopies  INT            NOT NULL CONSTRAINT DF_Books_AvailableCopies DEFAULT (1),
        CreatedAt        DATETIME2      NOT NULL CONSTRAINT DF_Books_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_Books_Isbn UNIQUE (Isbn),
        CONSTRAINT FK_Books_Author FOREIGN KEY (AuthorId) REFERENCES dbo.Authors (Id),
        CONSTRAINT CK_Books_Copies CHECK (AvailableCopies >= 0 AND AvailableCopies <= TotalCopies)
    );
END;

IF OBJECT_ID('dbo.BookCategories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BookCategories (
        BookId     INT NOT NULL,
        CategoryId INT NOT NULL,
        CONSTRAINT PK_BookCategories PRIMARY KEY (BookId, CategoryId),
        CONSTRAINT FK_BookCategories_Book FOREIGN KEY (BookId) REFERENCES dbo.Books (Id) ON DELETE CASCADE,
        CONSTRAINT FK_BookCategories_Category FOREIGN KEY (CategoryId) REFERENCES dbo.Categories (Id) ON DELETE CASCADE
    );
END;

IF OBJECT_ID('dbo.Loans', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Loans (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        BookId      INT        NOT NULL,
        UserId      INT        NOT NULL,
        BorrowedAt  DATETIME2  NOT NULL CONSTRAINT DF_Loans_BorrowedAt DEFAULT (SYSUTCDATETIME()),
        DueAt       DATETIME2  NOT NULL,
        ReturnedAt  DATETIME2  NULL,
        Status      NVARCHAR(20) NOT NULL CONSTRAINT DF_Loans_Status DEFAULT ('active'),
        CONSTRAINT FK_Loans_Book FOREIGN KEY (BookId) REFERENCES dbo.Books (Id) ON DELETE CASCADE,
        CONSTRAINT FK_Loans_User FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
        CONSTRAINT CK_Loans_Status CHECK (Status IN ('active', 'returned', 'overdue'))
    );
END;

IF OBJECT_ID('dbo.Reviews', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Reviews (
        Id         INT IDENTITY(1,1) PRIMARY KEY,
        BookId     INT           NOT NULL,
        UserId     INT           NOT NULL,
        Rating     INT           NOT NULL,
        Comment    NVARCHAR(MAX) NULL,
        CreatedAt  DATETIME2     NOT NULL CONSTRAINT DF_Reviews_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_Reviews_Book FOREIGN KEY (BookId) REFERENCES dbo.Books (Id) ON DELETE CASCADE,
        CONSTRAINT FK_Reviews_User FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
        CONSTRAINT CK_Reviews_Rating CHECK (Rating BETWEEN 1 AND 5),
        CONSTRAINT UQ_Reviews_UserBook UNIQUE (BookId, UserId)
    );
END;

IF OBJECT_ID('dbo.WishlistItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.WishlistItems (
        UserId   INT       NOT NULL,
        BookId   INT       NOT NULL,
        AddedAt  DATETIME2 NOT NULL CONSTRAINT DF_WishlistItems_AddedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_WishlistItems PRIMARY KEY (UserId, BookId),
        CONSTRAINT FK_WishlistItems_User FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
        CONSTRAINT FK_WishlistItems_Book FOREIGN KEY (BookId) REFERENCES dbo.Books (Id) ON DELETE CASCADE
    );
END;
