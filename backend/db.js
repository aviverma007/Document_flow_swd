const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || '192.168.66.33',
  database: process.env.DB_NAME || 'DocFlowDB',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false,            // internal SQL Server, no SSL
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let poolPromise;
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config)
      .then(pool => { console.log('Connected to SQL Server'); return pool; })
      .catch(err => { poolPromise = null; throw err; });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
