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
let saveTimer = null;
let savePending = false;

// Resolve the data.json path — try project root first, then /tmp for Vercel
function getDataFilePath() {
  return path.join(__dirname, '..', '..', '..', 'data.json');
}
function getTempDataFilePath() {
  return path.join('/tmp', 'data.json');
}

// Load ALL pre-seeded data from data.json (if available)
function seedFromDisk() {
  // Try /tmp/data.json first (Vercel warm instance with persisted data), then project-root data.json (seed)
  const candidates = [getTempDataFilePath(), getDataFilePath()];
  for (const dataFile of candidates) {
    try {
      if (fs.existsSync(dataFile)) {
        const raw = fs.readFileSync(dataFile, 'utf-8');
        const data = JSON.parse(raw);
        const tableMap = {
          INST: 'institutions',
          RECS: 'recommendations',
          ITEMS: 'recommendation_items',
          USERS: 'users',
          PRODUCTS: 'products'
        };
        let totalLoaded = 0;
        for (const [key, tableName] of Object.entries(tableMap)) {
          if (data[key] && data[key].length > 0) {
            const table = memTable(tableName);
            data[key].forEach(row => table.push(row));
            totalLoaded += data[key].length;
            console.log(`  Loaded ${data[key].length} record(s) into "${tableName}" from ${dataFile}`);
          }
        }
        // Backfill user_id on rows that pre-date multi-tenant ownership. If we
        // have any users in the seed, attribute orphan rows to the first user
        // so per-user DELETE / SELECT scoping works correctly.
        try {
          const users = memoryTables.users || [];
          const ownerUid = users.length > 0 ? users[0].uid : null;
          if (ownerUid) {
            const instTable = memoryTables.institutions || [];
            let backfilled = 0;
            instTable.forEach(row => {
              if (row.user_id === undefined || row.user_id === null || row.user_id === '') {
                row.user_id = ownerUid;
                backfilled++;
              }
            });
            if (backfilled > 0) {
              console.log(`  Backfilled user_id on ${backfilled} orphan institution row(s) -> ${ownerUid}`);
            }
          }
        } catch (bfErr) {
          console.warn('  user_id backfill skipped:', bfErr.message);
        }
        if (totalLoaded > 0) {
          console.log(`  Total: ${totalLoaded} records loaded from disk into in-memory engine`);
        }
        return; // Successfully loaded from first candidate
      }
    } catch (err) {
      console.warn(`  Could not load from ${dataFile}: ${err.message}`);
    }
  }
}

// Reload tables from disk into memory (overwriting any in-memory state).
// Required on serverless platforms where each invocation may be a different
// instance — without this, a POST handled by instance A is invisible to a GET
// handled by instance B because /tmp/data.json was written by A but never
// re-read by B. Call before every query to keep cross-instance state coherent.
//
// On Vercel, /tmp/data.json is the authoritative runtime store. The bundled
// project-root data.json is consulted ONLY as a seed source on first cold
// start. To survive deletes across cold starts, we also persist a
// "tombstone" set in /tmp/inst_deletions.json — IDs of institutions that
// have been deleted. On every reload we strip those IDs out of the seed.
let diskMtimeMs = 0;
let deletionsMtimeMs = 0;
function reloadFromDiskIfChanged() {
  if (pool) return; // MySQL mode — disk reload is unnecessary
  try {
    const tmpPath = getTempDataFilePath();
    const rootPath = getDataFilePath();

    let tmpMtime = 0;
    let tmpExists = false;
    try { tmpMtime = fs.statSync(tmpPath).mtimeMs; tmpExists = true; } catch { /* /tmp not present */ }

    let snapshotPath = null;
    let snapshotMtime = 0;
    if (tmpExists) {
      snapshotPath = tmpPath;
      snapshotMtime = tmpMtime;
    } else {
      // Cold start with no /tmp — only consult bundled seed.
      try {
        const s2 = fs.statSync(rootPath);
        snapshotPath = rootPath;
        snapshotMtime = s2.mtimeMs;
      } catch { /* neither file present */ }
    }

    if (!snapshotPath) return;
    if (snapshotMtime > diskMtimeMs) {
      diskMtimeMs = snapshotMtime;
      applyDiskSnapshot(snapshotPath);
    }

    // Always (re)apply deletions, even if the main snapshot mtime didn't
    // advance — a delete operation only writes the tombstone file.
    applyDeletionTombstones();
  } catch (err) {
    // Best-effort — fall through to in-memory state
  }
}

function getDeletionTombstonePath() {
  return path.join('/tmp', 'inst_deletions.json');
}

