const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const url = process.env.ELLA_PMS_DATABASE_URL;
  if (!url) {
    console.log('NO_ELLA_PMS_DATABASE_URL');
    return;
  }

  const u = new URL(url);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false },
  });

  try {
    const [rows] = await conn.query('SHOW TABLES');
    const tables = rows.map((r) => Object.values(r)[0]);
    console.log('TABLES', JSON.stringify(tables, null, 2));

    const userLike = tables.filter((t) => /user|account|member|staff|employee/i.test(t));
    console.log('USER_LIKE', JSON.stringify(userLike, null, 2));

    for (const table of userLike.slice(0, 10)) {
      try {
        const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
        console.log('COLUMNS', table, JSON.stringify(cols.map((c) => c.Field), null, 2));
      } catch (e) {
        console.log('COL_ERR', table, e.message);
      }
    }
  } catch (e) {
    console.error('DB_ERR', e.message);
  } finally {
    await conn.end();
  }
})();
