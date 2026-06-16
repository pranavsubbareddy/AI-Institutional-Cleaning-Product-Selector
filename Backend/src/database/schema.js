const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

let pool = null;

// ── In-memory SQL engine (fallback when no MySQL database is available) ──
// Stores data in a simple object-of-arrays so auth, institutions, etc. work
// even without DATABASE_URL. On cold start, users are loaded from data.json
// (deployed with the code) so the main account never gets lost.
// ─────────────────────────────────────────────────────────────────────────
const memoryTables = {};

// Load pre-seeded user data from data.json (if available)
function seedUsersFromDisk() {
  const dataFile = path.join(__dirname, '..', '..', '..', 'data.json');
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      const data = JSON.parse(raw);
      if (data.USERS && data.USERS.length > 0) {
        const users = memTable('users');
        data.USERS.forEach(u => users.push(u));
        console.log('  Loaded ' + data.USERS.length + ' pre-seeded user(s) from data.json');
      }
    }
  } catch (err) {
    console.warn('  Could not load users from data.json:', err.message);
  }
}

function memTable(name) {
  if (!memoryTables[name]) {
    memoryTables[name] = [];
  }
  return memoryTables[name];
}

// Minimal SQL tokenizer: splits on whitespace, keeps quoted strings intact
function tokenize(sql) {
  const tokens = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      current += ch;
      if (ch === stringChar) inString = false;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      if (current) { tokens.push(current); current = ''; }
      inString = true;
      stringChar = ch;
      current = ch;
    } else if (ch === '(' || ch === ')' || ch === ',') {
      if (current && current.trim()) { tokens.push(current.trim()); current = ''; }
      tokens.push(ch);
    } else if (/\s/.test(ch)) {
      if (current && current.trim()) { tokens.push(current.trim()); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current && current.trim()) tokens.push(current.trim());
  return tokens;
}

// Split WHERE clause by top-level OR (not inside parentheses)
function splitOr(where) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < where.length; i++) {
    if (where[i] === '(') depth++;
    else if (where[i] === ')') depth--;
    else if (depth === 0 && where.substring(i, i + 3).toUpperCase() === ' OR' && (i === 0 || /\s/.test(where[i - 1]))) {
      parts.push(where.substring(start, i).trim());
      i += 2;
      start = i + 1;
    }
  }
  parts.push(where.substring(start).trim());
  return parts.filter(Boolean);
}

// Split a clause by top-level AND
function splitAnd(clause) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < clause.length; i++) {
    if (clause[i] === '(') depth++;
    else if (clause[i] === ')') depth--;
    else if (depth === 0 && clause.substring(i, i + 4).toUpperCase() === ' AND' && (i === 0 || /\s/.test(clause[i - 1]))) {
      parts.push(clause.substring(start, i).trim());
      i += 3;
      start = i + 1;
    }
  }
  parts.push(clause.substring(start).trim());
  return parts.filter(Boolean);
}

