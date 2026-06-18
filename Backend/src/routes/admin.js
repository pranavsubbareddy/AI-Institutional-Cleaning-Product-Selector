const express = require('express');
const router = express.Router();
const { queryAll, safeJsonParse } = require('../database/schema');
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
    const [instCount, recCount, ordCount, prodCount, usersCount, recCost, recentRecs, recentInsts, typeStats, hygieneStats, budgetStats, statusStats, whCount, stockCount, deliveryCount, salesmanCount, complianceDocs, reorderAlerts] = await Promise.all([
      queryAll('SELECT COUNT(*) as count FROM institutions'),
      queryAll('SELECT COUNT(*) as count FROM recommendations'),
      queryAll('SELECT COUNT(*) as count FROM orders'),
      queryAll('SELECT COUNT(*) as count FROM products'),
      queryAll('SELECT COUNT(*) as count FROM users'),
      queryAll("SELECT COALESCE(SUM(total_estimated_cost), 0) as total FROM recommendations WHERE status = 'Processed'"),
      queryAll('SELECT r.id, r.total_estimated_cost, r.created_at, r.status, r.source, r.owner, i.name as institution_name, i.institution_type, i.user_id FROM recommendations r JOIN institutions i ON r.institution_id = i.id ORDER BY r.created_at DESC LIMIT 15'),
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

    const activityLog = [];
    (recentRecs || []).forEach(rec => {
      activityLog.push({
        id: 'rec_' + rec.id, type: 'recommendation', action: 'Recommendation processed',
        summary: (rec.institution_name || 'Unknown') + ' - Rs ' + (rec.total_estimated_cost || 0).toLocaleString('en-IN'),
        user: rec.owner || 'AI Engine', timestamp: rec.created_at,
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

    const result = await queryAll('UPDATE users SET role = ? WHERE uid = ?', [role, uid]);

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() });
    }

    const user = await queryOne('SELECT uid, email, displayName, phone, photoURL, provider, emailVerified, createdAt, COALESCE(role, ?) as role FROM users WHERE uid = ?', ['field_staff', uid]);

    res.json({ success: true, data: user, message: 'Role updated to ' + role, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

module.exports = router;
