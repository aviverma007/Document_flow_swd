/* Loads master data from Excel/CSV into docflow.employees and docflow.documents.
   Place your files in backend/master/ :
     - employees.xlsx  (columns: employee_id, name, department, designation, email)
     - documents.xlsx  (columns: document_id, tower, flat_number, doc_type, remarks)
   Column names are matched case-insensitively; extra columns are ignored.
   Run:  npm run load-master   */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
require('dotenv').config();
const { sql, getPool } = require('./db');

function readSheet(file) {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}
// case-insensitive column getter
function pick(row, ...names) {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find(k => k.trim().toLowerCase() === n.toLowerCase());
    if (k) return row[k];
  }
  return null;
}

(async () => {
  const pool = await getPool();
  const dir = path.join(__dirname, 'master');

  // Employees
  const empFile = path.join(dir, 'employees.xlsx');
  if (fs.existsSync(empFile)) {
    const rows = readSheet(empFile);
    let n = 0;
    for (const r of rows) {
      const id = pick(r, 'employee_id', 'emp_id', 'empid', 'id');
      if (!id) continue;
      await pool.request()
        .input('id', sql.NVarChar, String(id).trim())
        .input('name', sql.NVarChar, String(pick(r, 'name', 'employee_name') || '').trim())
        .input('dept', sql.NVarChar, pick(r, 'department', 'dept'))
        .input('desig', sql.NVarChar, pick(r, 'designation', 'title'))
        .input('email', sql.NVarChar, pick(r, 'email'))
        .query(`MERGE docflow.employees AS t
                USING (SELECT @id AS employee_id) AS s ON t.employee_id = s.employee_id
                WHEN MATCHED THEN UPDATE SET name=@name, department=@dept, designation=@desig, email=@email
                WHEN NOT MATCHED THEN INSERT (employee_id,name,department,designation,email)
                  VALUES (@id,@name,@dept,@desig,@email);`);
      n++;
    }
    console.log(`Employees upserted: ${n}`);
  } else console.log('No master/employees.xlsx found — skipped.');

  // Documents
  const docFile = path.join(dir, 'documents.xlsx');
  if (fs.existsSync(docFile)) {
    const rows = readSheet(docFile);
    let n = 0;
    for (const r of rows) {
      const id = pick(r, 'document_id', 'doc_id', 'docid', 'id');
      if (!id) continue;
      await pool.request()
        .input('id', sql.NVarChar, String(id).trim())
        .input('tower', sql.NVarChar, pick(r, 'tower'))
        .input('flat', sql.NVarChar, (() => { const v = pick(r, 'flat_number', 'flat', 'flat_no'); return v == null ? null : String(v).trim(); })())
        .input('type', sql.NVarChar, pick(r, 'doc_type', 'type'))
        .input('rem', sql.NVarChar, pick(r, 'remarks', 'remark'))
        .query(`MERGE docflow.documents AS t
                USING (SELECT @id AS document_id) AS s ON t.document_id = s.document_id
                WHEN MATCHED THEN UPDATE SET tower=@tower, flat_number=@flat, doc_type=@type, remarks=@rem
                WHEN NOT MATCHED THEN INSERT (document_id,tower,flat_number,doc_type,remarks,status)
                  VALUES (@id,@tower,@flat,@type,@rem,'in_storage');`);
      n++;
    }
    console.log(`Documents upserted: ${n}`);
  } else console.log('No master/documents.xlsx found — skipped.');

  console.log('Master load done. Now run: npm run seed  (to create logins)');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
