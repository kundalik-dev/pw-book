-- Records which admin a loan was physically handed back to on return
-- (the Orders page's return modal). Idempotent: guarded so this file can be
-- re-run safely.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Loans') AND name = 'ReturnedToAdminId'
)
BEGIN
    ALTER TABLE dbo.Loans ADD ReturnedToAdminId INT NULL
        CONSTRAINT FK_Loans_ReturnedToAdmin FOREIGN KEY REFERENCES dbo.Users (Id);
END;
