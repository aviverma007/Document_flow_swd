/* ============================================================
   Document Flow SWD - SQL Server schema
   Physical document custody tracking (storage <-> employee)
   Run once against your database on 192.168.66.33
   ============================================================ */

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'docflow')
    EXEC('CREATE SCHEMA docflow');
GO

/* ---------- Master: employees ---------- */
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

/* ---------- Master: documents (with live custody state) ----------
   status: in_storage | pending_out | with_employee | pending_return  */
IF OBJECT_ID('docflow.documents', 'U') IS NULL
CREATE TABLE docflow.documents (
    document_id        NVARCHAR(50)  NOT NULL PRIMARY KEY,
    tower              NVARCHAR(50)  NULL,
    flat_number        NVARCHAR(50)  NULL,
    doc_type           NVARCHAR(100) NULL,
    remarks            NVARCHAR(500) NULL,
    status             NVARCHAR(20)  NOT NULL DEFAULT 'in_storage',
    current_holder_id  NVARCHAR(50)  NULL REFERENCES docflow.employees(employee_id),
    updated_at         DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

/* ---------- Auth: users ----------
   role: admin | user ; user links to one employee  */
IF OBJECT_ID('docflow.users', 'U') IS NULL
CREATE TABLE docflow.users (
    user_id               INT IDENTITY(1,1) PRIMARY KEY,
    username              NVARCHAR(100) NOT NULL UNIQUE,
    password_hash         NVARCHAR(255) NOT NULL,
    role                  NVARCHAR(20)  NOT NULL DEFAULT 'user',
    employee_id           NVARCHAR(50)  NULL REFERENCES docflow.employees(employee_id),
    must_change_password  BIT           NOT NULL DEFAULT 1,
    is_active             BIT           NOT NULL DEFAULT 1,
    created_at            DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

/* ---------- Custody log / approval requests ----------
   action: issue (storage->emp) | return (emp->storage)
   status: pending | approved | rejected  */
IF OBJECT_ID('docflow.movements', 'U') IS NULL
CREATE TABLE docflow.movements (
    movement_id     INT IDENTITY(1,1) PRIMARY KEY,
    document_id     NVARCHAR(50) NOT NULL REFERENCES docflow.documents(document_id),
    action          NVARCHAR(20) NOT NULL,
    from_holder_id  NVARCHAR(50) NULL REFERENCES docflow.employees(employee_id),
    to_holder_id    NVARCHAR(50) NULL REFERENCES docflow.employees(employee_id),
    requested_by    INT          NOT NULL REFERENCES docflow.users(user_id),
    status          NVARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by     INT          NULL REFERENCES docflow.users(user_id),
    requested_at    DATETIME2    NOT NULL DEFAULT SYSDATETIME(),
    decided_at      DATETIME2    NULL,
    remarks         NVARCHAR(500) NULL
);
GO

CREATE INDEX IX_documents_status  ON docflow.documents(status);
CREATE INDEX IX_documents_holder  ON docflow.documents(current_holder_id);
CREATE INDEX IX_movements_doc     ON docflow.movements(document_id);
CREATE INDEX IX_movements_status  ON docflow.movements(status);
GO
