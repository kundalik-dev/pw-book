-- Refresh token storage for Phase 3 auth (rotation + logout revocation).
-- Idempotent: guarded so this file can be re-run safely.

IF OBJECT_ID('dbo.RefreshTokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RefreshTokens (
        Id         INT IDENTITY(1,1) PRIMARY KEY,
        UserId     INT           NOT NULL,
        TokenHash  NVARCHAR(64)  NOT NULL,
        ExpiresAt  DATETIME2     NOT NULL,
        RevokedAt  DATETIME2     NULL,
        CreatedAt  DATETIME2     NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_RefreshTokens_User FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
        CONSTRAINT UQ_RefreshTokens_TokenHash UNIQUE (TokenHash)
    );
END;
