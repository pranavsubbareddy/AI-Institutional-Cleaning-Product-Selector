// Role-based Authorization Middleware
// User roles and their hierarchy:
//   admin           - Super admin, can do everything
//   sales_admin     - Monitors all sales activities
//   accounts_manager- Handles quotations and payments
//   compliance_admin- Checks hygiene standards
//   warehouse_staff - Manages stock and delivery
//   salesman        - Visits customers, records info
//   dealer          - Places bulk orders
//   field_staff     - Facility Manager: enters cleaning requirements

const ROLES_HIERARCHY = {
  admin: ['admin', 'sales_admin', 'accounts_manager', 'compliance_admin', 'warehouse_staff', 'salesman', 'dealer', 'field_staff'],
  sales_admin: ['sales_admin', 'salesman', 'dealer', 'field_staff'],
  accounts_manager: ['accounts_manager'],
  compliance_admin: ['compliance_admin'],
  warehouse_staff: ['warehouse_staff'],
  salesman: ['salesman'],
  dealer: ['dealer'],
  field_staff: ['field_staff'],
};

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role || 'field_staff';
    const effectiveRoles = ROLES_HIERARCHY[userRole] || [userRole];
    const hasAccess = allowedRoles.some(role => effectiveRoles.includes(role));
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Required role(s): ' + allowedRoles.join(', '),
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
}

module.exports = { requireRole, ROLES_HIERARCHY };
