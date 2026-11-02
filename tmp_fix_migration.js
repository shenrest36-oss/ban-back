const mysql = require('mysql2/promise');
const { config } = require('dotenv');
config();

(async () => {
  const url = process.env.DATABASE_URL;
  const u = new URL(url);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: u.username,
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false }
  });

  async function hasTable(name) {
    const [rows] = await conn.query('SHOW TABLES LIKE ?', [name]);
    return rows.length > 0;
  }

  async function hasColumn(table, column) {
    const [rows] = await conn.query('SHOW COLUMNS FROM ?? LIKE ?', [table, column]);
    return rows.length > 0;
  }

  async function hasIndex(table, indexName) {
    const [rows] = await conn.query('SHOW INDEX FROM ?? WHERE Key_name = ?', [table, indexName]);
    return rows.length > 0;
  }

  if (!(await hasTable('ExtraChargeItem'))) {
    await conn.query(`
      CREATE TABLE ExtraChargeItem (
        id INT NOT NULL AUTO_INCREMENT,
        code VARCHAR(191) NOT NULL,
        name VARCHAR(191) NOT NULL,
        chargeType ENUM('hall','food','beverage','item','miscellaneous') NOT NULL,
        unitLabel VARCHAR(50) NOT NULL DEFAULT 'each',
        defaultPrice DECIMAL(10,2) NOT NULL,
        taxClassId INT NULL,
        accountId INT NULL,
        allowPriceOverride BOOLEAN NOT NULL DEFAULT false,
        allowComplementary BOOLEAN NOT NULL DEFAULT false,
        isQuickPick BOOLEAN NOT NULL DEFAULT false,
        sortOrder INT NOT NULL DEFAULT 0,
        isActive BOOLEAN NOT NULL DEFAULT true,
        createdBy INT NOT NULL,
        updatedBy INT NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY ExtraChargeItem_code_key (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  if (!(await hasColumn('ExtraChargeItem', 'code'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN code VARCHAR(191) NOT NULL DEFAULT ''");
  }
  if (!(await hasColumn('ExtraChargeItem', 'unitLabel'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN unitLabel VARCHAR(50) NOT NULL DEFAULT 'each'");
  }
  if (!(await hasColumn('ExtraChargeItem', 'taxClassId'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN taxClassId INT NULL");
  }
  if (!(await hasColumn('ExtraChargeItem', 'allowPriceOverride'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN allowPriceOverride BOOLEAN NOT NULL DEFAULT false");
  }
  if (!(await hasColumn('ExtraChargeItem', 'allowComplementary'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN allowComplementary BOOLEAN NOT NULL DEFAULT false");
  }
  if (!(await hasColumn('ExtraChargeItem', 'isQuickPick'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN isQuickPick BOOLEAN NOT NULL DEFAULT false");
  }
  if (!(await hasColumn('ExtraChargeItem', 'sortOrder'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN sortOrder INT NOT NULL DEFAULT 0");
  }
  if (!(await hasColumn('ExtraChargeItem', 'createdBy'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN createdBy INT NOT NULL DEFAULT 1");
  }
  if (!(await hasColumn('ExtraChargeItem', 'updatedBy'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN updatedBy INT NULL");
  }
  if (!(await hasColumn('ExtraChargeItem', 'createdAt'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
  }
  if (!(await hasColumn('ExtraChargeItem', 'updatedAt'))) {
    await conn.query("ALTER TABLE ExtraChargeItem ADD COLUMN updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
  }

  const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM ExtraChargeItem WHERE code IS NULL OR TRIM(code) = ?', ['']);
  if (rows[0].cnt > 0) {
    await conn.query("UPDATE ExtraChargeItem SET code = LOWER(REPLACE(REPLACE(REPLACE(name, ' ', '-'), '/', '-'), '&', '-')) WHERE code IS NULL OR TRIM(code) = ''");
  }

  if (!(await hasIndex('ExtraChargeItem', 'ExtraChargeItem_code_key'))) {
    await conn.query('CREATE UNIQUE INDEX ExtraChargeItem_code_key ON ExtraChargeItem (code)');
  }

  if (!(await hasColumn('ExtraCharge', 'updatedAt'))) {
    await conn.query("ALTER TABLE ExtraCharge ADD COLUMN updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
  }
  if (!(await hasColumn('ExtraCharge', 'idempotencyKey'))) {
    await conn.query("ALTER TABLE ExtraCharge ADD COLUMN idempotencyKey VARCHAR(191) NULL");
  }
  if (!(await hasIndex('ExtraCharge', 'ExtraCharge_idempotencyKey_key'))) {
    await conn.query('CREATE UNIQUE INDEX ExtraCharge_idempotencyKey_key ON ExtraCharge (idempotencyKey)');
  }

  console.log('Manual migration fix applied for ExtraChargeItem and ExtraCharge.');
  await conn.end();
})();
