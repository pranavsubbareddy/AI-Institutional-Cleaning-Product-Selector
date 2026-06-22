const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run, safeJsonParse } = require('../database/schema');
const { requireAuth } = require('../middleware/auth');

// Admin-only middleware
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required', timestamp: new Date().toISOString() });
  }
  next();
});

// GET /api/admin/dashboard - system-wide stats
router.get('/dashboard', async (req, res, next) => {
  try {
    const [instCount, recCount, ordCount, prodCount, usersCount, recCost, recentRecsRaw, recentInsts, typeStats, hygieneStats, budgetStats, statusStats, whCount, stockCount, deliveryCount, salesmanCount, complianceDocs, reorderAlerts] = await Promise.all([
      queryAll('SELECT COUNT(*) as count FROM institutions'),
      queryAll('SELECT COUNT(*) as count FROM recommendations'),
      queryAll('SELECT COUNT(*) as count FROM orders'),
      queryAll('SELECT COUNT(*) as count FROM products'),
      queryAll('SELECT COUNT(*) as count FROM users'),
      queryAll("SELECT COALESCE(SUM(total_estimated_cost), 0) as total FROM recommendations WHERE status = 'Processed'"),
      queryAll('SELECT id, total_estimated_cost, created_at, status, source, owner, institution_id FROM recommendations ORDER BY created_at DESC LIMIT 15'),
      queryAll('SELECT id, name, institution_type, area_size, hygiene_standard, budget, status, user_id, created_at FROM institutions ORDER BY created_at DESC LIMIT 10'),
      queryAll('SELECT institution_type, COUNT(*) as count FROM institutions GROUP BY institution_type ORDER BY count DESC'),
      queryAll('SELECT hygiene_standard, COUNT(*) as count FROM institutions GROUP BY hygiene_standard'),
      queryAll('SELECT budget, COUNT(*) as count FROM institutions GROUP BY budget'),
      queryAll('SELECT status, COUNT(*) as count FROM recommendations GROUP BY status ORDER BY count DESC'),
      queryAll('SELECT COUNT(*) as count FROM warehouses'),
      queryAll('SELECT COUNT(*) as count FROM stock_batches'),
      queryAll("SELECT COUNT(*) as count FROM delivery_runs WHERE status = 'scheduled' OR status = 'in_transit'"),
      queryAll('SELECT COUNT(*) as count FROM salesman_visits'),
      queryAll('SELECT COUNT(*) as count FROM msds_documents'),
      queryAll("SELECT COUNT(*) as count FROM reorder_reminders WHERE status = 'active'")
    ]);

    // Enrich recent recommendations with institution names
    const recentRecs = await Promise.all((recentRecsRaw || []).map(async (rec) => {
      const inst = rec.institution_id ? await queryOne('SELECT name as institution_name, institution_type, user_id FROM institutions WHERE id = ?', [rec.institution_id]) : null;
      return { ...rec, ...(inst || {}) };
    }));

    const activityLog = [];
    (recentRecs || []).forEach(rec => {
      activityLog.push({
        id: 'rec_' + rec.id, type: 'recommendation', action: 'Recommendation processed',
        summary: (rec.institution_name || 'Unknown') + ' - Rs ' + (rec.total_estimated_cost || 0).toLocaleString('en-IN'),
        user: rec.owner || 'AI Engine', timestamp: rec.created_at,
        status: rec.status || 'New',
        total_estimated_cost: rec.total_estimated_cost || 0,
        institution_name: rec.institution_name || 'Unknown',
        link: '/recommendations/' + rec.id
      });
    });
    (recentInsts || []).forEach(inst => {
      activityLog.push({
        id: 'inst_' + inst.id, type: 'institution', action: 'Facility registered',
        summary: inst.name + ' (' + (inst.institution_type || '').replace(/_/g, ' ') + ')',
        user: 'User ' + (inst.user_id || '').slice(0, 8), timestamp: inst.created_at,
        link: '/detail/' + inst.id
      });
    });
    activityLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const totalInst = instCount[0]?.count || 0;
    const processedCount = statusStats.find(s => s.status === 'Processed')?.count || 0;
    const pendingCount = statusStats.find(s => s.status === 'Pending_AI')?.count || 0;

    res.json({
      success: true,
      data: {
        overview: {
          total_institutions: totalInst,
          total_recommendations: recCount[0]?.count || 0,
          total_orders: ordCount[0]?.count || 0,
          total_products: prodCount[0]?.count || 0,
          total_users: usersCount[0]?.count || 0,
          total_estimated_cost: recCost[0]?.total || 0,
          active_recommendations: processedCount + pendingCount
        },
        operations: {
          warehouses: whCount[0]?.count || 0,
          stock_batches: stockCount[0]?.count || 0,
          active_deliveries: deliveryCount[0]?.count || 0,
          salesman_visits: salesmanCount[0]?.count || 0,
          compliance_documents: complianceDocs[0]?.count || 0,
          reorder_alerts: reorderAlerts[0]?.count || 0
        },
        institutions_by_type: typeStats,
        hygiene_stats: hygieneStats,
        budget_stats: budgetStats,
        recommendations_by_status: statusStats,
        recent_activity: activityLog.slice(0, 25),
        recent_recommendations: recentRecs
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

// ── GET /api/admin/users ────────────────────────────────────────────────
// List all users with their roles (excludes password hashes)
router.get('/users', async (req, res, next) => {
  try {
    const users = await queryAll(
      'SELECT uid, email, displayName, phone, photoURL, provider, emailVerified, createdAt, COALESCE(role, ?) as role FROM users ORDER BY createdAt DESC',
      ['field_staff']
    );

    // Add the admin user manually (not in DB)
    users.unshift({
      uid: 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@ganga-maxx.com',
      displayName: 'Administrator',
      phone: '',
      photoURL: null,
      provider: 'admin',
      emailVerified: true,
      createdAt: new Date(0).toISOString(),
      role: 'admin'
    });

    res.json({ success: true, data: users, count: users.length, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// ── PUT /api/admin/users/:uid/role ───────────────────────────────────────
// Update a user's role (promote/demote)
router.put('/users/:uid/role', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { role } = req.body;

    // Prevent changing admin role
    if (uid === 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot change the system admin role', timestamp: new Date().toISOString() });
    }

    const VALID_ROLES = ['field_staff', 'salesman', 'warehouse_staff', 'delivery_coordinator', 'accounts_manager', 'compliance_admin', 'sales_admin'];
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role. Valid roles: ' + VALID_ROLES.join(', '), timestamp: new Date().toISOString() });
    }

    // Use run() for write operations (not queryAll) to ensure proper in-memory engine handling
    const result = await run('UPDATE users SET role = ? WHERE uid = ?', [role, uid]);

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() });
    }

    // Use a simple SELECT without COALESCE to avoid param leaking issues in the in-memory SQL engine
    const user = await queryOne('SELECT uid, email, displayName, phone, photoURL, provider, emailVerified, createdAt, role FROM users WHERE uid = ?', [uid]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found after update', timestamp: new Date().toISOString() });
    }
    // Default role to field_staff if not set (application-level fallback instead of SQL COALESCE)
    if (!user.role) user.role = 'field_staff';

    res.json({ success: true, data: user, message: 'Role updated to ' + role, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// ── GET /api/admin/activity-logs ─────────────────────────────────────
// Paginated activity log built from recommendations and institutions
// Supports filters: type, dateFrom, dateTo (ISO date strings)
router.get('/activity-logs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(5, parseInt(req.query.pageSize) || 20));
    const type = req.query.type || ''; // 'recommendation' or 'institution'
    const dateFrom = req.query.dateFrom || ''; // 'YYYY-MM-DD' or ISO
    const dateTo = req.query.dateTo || '';
    const offset = (page - 1) * pageSize;

    // Fetch more records than needed so we can build a comprehensive log
    const limit = pageSize + offset + 20;
    const [recentRecsRaw, recentInsts, auditLogs] = await Promise.all([
      queryAll(
        'SELECT id, total_estimated_cost, created_at, status, source, owner, institution_id FROM recommendations ORDER BY created_at DESC LIMIT ?',
        [limit]
      ),
      queryAll(
        'SELECT id, name, institution_type, area_size, hygiene_standard, budget, status, user_id, created_at FROM institutions ORDER BY created_at DESC LIMIT ?',
        [limit]
      ),
      queryAll('SELECT * FROM recommendation_audit_log ORDER BY created_at DESC LIMIT ?', [limit])
    ]);
    // Enrich recentRecs with institution names
    const recentRecs = await Promise.all((recentRecsRaw || []).map(async (rec) => {
      const inst = rec.institution_id ? await queryOne('SELECT name as institution_name, institution_type, user_id FROM institutions WHERE id = ?', [rec.institution_id]) : null;
      return { ...rec, ...(inst || {}) };
    }));

    const allEvents = [];
    if (!type || type === 'recommendation') {
      (recentRecs || []).forEach(rec => {
        allEvents.push({
          id: 'rec_' + rec.id, type: 'recommendation', action: 'Recommendation processed',
          summary: (rec.institution_name || 'Unknown') + ' - Rs ' + (rec.total_estimated_cost || 0).toLocaleString('en-IN'),
          user: rec.owner || 'AI Engine', timestamp: rec.created_at,
          link: '/recommendations/' + rec.id
        });
      });
    }
    if (!type || type === 'institution') {
      (recentInsts || []).forEach(inst => {
        allEvents.push({
          id: 'inst_' + inst.id, type: 'institution', action: 'Facility registered',
          summary: inst.name + ' (' + (inst.institution_type || '').replace(/_/g, ' ') + ')',
          user: 'User ' + (inst.user_id || '').slice(0, 8), timestamp: inst.created_at,
          link: '/detail/' + inst.id
        });
      });
    }

    // Audit log events (status changes) — always visible unless filtering by a specific type other than 'status_change'
    if (!type || type === 'status_change') {
      (auditLogs || []).forEach(log => {
        allEvents.push({
          id: 'audit_' + log.id, type: 'status_change', action: 'Status changed',
          old_status: log.old_status || '',
          new_status: log.new_status || '',
          summary: 'Recommendation ' + (log.recommendation_id || '').slice(0, 12) + ' changed from "' + (log.old_status || '—') + '" to "' + log.new_status + '"',
          user: log.changed_by_email || log.changed_by_uid || 'Unknown',
          timestamp: log.created_at,
          link: '/recommendations/' + log.recommendation_id
        });
      });
    }

    // Apply date range filter in-memory
    let filteredEvents = allEvents;
    if (dateFrom || dateTo) {
      const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0;
      const toMs = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity; // include full end day
      filteredEvents = allEvents.filter(ev => {
        const ts = new Date(ev.timestamp).getTime();
        return ts >= fromMs && ts < toMs;
      });
    }

    filteredEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Compute type counts (after date filtering, before type filtering)
    const typeCounts = { all: filteredEvents.length };
    for (const ev of filteredEvents) {
      typeCounts[ev.type] = (typeCounts[ev.type] || 0) + 1;
    }

    const totalEvents = filteredEvents.length;
    const paginatedEvents = filteredEvents.slice(offset, offset + pageSize);
    const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));

    // Also return summary counts for activity log stats
    const [recCount, instCount] = await Promise.all([
      queryAll('SELECT COUNT(*) as count FROM recommendations'),
      queryAll('SELECT COUNT(*) as count FROM institutions')
    ]);

    res.json({
      success: true,
      data: {
        events: paginatedEvents,
        pagination: {
          page,
          pageSize,
          totalEvents,
          totalPages,
          hasMore: page < totalPages
        },
        type_counts: typeCounts,
        summary: {
          total_recommendations: recCount[0]?.count || 0,
          total_institutions: instCount[0]?.count || 0
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

// ── GET /api/admin/audit-logs ────────────────────────────────────────
// Dedicated paginated audit log endpoint with search, date range, and type filters.
// Queries recommendation_audit_log directly and enriches with institution names.
router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize) || 25));
    const search = (req.query.search || '').trim();
    const type = (req.query.type || '').trim();
    const dateFrom = req.query.dateFrom || '';
    const dateTo = req.query.dateTo || '';
    const offset = (page - 1) * pageSize;

    // Fetch all audit logs (the LIMIT is just a safety valve for the in-memory engine)
    const limit = pageSize + offset + 100;
    let auditLogs = await queryAll('SELECT * FROM recommendation_audit_log ORDER BY created_at DESC LIMIT ?', [limit]);

    // Fetch related recommendation data (institution names, etc.) for enrichment
    const recIds = [...new Set((auditLogs || []).map(l => l.recommendation_id).filter(Boolean))];
    const recMap = {};
    if (recIds.length > 0) {
      for (const rid of recIds) {
        const rec = await queryOne('SELECT id, total_estimated_cost, summary, institution_id FROM recommendations WHERE id = ?', [rid]);
        if (rec) {
          const inst = rec.institution_id ? await queryOne('SELECT name as institution_name FROM institutions WHERE id = ?', [rec.institution_id]) : null;
          recMap[rid] = { ...rec, institution_name: inst?.institution_name || 'Unknown' };
        }
      }
    }

    // Enrich and apply filters
    let enriched = (auditLogs || []).map(log => ({
      ...log,
      institution_name: recMap[log.recommendation_id]?.institution_name || 'Unknown',
      recommendation_summary: recMap[log.recommendation_id]?.summary || '',
      total_cost: recMap[log.recommendation_id]?.total_estimated_cost || 0
    }));

    // Apply type filter (status_change is default; also support 'recommendation' and 'institution' for consistency)
    // Since this is the dedicated audit log endpoint, 'type' here is for UI filter options
    if (type && type !== 'all') {
      // recommendation_audit_log only has status changes, so type filtering is limited
      // We keep this for future extensibility
    }

    // Apply search filter
    if (search) {
      const q = search.toLowerCase();
      enriched = enriched.filter(log =>
        log.recommendation_id?.toLowerCase().includes(q) ||
        log.new_status?.toLowerCase().includes(q) ||
        (log.old_status || '').toLowerCase().includes(q) ||
        log.changed_by_email?.toLowerCase().includes(q) ||
        log.changed_by_uid?.toLowerCase().includes(q) ||
        log.institution_name?.toLowerCase().includes(q)
      );
    }

    // Apply date range filter
    if (dateFrom || dateTo) {
      const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0;
      const toMs = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
      enriched = enriched.filter(log => {
        const ts = new Date(log.created_at).getTime();
        return ts >= fromMs && ts < toMs;
      });
    }

    const totalEvents = enriched.length;
    const paginated = enriched.slice(offset, offset + pageSize);
    const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));

    // Aggregated stats
    const [recCount, instCount, totalAuditCount] = await Promise.all([
      queryAll('SELECT COUNT(*) as count FROM recommendations'),
      queryAll('SELECT COUNT(*) as count FROM institutions'),
      queryAll('SELECT COUNT(*) as count FROM recommendation_audit_log')
    ]);

    res.json({
      success: true,
      data: {
        events: paginated,
        pagination: {
          page,
          pageSize,
          totalEvents,
          totalPages,
          hasMore: page < totalPages
        },
        summary: {
          total_recommendations: recCount[0]?.count || 0,
          total_institutions: instCount[0]?.count || 0,
          total_audit_entries: totalAuditCount[0]?.count || 0
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

module.exports = router;