function applyDeletionTombstones() {
  try {
    const p = getDeletionTombstonePath();
    const s = fs.statSync(p);
    if (s.mtimeMs <= deletionsMtimeMs) return;
    deletionsMtimeMs = s.mtimeMs;
    const raw = fs.readFileSync(p, 'utf-8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;
    const before = memoryTables.institutions.length;
    memoryTables.institutions = memoryTables.institutions.filter(r => !list.includes(r.id));
    const removed = before - memoryTables.institutions.length;
    if (removed > 0) {
      console.log(`  [reload] Applied ${removed} deletion tombstone(s)`);
    }
  } catch { /* no tombstone file yet — normal */ }
}

function applyDiskSnapshot(path) {
  const raw = fs.readFileSync(path, 'utf-8');
  const data = JSON.parse(raw);
  const tableMap = {
    INST: 'institutions',
    RECS: 'recommendations',
    ITEMS: 'recommendation_items',
    USERS: 'users',
    PRODUCTS: 'products'
  };
  for (const [key, tableName] of Object.entries(tableMap)) {
    memoryTables[tableName] = Array.isArray(data[key]) ? data[key].slice() : [];
  }
  // Backfill user_id on orphan institution rows so per-user scoping works.
  const users = memoryTables.users || [];
  const ownerUid = users.length > 0 ? users[0].uid : null;
  if (ownerUid) {
    let backfilled = 0;
    (memoryTables.institutions || []).forEach(row => {
      if (row.user_id === undefined || row.user_id === null || row.user_id === '') {
        row.user_id = ownerUid;
        backfilled++;
      }
    });
    if (backfilled > 0) {
      console.log(`  [reload] Backfilled user_id on ${backfilled} orphan institution row(s)`);
    }
  }
}

// Append a deleted institution ID to the persistent tombstone file so it
// stays gone across Vercel cold starts (where the bundled data.json would
// otherwise be re-seeded and resurrect the row).
function recordDeletion(id) {
  try {
    const p = getDeletionTombstonePath();
    let list = [];
    try { list = JSON.parse(fs.readFileSync(p, 'utf-8')); if (!Array.isArray(list)) list = []; } catch { list = []; }
    if (!list.includes(id)) {
      list.push(id);
      fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8');
      deletionsMtimeMs = Date.now(); // force re-apply next reload
      console.log(`  [delete] Tombstoned institution ${id}`);
    }
  } catch (err) {
    console.warn('  [delete] Could not write deletion tombstone:', err.message);
  }
}

// Save ALL memory tables back to data.json (debounced)
// On Vercel (read-only project filesystem), falls back to /tmp/data.json
function saveToDisk() {
  if (savePending) return;
  savePending = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    savePending = false;
    saveTimer = null;
    flushMemoryToDisk();
  }, 500);
}

