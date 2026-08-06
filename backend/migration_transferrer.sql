/* ============================================================
   Migration: add transferrer role + multi-step handoff support.
   Run once in SSMS against DocFlowDB (safe to re-run).
   Adds a transferrer login:  transfer / SmartWorld@2026
   ============================================================ */
USE DocFlowDB;
GO

/* documents: target holder during an issue, and assigned transferrer */
IF COL_LENGTH('docflow.documents','pending_holder_id') IS NULL
    ALTER TABLE docflow.documents ADD pending_holder_id NVARCHAR(50) NULL;
GO
IF COL_LENGTH('docflow.documents','transferrer_user_id') IS NULL
    ALTER TABLE docflow.documents ADD transferrer_user_id INT NULL;
GO

/* movements: stage of each event + who performed it */
IF COL_LENGTH('docflow.movements','stage') IS NULL
    ALTER TABLE docflow.movements ADD stage NVARCHAR(30) NULL;
GO
IF COL_LENGTH('docflow.movements','actor_id') IS NULL
    ALTER TABLE docflow.movements ADD actor_id INT NULL;
GO

/* foreign keys (add if missing) */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_documents_pending')
    ALTER TABLE docflow.documents ADD CONSTRAINT FK_documents_pending
        FOREIGN KEY (pending_holder_id) REFERENCES docflow.employees(employee_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_documents_transferrer')
    ALTER TABLE docflow.documents ADD CONSTRAINT FK_documents_transferrer
        FOREIGN KEY (transferrer_user_id) REFERENCES docflow.users(user_id);
GO

/* transferrer login (password: SmartWorld@2026) */
IF NOT EXISTS (SELECT 1 FROM docflow.users WHERE username = 'transfer')
    INSERT INTO docflow.users (username, password_hash, role, employee_id, must_change_password)
    VALUES ('transfer', '$2b$10$YEkicjReVRxs4V1PExJp3.yxirnWUZkTymEK1W10JVdakHMX.qaVS', 'transferrer', NULL, 0);
GO

PRINT 'Migration complete: columns added, transferrer login ready (transfer / SmartWorld@2026).';
GO

/* ---- widen movement text columns so long stage names never truncate ---- */
ALTER TABLE docflow.movements ALTER COLUMN status NVARCHAR(30) NULL;
GO
IF COL_LENGTH('docflow.movements','stage') < 80
    ALTER TABLE docflow.movements ALTER COLUMN stage NVARCHAR(40) NULL;
GO
PRINT 'Movement columns widened.';
GO
