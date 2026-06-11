const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeSchema() first.');
  }
  return pool;
}

async function initializeSchema() {
  // Support both DATABASE_URL (PlanetScale) and individual DB_* env vars
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // PlanetScale provides a connection string like:
    // mysql://username:password@host/dbname?ssl={"rejectUnauthorized":true}
    pool = mysql.createPool({
      uri: databaseUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true
    });
    console.log(' Connected to MySQL via DATABASE_URL');
  } else {
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'cleaning_platform';

    const tempConn = await mysql.createConnection({ host, user, password });
    await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await tempConn.end();

    pool = mysql.createPool({
      host, user, password, database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true
    });
    console.log(' Connected to MySQL database:', database);
  }

  console.log(' Connected to MySQL database:', database);

  // NOTE: MySQL 9.7 does not allow DEFAULT values on TEXT/BLOB/JSON columns.
  // JSON fields are stored as TEXT and application code handles null -> '[]' fallback.

  await pool.execute(`CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(36) PRIMARY KEY,
    sku VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    surface_types TEXT,
    dilution_ratio VARCHAR(100),
    unit VARCHAR(50) NOT NULL DEFAULT 'litre',
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    coverage_per_unit DECIMAL(10,2) DEFAULT 0,
    safety_notes TEXT,
    usage_guidance TEXT,
    hygiene_level VARCHAR(20) DEFAULT 'standard',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS institutions (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    institution_type VARCHAR(50) NOT NULL,
    area_size DECIMAL(10,2) NOT NULL,
    surface_types TEXT,
    hygiene_standard VARCHAR(20) NOT NULL DEFAULT 'standard',
    budget VARCHAR(20) NOT NULL DEFAULT 'medium',
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    metadata TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS recommendations (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_estimated_cost DECIMAL(12,2) DEFAULT 0,
    monthly_total_quantity DECIMAL(12,2) DEFAULT 0,
    summary TEXT,
    alerts TEXT,
    source VARCHAR(50) DEFAULT 'AI_Engine',
    owner VARCHAR(100) DEFAULT 'system',
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS recommendation_items (
    id VARCHAR(36) PRIMARY KEY,
    recommendation_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    quantity_estimate DECIMAL(10,2) NOT NULL DEFAULT 0,
    dilution_ratio VARCHAR(100),
    monthly_cost DECIMAL(10,2) DEFAULT 0,
    usage_frequency VARCHAR(50),
    priority INT DEFAULT 0,
    usage_guidance TEXT,
    safety_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recommendation_id) REFERENCES recommendations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS quotation_kits (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    products TEXT,
    total_price DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location TEXT,
    contact_person VARCHAR(255),
    contact_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS stock_batches (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    recommendation_id VARCHAR(36),
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(12,2) DEFAULT 0,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivery_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (recommendation_id) REFERENCES recommendations(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS delivery_runs (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    driver_name VARCHAR(255),
    vehicle_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'scheduled',
    scheduled_date DATE,
    completed_date DATETIME,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS salesman_visits (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    salesman_name VARCHAR(255) NOT NULL,
    visit_date DATE NOT NULL,
    purpose TEXT,
    notes TEXT,
    follow_up_date DATE,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS reorder_reminders (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    institution_id VARCHAR(36),
    threshold_quantity DECIMAL(10,2) NOT NULL DEFAULT 10,
    current_stock DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS contract_prices (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    institution_id VARCHAR(36) NOT NULL,
    contract_price DECIMAL(10,2) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS tier_discounts (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    min_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_quantity DECIMAL(10,2),
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS msds_documents (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_url TEXT,
    version VARCHAR(20) DEFAULT '1.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS compliance_acknowledgements (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    acknowledged_by VARCHAR(255) NOT NULL,
    acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES msds_documents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Add metadata column for existing databases (safe if already exists)
  try {
    await pool.execute('ALTER TABLE institutions ADD COLUMN metadata TEXT AFTER address');
  } catch (e) {
    // Column already exists - ignore
  }

  console.log(' Database schema initialized');
  return pool;
}

async function queryAll(sql, params = []) {
  const p = getPool();
  // Use query() instead of execute() for params like LIMIT/OFFSET that prepared stmts don't support
  const [rows] = await p.query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function run(sql, params = []) {
  const p = getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, initializeSchema, queryAll, queryOne, run, closePool };
