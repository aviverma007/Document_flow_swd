/* Resets (or creates) the admin login using the SAME DB connection the app uses.
   Password comes from .env (ADMIN_USERNAME / ADMIN_PASSWORD).
   Run:  node reset_admin.js   */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('./db');

(async () => {
  const pool = await getPool();
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin@2026';
  const hash = await bcrypt.hash(password, 10);

  const ex = await pool.request().input('u', sql.NVarChar, username)
    .query('SELECT user_id FROM docflow.users WHERE username = @u');

  if (ex.recordset.length) {
    await pool.request().input('u', sql.NVarChar, username).input('h', sql.NVarChar, hash)
      .query(`UPDATE docflow.users SET password_hash = @h, role = 'admin', is_active = 1, must_change_password = 0 WHERE username = @u`);
    console.log(`\n  Admin '${username}' password RESET to: ${password}\n`);
  } else {
    await pool.request().input('u', sql.NVarChar, username).input('h', sql.NVarChar, hash)
      .query(`INSERT INTO docflow.users (username, password_hash, role, must_change_password) VALUES (@u, @h, 'admin', 0)`);
    console.log(`\n  Admin '${username}' CREATED with password: ${password}\n`);
  }

  // Show what's in the users table so we can see the whole picture
  const all = await pool.request().query('SELECT username, role, is_active FROM docflow.users ORDER BY role, username');
  console.log('  Current users:');
  all.recordset.forEach(u => console.log(`   - ${u.username}  (${u.role})  active=${u.is_active}`));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