// Synchronously write the current in-memory state to disk. Used after writes
// that must be visible to other serverless invocations before the response
// returns — debounced saves can land after the function has been recycled.
function flushMemoryToDisk() {
  try {
    const data = {
      INST: memTable('institutions'),
      RECS: memTable('recommendations'),
      ITEMS: memTable('recommendation_items'),
      USERS: memTable('users'),
      PRODUCTS: memTable('products')
    };
    const json = JSON.stringify(data, null, 2);
    try {
      fs.writeFileSync(getDataFilePath(), json, 'utf-8');
    } catch (writeErr) {
      try {
        fs.writeFileSync(getTempDataFilePath(), json, 'utf-8');
      } catch (tmpErr) {
        console.warn('  [memSQL] Could not persist data to disk (both locations failed):', tmpErr.message);
      }
    }
  } catch (err) {
    console.warn('  [memSQL] Failed to serialize memory tables:', err.message);
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

// Detect whether position i starts a top-level keyword (AND/OR) by checking
// that the previous character is a token boundary (whitespace, paren, comma,
// or the start of the clause). This allows e.g. "? AND" or "(col = ?) AND".
function isKeywordStart(clause, i, keyword) {
  if (clause.substring(i, i + keyword.length).toUpperCase() !== keyword) return false;
  if (i === 0) return true;
  const prev = clause[i - 1];
  return /\s/.test(prev) || prev === '(' || prev === ',' || prev === '?';
}

// Split WHERE clause by top-level OR (not inside parentheses)
function splitOr(where) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < where.length; i++) {
    if (where[i] === '(') depth++;
    else if (where[i] === ')') depth--;
    else if (depth === 0 && isKeywordStart(where, i, ' OR')) {
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
    else if (depth === 0 && isKeywordStart(clause, i, ' AND')) {
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

// Strip trailing ORDER BY / LIMIT / OFFSET clauses from a captured WHERE
// fragment. The SELECT/UPDATE/DELETE regexes use non-greedy `.*` and capture
// everything from "WHERE …" to end-of-string, so ORDER BY clauses leak into
// the WHERE fragment and break memRowMatches. Detect them by keyword boundary
// (whitespace, paren, or comma) and truncate.
function stripTrailingClauses(whereClause) {
  if (!whereClause) return whereClause;
  const upper = whereClause.toUpperCase();
  // Walk the string and find the earliest top-level position where a known
  // trailing clause keyword starts.
  const tailKeywords = ['ORDER BY', 'LIMIT', 'OFFSET', 'GROUP BY', 'HAVING'];
  let cutAt = -1;
  for (const kw of tailKeywords) {
    let searchFrom = 0;
    while (searchFrom < upper.length) {
      const idx = upper.indexOf(kw, searchFrom);
      if (idx === -1) break;
      // Word boundary: must be at start, or preceded by whitespace / ( / ,
      const prev = idx === 0 ? ' ' : upper[idx - 1];
      if (/\s|\(|\,/.test(prev)) {
        if (cutAt === -1 || idx < cutAt) cutAt = idx;
        break;
      }
      searchFrom = idx + 1;
    }
  }
  if (cutAt === -1) return whereClause.trim();
  return whereClause.substring(0, cutAt).trim();
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
      everWritten = true;
      flushMemoryToDisk();
      return { affectedRows: 1 };
    }

    // ── SELECT ──────────────────────────────────────────────────────────
    if (upper.startsWith('SELECT')) {
      const selMatch = s.match(/SELECT\s+(DISTINCT\s+)?(.*?)\s+FROM\s+`?(\w+)`?(?:\s+WHERE\s+(.*))?$/i);
      if (!selMatch) return [];
      const isDistinct = !!selMatch[1];
      const columns = selMatch[2].trim();
      const tableName = selMatch[3];
      // Strip trailing ORDER BY / LIMIT / OFFSET clauses from the captured
      // WHERE fragment. The regex above is non-greedy so it captures
      // everything from "WHERE …" to end-of-string, including ORDER BY and
      // LIMIT clauses that would otherwise poison memRowMatches.
      let whereClause = selMatch[4] || '';
      whereClause = stripTrailingClauses(whereClause);
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
      let whereClause = (updMatch[3] || '').trim();
      whereClause = stripTrailingClauses(whereClause);
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
      if (count > 0) { everWritten = true; flushMemoryToDisk(); }
      return { affectedRows: count };
    }

    // ── DELETE ──────────────────────────────────────────────────────────
    if (upper.startsWith('DELETE')) {
      const delMatch = s.match(/DELETE\s+FROM\s+`?(\w+)`?(?:\s+WHERE\s+(.*))?$/i);
      if (!delMatch) return [];
      const tableName = delMatch[1];
      let whereClause = (delMatch[2] || '').trim();
      whereClause = stripTrailingClauses(whereClause);
      const table = memTable(tableName);
      const before = table.length;
      const removedRows = table.filter(row => memRowMatches(row, whereClause, params));
      memoryTables[tableName] = table.filter(row => !memRowMatches(row, whereClause, params));
      const affected = before - (memoryTables[tableName] || []).length;
      if (affected > 0) {
        // Tombstone removed institution IDs so they survive cold starts on
        // serverless (where the bundled data.json would otherwise resurrect them).
        if (tableName === 'institutions') {
          removedRows.forEach(r => { if (r.id) recordDeletion(r.id); });
        }
        everWritten = true;
        flushMemoryToDisk();
      }
      return { affectedRows: affected };
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
    seedFromDisk();
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

  // Add role column for existing databases (safe if already exists)
  try {
    await pool.execute("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'field_staff' AFTER uid");
  } catch (e) {
    // Column already exists - ignore
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

  // Add product_name and unit_price columns to recommendation_items (for fallback when products table has stale data)
  try {
    await pool.execute('ALTER TABLE recommendation_items ADD COLUMN product_name VARCHAR(255) AFTER product_id');
  } catch (e) { /* Column may already exist */ }
  try {
    await pool.execute('ALTER TABLE recommendation_items ADD COLUMN unit_price DECIMAL(10,2) DEFAULT 0 AFTER monthly_cost');
  } catch (e) { /* Column may already exist */ }

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

  // ── Workflow Events table (audit trail) ───────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS workflow_events (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(255) NOT NULL DEFAULT 'system',
    notes TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Add workflow stage columns to orders (safe if already exist)
  try {
    await pool.execute("ALTER TABLE orders ADD COLUMN workflow_stage VARCHAR(50) DEFAULT 'request_created' AFTER status");
  } catch (e) {}
  try {
    await pool.execute("ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending' AFTER workflow_stage");
  } catch (e) {}
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN paid_amount DECIMAL(12,2) DEFAULT 0 AFTER payment_status');
  } catch (e) {}
  try {
    await pool.execute("ALTER TABLE orders ADD COLUMN sales_approval_status VARCHAR(20) DEFAULT 'pending' AFTER paid_amount");
  } catch (e) {}
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN sales_approved_by VARCHAR(255) AFTER sales_approval_status');
  } catch (e) {}
  try {
    await pool.execute("ALTER TABLE orders ADD COLUMN compliance_status VARCHAR(20) DEFAULT 'pending' AFTER sales_approved_by");
  } catch (e) {}
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN compliance_notes TEXT AFTER compliance_status');
  } catch (e) {}
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN quotation_id VARCHAR(36) AFTER recommendation_id');
  } catch (e) {}
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
  } catch (e) {}

  console.log(' Database schema initialized');
  return pool;
}

async function queryAll(sql, params = []) {
  if (!pool) {
    reloadFromDiskIfChanged();
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
    reloadFromDiskIfChanged();
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