// Parse a condition like `col = ?` or `col = 'value'` or `col IS NULL`
// Returns { column, op, paramIndex } or null
function parseCondition(cond) {
  const cleaned = cond.replace(/^\(|\)$/g, '').trim();
  // col = ?
  const eqMatch = cleaned.match(/^`?(\w+)`?\s*=\s*\?$/);
  if (eqMatch) return { column: eqMatch[1], op: 'eq', paramIndex: true };
  // col = 'value'
  const valMatch = cleaned.match(/^`?(\w+)`?\s*=\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")$/);
  if (valMatch) return { column: valMatch[1], op: 'eq', value: valMatch[2].replace(/^['"]|['"]$/g, '') };
  // col IS NULL
  const nullMatch = cleaned.match(/^`?(\w+)`?\s+IS\s+NULL$/i);
  if (nullMatch) return { column: nullMatch[1], op: 'isnull' };
  // col IS NOT NULL
  const notNullMatch = cleaned.match(/^`?(\w+)`?\s+IS\s+NOT\s+NULL$/i);
  if (notNullMatch) return { column: notNullMatch[1], op: 'isnotnull' };
  // col <= ?, col >= ?, col < ?, col > ?
  const ineqMatch = cleaned.match(/^`?(\w+)`?\s*(<=|>=|<|>)\s*\?$/);
  if (ineqMatch) return { column: ineqMatch[1], op: ineqMatch[2], paramIndex: true };
  // col != ?
  const neqMatch = cleaned.match(/^`?(\w+)`?\s*(!=|<>)\s*\?$/);
  if (neqMatch) return { column: neqMatch[1], op: 'neq', paramIndex: true };
  // col IN (?, ?, ...)
  const inMatch = cleaned.match(/^`?(\w+)`?\s+IN\s*\(([^)]+)\)$/i);
  if (inMatch) {
    const placeholders = inMatch[2].split(',').map(s => s.trim());
    return { column: inMatch[1], op: 'in', paramCount: placeholders.filter(p => p === '?').length };
  }
  return null;
}

// Check if a row matches a single parsed condition
function rowMatchesCond(row, cond, paramIndex, params) {
  const val = row[cond.column];
  if (cond.op === 'eq') {
    if ('value' in cond) return String(val) === cond.value;
    const p = params[paramIndex];
    return val === p || String(val) === String(p) || Number(val) === Number(p);
  } else if (cond.op === 'neq') {
    return String(val) !== String(params[paramIndex]);
  } else if (cond.op === 'isnull') {
    return val === null || val === undefined || val === '';
  } else if (cond.op === 'isnotnull') {
    return val !== null && val !== undefined && val !== '';
  } else if (cond.op === '<') return Number(val) < Number(params[paramIndex]);
  else if (cond.op === '>') return Number(val) > Number(params[paramIndex]);
  else if (cond.op === '<=') return Number(val) <= Number(params[paramIndex]);
  else if (cond.op === '>=') return Number(val) >= Number(params[paramIndex]);
  else if (cond.op === 'in') {
    const inParams = params.slice(paramIndex, paramIndex + cond.paramCount);
    return inParams.some(p => String(val) === String(p));
  }
  return false;
}

// Check if a row matches a WHERE clause
function memRowMatches(row, whereClause, params) {
  if (!whereClause || !whereClause.trim()) return true;
  const orParts = splitOr(whereClause);
  for (const orPart of orParts) {
    const andParts = splitAnd(orPart);
    let allMatch = true;
    let pi = 0;
    for (const andPart of andParts) {
      const cond = parseCondition(andPart);
      if (!cond) { /* Unknown condition, advance past ? placeholders */ pi += (andPart.match(/\?/g) || []).length; continue; }
      if (cond.paramIndex === true && typeof cond.paramCount === 'undefined') {
        if (!rowMatchesCond(row, cond, pi, params)) { allMatch = false; break; }
        pi++;
      } else if (cond.paramCount) {
        if (!rowMatchesCond(row, cond, pi, params)) { allMatch = false; break; }
        pi += cond.paramCount;
      } else {
        if (!rowMatchesCond(row, cond, 0, params)) { allMatch = false; break; }
      }
    }
    if (allMatch) return true;
  }
  return false;
}

// Normalize SQL for parsing (collapse whitespace, uppercase keywords)
function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

// In-memory queryAll implementation
function memQueryAll(sql, params) {
  const s = normalizeSql(sql);
  const upper = s.toUpperCase();

  try {
    // ── INSERT ──────────────────────────────────────────────────────────
    if (upper.startsWith('INSERT INTO')) {
      const insMatch = s.match(/INSERT\s+INTO\s+`?(\w+)`?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (!insMatch) return [];
      const tableName = insMatch[1];
      const columns = insMatch[2].split(',').map(c => c.trim().replace(/`/g, ''));
      const row = {};
      columns.forEach((col, i) => { row[col] = params[i] !== undefined ? params[i] : null; });
      memTable(tableName).push(row);
      return { affectedRows: 1 };
    }

    // ── SELECT ──────────────────────────────────────────────────────────
    if (upper.startsWith('SELECT')) {
      const selMatch = s.match(/SELECT\s+(DISTINCT\s+)?(.*?)\s+FROM\s+`?(\w+)`?(?:\s+WHERE\s+(.*))?$/i);
      if (!selMatch) return [];
      const isDistinct = !!selMatch[1];
      const columns = selMatch[2].trim();
      const tableName = selMatch[3];
      const whereClause = selMatch[4] || '';
      let rows = memTable(tableName).filter(row => memRowMatches(row, whereClause, params));
      if (isDistinct) {
        const seen = new Set();
        rows = rows.filter(row => {
          const key = JSON.stringify(Object.entries(row).sort());
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (columns === '*') return rows;
      const colNames = columns.split(',').map(c => c.trim().replace(/`/g, ''));
      return rows.map(row => {
        const obj = {};
        colNames.forEach(c => { obj[c] = row[c] !== undefined ? row[c] : null; });
        return obj;
      });
    }

    // ── UPDATE ──────────────────────────────────────────────────────────
    if (upper.startsWith('UPDATE')) {
      const updMatch = s.match(/UPDATE\s+`?(\w+)`?\s+SET\s+(.*?)(?:\s+WHERE\s+(.*))?$/i);
      if (!updMatch) return [];
      const tableName = updMatch[1];
      const setClause = updMatch[2];
      const whereClause = (updMatch[3] || '').trim();
      const setParts = setClause.split(',').map(p => {
        const m = p.trim().match(/^`?(\w+)`?\s*=\s*\?$/);
        return m ? m[1] : null;
      }).filter(Boolean);
      const setValues = params.slice(0, setParts.length);
      const whereParams = params.slice(setParts.length);
      const table = memTable(tableName);
      let count = 0;
      table.forEach(row => {
        if (memRowMatches(row, whereClause, whereParams)) {
          setParts.forEach((col, i) => { row[col] = setValues[i]; });
          count++;
        }
      });
      return { affectedRows: count };
    }

    // ── DELETE ──────────────────────────────────────────────────────────
    if (upper.startsWith('DELETE')) {
      const delMatch = s.match(/DELETE\s+FROM\s+`?(\w+)`?(?:\s+WHERE\s+(.*))?$/i);
      if (!delMatch) return [];
      const tableName = delMatch[1];
      const whereClause = (delMatch[2] || '').trim();
      const table = memTable(tableName);
      const before = table.length;
      memoryTables[tableName] = table.filter(row => !memRowMatches(row, whereClause, params));
      return { affectedRows: before - (memoryTables[tableName] || []).length };
    }
  } catch (err) {
    console.error('[memSQL] Error executing in-memory query:', err.message);
    console.error('[memSQL] SQL:', sql);
    console.error('[memSQL] Params:', JSON.stringify(params));
    if (upper.startsWith('SELECT')) return [];
    return { affectedRows: 0 };
  }

  return [];
}

// ── Database pool management ─────────────────────────────────────────────

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
    pool = mysql.createPool({
      uri: databaseUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      connectTimeout: 10000
    });
    console.log(' Connected to MySQL via DATABASE_URL');
  } else if (process.env.DB_HOST || process.env.DB_USER) {
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'cleaning_platform';

    const tempConn = await mysql.createConnection({ host, user, password, connectTimeout: 5000 });
    await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await tempConn.end();

    pool = mysql.createPool({
      host, user, password, database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      connectTimeout: 10000
    });
    console.log(' Connected to MySQL database:', database);
  } else {
    // No database configured — run in memory-only mode
    console.log(' No database configured. Running in memory-only mode. Set DATABASE_URL for persistent storage.');
    // pool stays null; queryAll/queryOne/run will use the in-memory engine
    // Load pre-seeded users from data.json so main account survives cold starts
    seedUsersFromDisk();
    return null;
  }

  // NOTE: MySQL 9.7 does not allow DEFAULT values on TEXT/BLOB/JSON columns.
  // JSON fields are stored as TEXT and application code handles null -> '[]' fallback.

  await pool.execute(`CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(36) PRIMARY KEY,
    sku VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    surface_types TEXT,
    dilution_ratio VARCHAR(500),
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
    user_id VARCHAR(50) DEFAULT NULL,
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
    dilution_ratio VARCHAR(500),
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

  // ── Users table ─────────────────────────────────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    displayName VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT '',
    age INT NULL,
    gender VARCHAR(20) DEFAULT '',
    photoURL VARCHAR(500),
    provider VARCHAR(50) DEFAULT 'password',
    emailVerified TINYINT(1) DEFAULT 0,
    emailVerificationToken VARCHAR(255),
    emailVerificationExpires DATETIME,
    resetPasswordToken VARCHAR(255),
    resetPasswordExpires DATETIME,
    createdAt VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  // Widen uid column on existing tables (safe if already widened)
  try {
    await pool.execute('ALTER TABLE users MODIFY COLUMN uid VARCHAR(50)');
  } catch (e) {
    // Ignore - column already wide enough
  }
  // Add new auth columns safely (ignore if already exist)
  const newColumns = [
    'emailVerified TINYINT(1) DEFAULT 0',
    'emailVerificationToken VARCHAR(255)',
    'emailVerificationExpires DATETIME',
    'resetPasswordToken VARCHAR(255)',
    'resetPasswordExpires DATETIME'
  ];
  for (const col of newColumns) {
    try {
      await pool.execute(`ALTER TABLE users ADD COLUMN ${col}`);
    } catch (e) {
      // Column already exists - ignore
    }
  }

  // Add user_id column for existing databases (safe if already exists)
  try {
    await pool.execute('ALTER TABLE institutions ADD COLUMN user_id VARCHAR(50) DEFAULT NULL AFTER status');
  } catch (e) {
    // Column already exists - ignore
  }
  // Add metadata column for existing databases (safe if already exists)
  try {
    await pool.execute('ALTER TABLE institutions ADD COLUMN metadata TEXT AFTER address');
  } catch (e) {
    // Column already exists - ignore
  }

  // Widen dilution_ratio columns to accommodate AI-generated values (safe if already widened)
  try {
    await pool.execute('ALTER TABLE products MODIFY COLUMN dilution_ratio VARCHAR(500)');
  } catch (e) {
    // Column already wide enough
  }
  try {
    await pool.execute('ALTER TABLE recommendation_items MODIFY COLUMN dilution_ratio VARCHAR(500)');
  } catch (e) {
    // Column already wide enough
  }

  console.log(' Database schema initialized');
  return pool;
}

async function queryAll(sql, params = []) {
  if (!pool) {
    return memQueryAll(sql, params);
  }
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
  if (!pool) {
    return memQueryAll(sql, params);
  }
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

// ── Safe JSON parsing utility ────────────────────────────────────────────
// Handles malformed or plain-string values gracefully, falling back to a default.
function safeJsonParse(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value; // Already parsed
  // If it's a plain word (no brackets/braces), it's not JSON — treat as fallback
  if (!/^[\[\{]/.test(value.trim())) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    console.warn('[safeJsonParse] Failed to parse:', value);
    return fallback;
  }
}

module.exports = { getPool, initializeSchema, queryAll, queryOne, run, closePool, safeJsonParse };
