// Automated Reminder Service
// Handles scheduled checks for reorder alerts, follow-up reminders,
// and sends notifications via email or creates notification records.

const { queryAll, run } = require('../database/schema');

// ── Check Reorder Thresholds ─────────────────────────────────────────
async function checkReorderAlerts() {
  try {
    const lowStock = await queryAll(
      'SELECT rr.*, p.name as product_name, p.sku FROM reorder_reminders rr LEFT JOIN products p ON rr.product_id = p.id WHERE rr.current_stock <= rr.threshold_quantity AND rr.status = \'active\''
    );
    return lowStock.map(item => ({
      type: 'reorder_alert',
      severity: 'high',
      message: `Low stock: ${item.product_name} (${item.sku}) - ${item.current_stock} units remaining (threshold: ${item.threshold_quantity})`,
      data: item,
      created_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('[ReminderService] Reorder check error:', err.message);
    return [];
  }
}

// ── Check Follow-up Reminders ────────────────────────────────────────
async function checkFollowUpReminders() {
  try {
    const upcoming = await queryAll(
      'SELECT sv.*, i.name as institution_name, i.contact_name, i.contact_phone FROM salesman_visits sv LEFT JOIN institutions i ON sv.institution_id = i.id WHERE sv.follow_up_date IS NOT NULL AND sv.follow_up_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY) AND sv.status = \'completed\' ORDER BY sv.follow_up_date ASC'
    );
    return upcoming.map(visit => ({
      type: 'follow_up',
      severity: 'medium',
      message: `Follow-up needed: Visit to ${visit.institution_name} on ${visit.visit_date}. Follow-up by ${visit.follow_up_date}`,
      data: visit,
      created_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('[ReminderService] Follow-up check error:', err.message);
    return [];
  }
}

// ── Check Expiring Contracts ─────────────────────────────────────────
async function checkExpiringContracts() {
  try {
    const expiring = await queryAll(
      'SELECT cp.*, p.name as product_name, i.name as institution_name FROM contract_prices cp LEFT JOIN products p ON cp.product_id = p.id LEFT JOIN institutions i ON cp.institution_id = i.id WHERE cp.valid_to IS NOT NULL AND cp.valid_to <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND cp.valid_to >= CURDATE() ORDER BY cp.valid_to ASC'
    );
    return expiring.map(contract => ({
      type: 'contract_expiring',
      severity: 'medium',
      message: `Contract expiring: ${contract.product_name} for ${contract.institution_name} expires on ${contract.valid_to}`,
      data: contract,
      created_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('[ReminderService] Contract expiry check error:', err.message);
    return [];
  }
}

// ── Check Pending Deliveries ─────────────────────────────────────────
async function checkPendingDeliveries() {
  try {
    const pending = await queryAll(
      'SELECT dr.*, o.institution_id, i.name as institution_name FROM delivery_runs dr LEFT JOIN orders o ON dr.order_id = o.id LEFT JOIN institutions i ON o.institution_id = i.id WHERE dr.status = \'scheduled\' AND dr.scheduled_date <= CURDATE() ORDER BY dr.scheduled_date ASC'
    );
    return pending.map(del => ({
      type: 'delivery_pending',
      severity: 'high',
      message: `Pending delivery to ${del.institution_name} scheduled for ${del.scheduled_date}. Driver: ${del.driver_name || 'Not assigned'}`,
      data: del,
      created_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('[ReminderService] Delivery check error:', err.message);
    return [];
  }
}

// ── Check Pending Compliance Acknowledgements ────────────────────────
async function checkPendingCompliance() {
  try {
    const pending = await queryAll(
      'SELECT i.id, i.name FROM institutions i WHERE i.id NOT IN (SELECT DISTINCT institution_id FROM compliance_acknowledgements)'
    );
    return pending.map(inst => ({
      type: 'compliance_pending',
      severity: 'low',
      message: `Compliance acknowledgement pending for ${inst.name}`,
      data: inst,
      created_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error('[ReminderService] Compliance check error:', err.message);
    return [];
  }
}

// ── Run All Checks ───────────────────────────────────────────────────
async function runAllChecks() {
  const results = await Promise.all([
    checkReorderAlerts(),
    checkFollowUpReminders(),
    checkExpiringContracts(),
    checkPendingDeliveries(),
    checkPendingCompliance()
  ]);
  const allAlerts = results.flat();
  console.log('[ReminderService] Check complete:', allAlerts.length, 'alerts generated');
  return allAlerts;
}

module.exports = { runAllChecks, checkReorderAlerts, checkFollowUpReminders, checkExpiringContracts, checkPendingDeliveries, checkPendingCompliance };
