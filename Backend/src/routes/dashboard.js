const express = require('express');
const router = express.Router();
const { queryAll, queryOne, safeJsonParse, aggregateByField } = require('../database/schema');
const { requireAuth } = require('../middleware/auth');

// All dashboard routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/dashboard/stats — detailed stats scoped to the authenticated user
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    const uid = req.user.uid;

    // Get user's institutions first
    const userInsts = await queryAll('SELECT id FROM institutions WHERE user_id = ?', [uid]);
    const userInstIds = userInsts.map(i => i.id);
    const hasInsts = userInstIds.length > 0;
    const placeholders = hasInsts ? userInstIds.map(() => '?').join(',') : '';

    const [instCount, prodCount, ordCount] = await Promise.all([
      queryAll('SELECT COUNT(*) as count FROM institutions WHERE user_id = ?', [uid]),
      queryAll('SELECT COUNT(*) as count FROM products'),
      queryAll('SELECT COUNT(*) as count FROM orders')
    ]);

    // Get rec counts separately using IN clause
    let recCount = [{ count: 0 }], costResult = [{ total: 0 }], activeRecs = [{ count: 0 }];
    let recommendationsByStatus = [];
    let recentRecommendations = [];
    if (hasInsts) {
      [recCount, costResult, activeRecs, recommendationsByStatus, recentRecommendations] = await Promise.all([
        queryAll(`SELECT COUNT(*) as count FROM recommendations WHERE institution_id IN (${placeholders})`, userInstIds),
        queryAll(`SELECT COALESCE(SUM(total_estimated_cost), 0) as total FROM recommendations WHERE status = 'Processed' AND institution_id IN (${placeholders})`, userInstIds),
        queryAll(`SELECT COUNT(*) as count FROM recommendations WHERE status IN ('Processed', 'Pending_AI') AND institution_id IN (${placeholders})`, userInstIds),
        queryAll(`SELECT status, COUNT(*) as count FROM recommendations WHERE institution_id IN (${placeholders}) GROUP BY status`, userInstIds),
        queryAll(`SELECT id, total_estimated_cost, created_at, status, source, owner, institution_id FROM recommendations WHERE institution_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 10`, userInstIds)
      ]);
      // Enrich recentRecommendations with institution names
      recentRecommendations = await Promise.all((recentRecommendations || []).map(async (rec) => {
        const inst = await queryOne('SELECT name as institution_name, institution_type FROM institutions WHERE id = ?', [rec.institution_id]);
        return { ...rec, ...(inst || {}) };
      }));
    }

    const [rawTypes, rawHygiene, rawBudgets] = await Promise.all([
      queryAll('SELECT institution_type FROM institutions WHERE user_id = ?', [uid]),
      queryAll('SELECT hygiene_standard FROM institutions WHERE user_id = ?', [uid]),
      queryAll('SELECT budget FROM institutions WHERE user_id = ?', [uid])
    ]);
    const institutionsByType = aggregateByField(rawTypes, 'institution_type');
    const hygieneStats = aggregateByField(rawHygiene, 'hygiene_standard');
    const budgetStats = aggregateByField(rawBudgets, 'budget');

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
// GET /api/dashboard/summary — lean aggregated metrics for this user
// ---------------------------------------------------------------------------
router.get('/summary', async (req, res, next) => {
  try {
    const uid = req.user.uid;

    // Get user's institutions first
    const userInsts = await queryAll('SELECT id FROM institutions WHERE user_id = ?', [uid]);
    const userInstIds = userInsts.map(i => i.id);
    const hasInsts = userInstIds.length > 0;
    const placeholders = hasInsts ? userInstIds.map(() => '?').join(',') : '';

    let volumeResult = [{ total_volume: 0 }], activeResult = [{ count: 0 }], historyLogs = [];
    if (hasInsts) {
      [volumeResult, activeResult, historyLogs] = await Promise.all([
        queryAll(`SELECT COALESCE(SUM(total_estimated_cost), 0) as total_volume FROM recommendations WHERE status = 'Processed' AND institution_id IN (${placeholders})`, userInstIds),
        queryAll(`SELECT COUNT(*) as count FROM recommendations WHERE status IN ('Processed', 'Pending_AI', 'Draft') AND institution_id IN (${placeholders})`, userInstIds),
        queryAll(`SELECT id, total_estimated_cost, created_at, status, source, owner, institution_id FROM recommendations WHERE institution_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 20`, userInstIds)
      ]);
      // Enrich history logs with institution names
      historyLogs = await Promise.all((historyLogs || []).map(async (r) => {
        const inst = await queryOne('SELECT name as institution_name, institution_type FROM institutions WHERE id = ?', [r.institution_id]);
        return { ...r, ...(inst || {}) };
      }));
    }

    const [totalProfiles] = await Promise.all([
      queryAll('SELECT COUNT(*) as count FROM institutions WHERE user_id = ?', [uid])
    ]);

    const totalProfilesCount = totalProfiles[0]?.count || 0;
    const totalVolumeInr = volumeResult[0]?.total_volume || 0;
    const activeRecommendations = activeResult[0]?.count || 0;

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
// GET /api/dashboard/institutions — full institution list for this user
// ---------------------------------------------------------------------------
router.get('/institutions', async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const userEmail = req.user.email || '';

    // Step 1: Fetch all institutions for this user (by user_id OR by contact_email)
    // This ensures institutions created under a different auth provider (e.g. Google vs password)
    // but with the same email address still appear in the dashboard.
    const institutions = await queryAll(
      `SELECT * FROM institutions WHERE user_id = ? ORDER BY created_at DESC`,
      [uid]
    );

    // Also fetch institutions that match by contact_email but aren't linked to this uid
    // (Emails are already normalized to lowercase during auth)
    if (userEmail) {
      const emailInsts = await queryAll(
        `SELECT * FROM institutions WHERE contact_email = ? AND user_id != ? ORDER BY created_at DESC`,
        [userEmail.toLowerCase().trim(), uid]
      );
      // Merge email-matched institutions with uid-matched ones (dedup by id)
      if (emailInsts.length > 0) {
        const existingIds = new Set(institutions.map(i => i.id));
        for (const inst of emailInsts) {
          if (!existingIds.has(inst.id)) {
            institutions.push(inst);
          }
        }
        // Re-sort by created_at after merging
        institutions.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }
    }

    // Step 2: Fetch recommendations for these institutions and build a lookup map
    const instIds = institutions.map(i => i.id);
    let recommendationsMap = {};
    if (instIds.length > 0) {
      const placeholders = instIds.map(() => '?').join(',');
      const recs = await queryAll(
        `SELECT * FROM recommendations WHERE institution_id IN (${placeholders}) ORDER BY created_at DESC`,
        instIds
      );
      // Group by institution_id and compute count + pick latest by created_at
      recs.forEach(rec => {
        if (!recommendationsMap[rec.institution_id]) {
          recommendationsMap[rec.institution_id] = { count: 0, latest: null };
        }
        recommendationsMap[rec.institution_id].count++;
        // Track the latest by comparing created_at (order-independent)
        const existing = recommendationsMap[rec.institution_id].latest;
        if (!existing || (rec.created_at && existing.created_at && rec.created_at > existing.created_at)) {
          recommendationsMap[rec.institution_id].latest = rec;
        }
      });
    }

    // Step 3: Merge recommendation data into each institution
    const parsed = institutions.map(inst => {
      const recData = recommendationsMap[inst.id] || { count: 0, latest: null };
      return {
        ...inst,
        recommendation_count: recData.count,
        latest_cost: recData.latest?.total_estimated_cost || null,
        latest_status: recData.latest?.status || null,
        latest_recommendation_date: recData.latest?.created_at || null,
        surface_types: safeJsonParse(inst.surface_types, []),
        metadata: safeJsonParse(inst.metadata, null)
      };
    });

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
