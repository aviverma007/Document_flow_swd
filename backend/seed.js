/* Creates the admin login, and one user login per employee (default password,
   must_change_password = 1). Safe to run repeatedly — only inserts what's missing.
   Run:  npm run seed   */
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { sql, getPool } = require('./db');

function usernameFor(emp) {
  // default username = employee_id (change here if you prefer email/name)
  return String(emp.employee_id).trim();
}

(async () => {
  const pool = await getPool();
  const defPwd = process.env.DEFAULT_USER_PASSWORD || 'SmartWorld@2026';
  const defHash = await bcrypt.hash(defPwd, 10);

  // 1) Admin
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPwd = process.env.ADMIN_PASSWORD || 'Admin@2026';
  const existsAdmin = await pool.request().input('u', sql.NVarChar, adminUser)
    .query('SELECT user_id FROM docflow.users WHERE username = @u');
  if (existsAdmin.recordset.length === 0) {
    const h = await bcrypt.hash(adminPwd, 10);
    await pool.request().input('u', sql.NVarChar, adminUser).input('h', sql.NVarChar, h)
      .query(`INSERT INTO docflow.users (username, password_hash, role, must_change_password)
              VALUES (@u, @h, 'admin', 0)`);
    console.log(`Admin created: ${adminUser} / ${adminPwd}`);
  } else {
    console.log(`Admin already exists: ${adminUser}`);
  }

  // 2) One user per employee
  const emps = await pool.request().query('SELECT employee_id FROM docflow.employees WHERE is_active = 1');
  let created = 0;
  for (const emp of emps.recordset) {
    const uname = usernameFor(emp);
    const ex = await pool.request().input('u', sql.NVarChar, uname)
      .query('SELECT user_id FROM docflow.users WHERE username = @u');
    if (ex.recordset.length === 0) {
      await pool.request()
        .input('u', sql.NVarChar, uname)
        .input('h', sql.NVarChar, defHash)
        .input('emp', sql.NVarChar, String(emp.employee_id).trim())
        .query(`INSERT INTO docflow.users (username, password_hash, role, employee_id, must_change_password)
                VALUES (@u, @h, 'user', @emp, 1)`);
      created++;
    }
  }
  console.log(`Employee logins created: ${created} (default password: ${defPwd})`);
  console.log('Done.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
