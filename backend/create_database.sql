/* ============================================================
   Document Flow SWD - full database setup
   Run this ONCE in SSMS (New Query window -> Execute / F5).
   Creates the database, the docflow schema, all tables and indexes.
   Safe to re-run: it only creates what is missing.
   ============================================================ */

/* ---------- 1. Create the database ---------- */
IF DB_ID('DocFlowDB') IS NULL
    CREATE DATABASE DocFlowDB;
GO

USE DocFlowDB;
GO

/* ---------- 2. Schema ---------- */
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'docflow')
    EXEC('CREATE SCHEMA docflow');
GO

/* ---------- 3. Master: employees ---------- */
IF OBJECT_ID('docflow.employees', 'U') IS NULL
CREATE TABLE docflow.employees (
    employee_id   NVARCHAR(50)  NOT NULL PRIMARY KEY,
    name          NVARCHAR(200) NOT NULL,
    department    NVARCHAR(100) NULL,
    designation   NVARCHAR(100) NULL,
    email         NVARCHAR(200) NULL,
    is_active     BIT           NOT NULL DEFAULT 1,
    created_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

/* ---------- 4. Master: documents (with live custody state) ----------
   status: in_storage | pending_out | with_employee | pending_return  */
IF OBJECT_ID('docflow.documents', 'U') IS NULL
CREATE TABLE docflow.documents (
    document_id        NVARCHAR(50)  NOT NULL PRIMARY KEY,
    tower              NVARCHAR(50)  NULL,
    flat_number        NVARCHAR(50)  NULL,
    doc_type           NVARCHAR(100) NULL,
    remarks            NVARCHAR(500) NULL,
    status             NVARCHAR(20)  NOT NULL DEFAULT 'in_storage',
    current_holder_id   NVARCHAR(50)  NULL,
    pending_holder_id   NVARCHAR(50)  NULL,
    transferrer_user_id INT           NULL,
    updated_at          DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_documents_holder FOREIGN KEY (current_holder_id)
        REFERENCES docflow.employees(employee_id)
);
GO

/* ---------- 5. Auth: users ----------
   role: admin | user ; a user links to one employee  */
IF OBJECT_ID('docflow.users', 'U') IS NULL
CREATE TABLE docflow.users (
    user_id               INT IDENTITY(1,1) PRIMARY KEY,
    username              NVARCHAR(100) NOT NULL UNIQUE,
    password_hash         NVARCHAR(255) NOT NULL,
    role                  NVARCHAR(20)  NOT NULL DEFAULT 'user',
    employee_id           NVARCHAR(50)  NULL,
    must_change_password  BIT           NOT NULL DEFAULT 1,
    is_active             BIT           NOT NULL DEFAULT 1,
    created_at            DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_users_employee FOREIGN KEY (employee_id)
        REFERENCES docflow.employees(employee_id)
);
GO

/* ---------- 6. Custody log / approval requests ----------
   action: issue (storage->emp) | return (emp->storage)
   status: pending | approved | rejected  */
IF OBJECT_ID('docflow.movements', 'U') IS NULL
CREATE TABLE docflow.movements (
    movement_id     INT IDENTITY(1,1) PRIMARY KEY,
    document_id     NVARCHAR(50) NOT NULL,
    action          NVARCHAR(20) NOT NULL,
    from_holder_id  NVARCHAR(50) NULL,
    to_holder_id    NVARCHAR(50) NULL,
    requested_by    INT          NOT NULL,
    status          NVARCHAR(30) NOT NULL DEFAULT 'pending',
    approved_by     INT          NULL,
    requested_at    DATETIME2    NOT NULL DEFAULT SYSDATETIME(),
    decided_at      DATETIME2    NULL,
    remarks         NVARCHAR(500) NULL,
    stage           NVARCHAR(40) NULL,
    actor_id        INT          NULL,
    CONSTRAINT FK_mov_document FOREIGN KEY (document_id)   REFERENCES docflow.documents(document_id),
    CONSTRAINT FK_mov_from     FOREIGN KEY (from_holder_id) REFERENCES docflow.employees(employee_id),
    CONSTRAINT FK_mov_to       FOREIGN KEY (to_holder_id)   REFERENCES docflow.employees(employee_id),
    CONSTRAINT FK_mov_reqby    FOREIGN KEY (requested_by)   REFERENCES docflow.users(user_id),
    CONSTRAINT FK_mov_appby    FOREIGN KEY (approved_by)    REFERENCES docflow.users(user_id)
);
GO

/* ---------- 6b. Foreign keys for handoff columns ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_documents_pending')
    ALTER TABLE docflow.documents ADD CONSTRAINT FK_documents_pending
        FOREIGN KEY (pending_holder_id) REFERENCES docflow.employees(employee_id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_documents_transferrer')
    ALTER TABLE docflow.documents ADD CONSTRAINT FK_documents_transferrer
        FOREIGN KEY (transferrer_user_id) REFERENCES docflow.users(user_id);
GO

/* ---------- 7. Indexes ---------- */
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_documents_status')
    CREATE INDEX IX_documents_status ON docflow.documents(status);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_documents_holder')
    CREATE INDEX IX_documents_holder ON docflow.documents(current_holder_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_movements_doc')
    CREATE INDEX IX_movements_doc ON docflow.movements(document_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_movements_status')
    CREATE INDEX IX_movements_status ON docflow.movements(status);
GO

PRINT 'DocFlowDB setup complete: schema docflow + employees, documents, users, movements.';
GO
