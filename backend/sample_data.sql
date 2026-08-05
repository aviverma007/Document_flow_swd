/* ============================================================
   Document Flow SWD - SAMPLE / TEST DATA
   Run in SSMS against DocFlowDB to try the app end to end.
   Wipe it later with the block at the bottom before loading real data.
   Logins created:
     admin  / Admin@2026        (admin)
     EMP001 / SmartWorld@2026   (user - Rahul Sharma)
     EMP002 / SmartWorld@2026   (user - Priya Nair)
     EMP003 / SmartWorld@2026   (user - Amit Singh)
   ============================================================ */
USE DocFlowDB;
GO

/* ---------- Employees ---------- */
INSERT INTO docflow.employees (employee_id, name, department, designation, email) VALUES
 ('EMP001','Rahul Sharma','Sales','Manager','rahul.sharma@example.com'),
 ('EMP002','Priya Nair','Finance','Accountant','priya.nair@example.com'),
 ('EMP003','Amit Singh','Legal','Executive','amit.singh@example.com'),
 ('EMP004','Neha Gupta','CRM','Associate','neha.gupta@example.com'),
 ('EMP005','Vikram Rao','Projects','Engineer','vikram.rao@example.com'),
 ('EMP006','Sana Khan','Admin','Coordinator','sana.khan@example.com');
GO

/* ---------- Documents (all start in storage) ---------- */
INSERT INTO docflow.documents (document_id, tower, flat_number, doc_type, remarks) VALUES
 ('DOC001','T1','101','Sale Agreement',NULL),
 ('DOC002','T1','102','Allotment Letter',NULL),
 ('DOC003','T1','103','Sale Agreement',NULL),
 ('DOC004','T1','104','Payment Receipt',NULL),
 ('DOC005','T2','201','Sale Agreement',NULL),
 ('DOC006','T2','202','Allotment Letter',NULL),
 ('DOC007','T2','203','KYC Documents',NULL),
 ('DOC008','T2','204','Sale Agreement',NULL),
 ('DOC009','T3','301','Sale Agreement',NULL),
 ('DOC010','T3','302','Payment Receipt',NULL),
 ('DOC011','T3','303','Allotment Letter',NULL),
 ('DOC012','T3','304','KYC Documents',NULL);
GO

/* ---------- Users (bcrypt hashes; passwords in the header above) ----------
   must_change_password = 0 so you can log in and test immediately. */
INSERT INTO docflow.users (username, password_hash, role, employee_id, must_change_password) VALUES
 ('admin', '$2b$10$JxoXnX7n9j4GTKagyovW2uC3VW9pwI5UXjRPJtPs4gjY9eKf67cka', 'admin', NULL, 0),
 ('EMP001','$2b$10$YEkicjReVRxs4V1PExJp3.yxirnWUZkTymEK1W10JVdakHMX.qaVS', 'user', 'EMP001', 0),
 ('EMP002','$2b$10$YEkicjReVRxs4V1PExJp3.yxirnWUZkTymEK1W10JVdakHMX.qaVS', 'user', 'EMP002', 0),
 ('EMP003','$2b$10$YEkicjReVRxs4V1PExJp3.yxirnWUZkTymEK1W10JVdakHMX.qaVS', 'user', 'EMP003', 0);
GO

PRINT 'Sample data inserted: 6 employees, 12 documents, 4 users.';
GO

/* ============================================================
   TO WIPE SAMPLE DATA LATER (run this block before loading real data).
   Order matters because of foreign keys.
   ------------------------------------------------------------
   USE DocFlowDB;
   DELETE FROM docflow.movements;
   DELETE FROM docflow.users;
   DELETE FROM docflow.documents;
   DELETE FROM docflow.employees;
   ============================================================ */
