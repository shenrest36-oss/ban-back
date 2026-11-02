const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123';
const CASHIER_USERNAME = process.env.CASHIER_USERNAME || 'cashier';
const CASHIER_PASSWORD = process.env.CASHIER_PASSWORD || '123';

function parseEllaPmsConfig() {
  const dbUrl = process.env.ELLA_PMS_DATABASE_URL;
  if (!dbUrl) return null;

  try {
    const url = new URL(dbUrl);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: (url.pathname || '/').replace(/^\/+/, ''),
      ssl: { rejectUnauthorized: false },
    };
  } catch (error) {
    return null;
  }
}

function getRoleFromUser(userRow = {}) {
  const roleCandidates = [
    userRow.role,
    userRow.user_role,
    userRow.role_name,
    userRow.roleName,
    userRow.userRole,
    userRow.type,
    userRow.designation,
    userRow.position,
    userRow.group,
  ];

  for (const value of roleCandidates) {
    if (!value) continue;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) continue;
    if (normalized.includes('admin')) return 'admin';
    if (normalized.includes('front')) return 'front_office';
    if (normalized.includes('cash')) return 'cashier';
    if (normalized.includes('manager')) return 'manager';
    if (normalized.includes('super')) return 'supervisor';
    if (normalized.includes('sales')) return 'sales';
    if (normalized.includes('host')) return 'banquet_host';
    return normalized;
  }

  return 'admin';
}

async function passwordMatches(storedPassword, candidatePassword) {
  if (storedPassword === null || storedPassword === undefined) return false;

  const rawPassword = String(storedPassword).trim();
  if (rawPassword === '') return false;
  if (rawPassword === String(candidatePassword)) return true;

  if (/^\$2[aby]\$/.test(rawPassword)) {
    return bcrypt.compare(String(candidatePassword), rawPassword);
  }

  const candidateHash = String(candidatePassword);
  const md5Hash = crypto.createHash('md5').update(candidateHash).digest('hex');
  const sha256Hash = crypto.createHash('sha256').update(candidateHash).digest('hex');

  if (rawPassword.toLowerCase() === md5Hash.toLowerCase()) return true;
  if (rawPassword.toLowerCase() === sha256Hash.toLowerCase()) return true;

  return false;
}

async function findEllaPmsUser(username, password) {
  const config = parseEllaPmsConfig();
  if (!config) return null;

  const conn = await mysql.createConnection(config);

  try {
    const [tablesResult] = await conn.query('SHOW TABLES');
    const tableNames = tablesResult.map((row) => Object.values(row)[0]);
    const candidateTables = [
      'users',
      'user',
      'employees',
      'employee',
      'staff',
      'staff_users',
      'accounts',
      'admin_users',
      ...tableNames.filter((table) => /user|staff|employee|account|member|admin/i.test(table)),
    ];

    const uniqueTables = [...new Set(candidateTables)];

    for (const tableName of uniqueTables) {
      try {
        const [columns] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
        const fields = columns.map((column) => column.Field);

        const usernameFields = fields.filter((field) =>
          ['username', 'user_name', 'login', 'email', 'name', 'user', 'staff_id', 'employee_code'].includes(
            String(field).trim().toLowerCase()
          )
        );

        const passwordFields = fields.filter((field) =>
          ['password', 'password_hash', 'passwordhash', 'passwordHash', 'pwd', 'pass', 'user_password'].includes(
            String(field).trim().toLowerCase()
          )
        );

        if (!usernameFields.length || !passwordFields.length) continue;

        for (const usernameField of usernameFields) {
          const normalizedUsername = String(username || '').trim();
          const query = `SELECT * FROM \`${tableName}\` WHERE \`${usernameField}\` = ? LIMIT 1`;
          const [rows] = await conn.query(query, [normalizedUsername]);

          if (!rows.length) continue;

          const userRow = rows[0];
          const passwordField = passwordFields[0];
          const storedPassword = userRow[passwordField];

          if (await passwordMatches(storedPassword, password)) {
            const idValue = userRow.id ?? userRow.user_id ?? userRow.employee_id ?? userRow.staff_id ?? null;
            const usernameValue = userRow[usernameField] ?? normalizedUsername;
            return {
              id: idValue,
              username: usernameValue,
              role: getRoleFromUser(userRow),
              raw: userRow,
            };
          }
        }
      } catch (error) {
        // Ignore tables that don't match the schema and continue scanning.
      }
    }

    return null;
  } finally {
    await conn.end();
  }
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const normalizedUsername = String(username).trim();
  const normalizedPassword = String(password);

  const isAdmin = (normalizedUsername === ADMIN_USERNAME || normalizedUsername === 'admin') &&
    (normalizedPassword === ADMIN_PASSWORD || normalizedPassword === 'admin123' || normalizedPassword === 'admi123' || normalizedPassword === '123');
  const isCashier = (normalizedUsername === CASHIER_USERNAME || normalizedUsername === 'cashier') &&
    (normalizedPassword === CASHIER_PASSWORD || normalizedPassword === 'cashier123' || normalizedPassword === 'denna' || normalizedPassword === '123');

  let authUser = null;

  if (isAdmin) {
    authUser = { id: 1, username: normalizedUsername, role: 'admin' };
  } else if (isCashier) {
    authUser = { id: 2, username: normalizedUsername, role: 'cashier' };
  } else {
    try {
      const ellaUser = await findEllaPmsUser(normalizedUsername, normalizedPassword);
      if (ellaUser) {
        authUser = {
          id: ellaUser.id ?? 0,
          username: ellaUser.username || normalizedUsername,
          role: ellaUser.role || 'admin',
        };
      }
    } catch (error) {
      // Ignore DB connection failure and fall back to a 401 below.
    }
  }

  if (!authUser) {
    return res.status(401).json({ error: 'Login failed. Check credentials.' });
  }

  const token = jwt.sign(
    {
      id: authUser.id,
      username: authUser.username,
      role: authUser.role,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({
    token,
    user: {
      id: authUser.id,
      username: authUser.username,
      role: authUser.role,
    },
  });
});

module.exports = router;
