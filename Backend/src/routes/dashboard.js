const express = require('express');
const router = express.Router();
const { queryAll } = require('../database/schema');

// ---------------------------------------------------------------------------
// GET /api/dashboard/stats — detailed stats for the dashboard view
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    const [instCount, recCount, prodCount, ordCount] = await Promise.all([
      queryAll('SELECT COUNT(*) as count FROM institutions'),
      queryAll('SELECT COUNT(*) as count FROM recommendations'),
      queryAll('SELECT COUNT(*) as count FROM products'),
      queryAll('SELECT COUNT(*) as count FROM orders')
    ]);

    const [institutionsByType, recommendationsByStatus, costResult, recentRecommendations, hygieneStats, budgetStats, activeRecs] = await Promise.all([
      queryAll('SELECT institution_type, COUNT(*) as count FROM institutions GROUP BY institution_type ORDER BY count DESC'),
      queryAll('SELECT status, COUNT(*) as count FROM recommendations GROUP BY status'),
      queryAll("SELECT COALESCE(SUM(total_estimated_cost), 0) as total FROM recommendations WHERE status = 'Processed'"),
      queryAll(`SELECT r.id, r.total_estimated_cost, r.created_at, r.status, r.source, r.owner,
              i.name as institution_name, i.institution_type
       FROM recommendations r
       JOIN institutions i ON r.institution_id = i.id
       ORDER BY r.created_at DESC
       LIMIT 10`),
      queryAll('SELECT hygiene_standard, COUNT(*) as count FROM institutions GROUP BY hygiene_standard'),
      queryAll('SELECT budget, COUNT(*) as count FROM institutions GROUP BY budget'),
      queryAll("SELECT COUNT(*) as count FROM recommendations WHERE status IN ('Processed', 'Pending_AI')")
    ]);

    const totalEstimatedCost = costResult[0]?.total || 0;

    res.json({
      success: true,
      data: {
        overview: {
          total_institutions: instCount[0]?.count || 0,
          total_recommendations: recCount[0]?.count || 0,
          total_products: prodCount[0]?.count || 0,
          total_orders: ordCount[0]?.count || 0,
          total_estimated_cost: totalEstimatedCost,
          active_recommendations: activeRecs[0]?.count || 0
        },
        institutions_by_type: institutionsByType,
        recommendations_by_status: recommendationsByStatus,
        hygiene_stats: hygieneStats,
        budget_stats: budgetStats,
        recent_recommendations: recentRecommendations
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/summary — lean aggregated metrics for top-level view
// Returns: total profiles, total calculated volume (INR), active recs count,
//          and a list of history logs (last 20)
// ---------------------------------------------------------------------------
router.get('/summary', async (req, res, next) => {
  try {
    const [totalProfiles, volumeResult, activeResult, historyLogs] = await Promise.all([
      queryAll('SELECT COUNT(*) as count FROM institutions'),
      queryAll("SELECT COALESCE(SUM(total_estimated_cost), 0) as total_volume FROM recommendations WHERE status = 'Processed'"),
      queryAll("SELECT COUNT(*) as count FROM recommendations WHERE status IN ('Processed', 'Pending_AI', 'Draft')"),
      queryAll(`SELECT r.id, r.total_estimated_cost, r.created_at, r.status, r.source, r.owner,
              r.institution_id, i.name as institution_name, i.institution_type
       FROM recommendations r
       JOIN institutions i ON r.institution_id = i.id
       ORDER BY r.created_at DESC
       LIMIT 20`)
    ]);

    const totalProfilesCount = totalProfiles[0]?.count || 0;
    const totalVolumeInr = volumeResult[0]?.total_volume || 0;
    const activeRecommendations = activeResult[0]?.count || 0;

    // Format history logs cleanly
    const formattedLogs = historyLogs.map(log => ({
      id: log.id,
      institution_id: log.institution_id,
      institution_name: log.institution_name,
      institution_type: log.institution_type,
      total_estimated_cost: log.total_estimated_cost,
      status: log.status,
      source: log.source || 'AI_Engine',
      owner: log.owner || 'system',
      created_at: log.created_at,
      iso_timestamp: new Date(log.created_at).toISOString()
    }));

    res.json({
      success: true,
      data: {
        total_profiles_created: totalProfilesCount,
        total_calculated_volume_inr: totalVolumeInr,
        active_recommendations: activeRecommendations,
        history_logs: formattedLogs
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/institutions — full institution list for dashboard tables
// ---------------------------------------------------------------------------
router.get('/institutions', async (req, res, next) => {
  try {
    const institutions = await queryAll(
      `SELECT i.*,
              (SELECT COUNT(*) FROM recommendations WHERE institution_id = i.id) as recommendation_count,
              (SELECT total_estimated_cost FROM recommendations WHERE institution_id = i.id ORDER BY created_at DESC LIMIT 1) as latest_cost,
              (SELECT status FROM recommendations WHERE institution_id = i.id ORDER BY created_at DESC LIMIT 1) as latest_status,
              (SELECT created_at FROM recommendations WHERE institution_id = i.id ORDER BY created_at DESC LIMIT 1) as latest_recommendation_date
       FROM institutions i
       ORDER BY i.created_at DESC`
    );

    const parsed = institutions.map(inst => ({
      ...inst,
      surface_types: JSON.parse(inst.surface_types || '[]')
    }));

    res.json({
      success: true,
      count: parsed.length,
      data: parsed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
